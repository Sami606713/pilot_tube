import "server-only";
import { spawn } from "node:child_process";
import { copyFile, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { askJson } from "@/lib/agnes";
import { getScript } from "@/lib/scripts/store";
import { generateClip } from "./agnes-video";
import { ensureAudioFiles, prepareAudio, sfxProps } from "./audio";
import { accentFrom, copyLogo, getBrand } from "./brands";
import { planDesign, startMode } from "./design";
import { downloadTo, searchClips } from "./pexels";
import { getProject, newProject, saveProject, setStep, usedPexelsIds, videoDir } from "./store";
import { DEFAULT_ACCENT, FPS, VOICE, type ClipOption, type LineMode, type LogoAsset, type Scene3D, type ShortProps, type StudioLine, type VideoProject } from "./types";
import { alignWords, lineTimings, synthesize, transcribe } from "./voice";

/** Silence after the last word so the loop line doesn't get cut mid-breath. */
const TAIL_SECONDS = 0.6;
const OPTIONS_PER_LINE = 3;
/** Agnes AI clips tried per video (its free queue is slow and often full). */
const MAX_AI_CLIPS = 2;
/** YouTube Shorts loudness target. */
const LOUDNORM = "I=-14:TP=-1.5:LRA=11";

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------- Search queries ----------

const queriesSchema = z.object({ lines: z.array(z.object({ primary: z.string().min(2), backup: z.string().min(2) })) });

const QUERIES_PROMPT = `You pick stock footage for a vertical AI-news YouTube Short. For each script line, write two Pexels VIDEO search queries (2-4 words each, plain English nouns, no brand names, no quotes):
- "primary": the most specific REAL footage that fits the line and its visual direction (e.g. "data center servers", "computer chip closeup", "engineer laptop code")
- "backup": a broader fallback that surely exists on a stock site (e.g. "technology abstract", "city night traffic")
Stock sites have no logos, charts or 3D renders: for those lines, pick real footage with the same mood (e.g. a chart line → "stock market screen"; a 3D chip → "circuit board macro").
Return ONLY JSON: { "lines": [ { "primary": "...", "backup": "..." } ] } with exactly one entry per line, in order.`;

async function planQueries(lines: { narration: string; visual: string }[]): Promise<{ primary: string; backup: string }[]> {
  const list = lines.map((l, i) => `${i + 1}. "${l.narration}" | visual: ${l.visual}`).join("\n");
  const out = await askJson(QUERIES_PROMPT, `Script lines:\n${list}`, (raw) => {
    const parsed = queriesSchema.parse(raw);
    if (parsed.lines.length !== lines.length) throw new Error(`Need exactly ${lines.length} entries, got ${parsed.lines.length}`);
    return parsed;
  });
  return out.lines;
}

/** Up to 3 options, unused elsewhere, long enough for the line when possible. */
async function findOptions(queries: string[], minDuration: number, exclude: Set<number>, page = 1): Promise<{ query: string; options: ClipOption[] }> {
  for (const query of queries) {
    const found = (await searchClips(query, { page })).filter((o) => !exclude.has(o.pexelsId));
    if (found.length === 0) continue;
    const long = found.filter((o) => o.duration >= minDuration);
    const options = [...long, ...found.filter((o) => o.duration < minDuration)].slice(0, OPTIONS_PER_LINE);
    return { query, options };
  }
  return { query: queries[0], options: [] };
}

async function downloadOption(scriptId: number, lineIndex: number, option: ClipOption): Promise<string> {
  const name = `clip-${lineIndex}-${option.pexelsId}.mp4`;
  const file = path.join(videoDir(scriptId), name);
  try {
    await stat(file);
  } catch {
    await downloadTo(option.fileUrl, file);
  }
  return name;
}

// ---------- Make: voice + visuals ----------

export async function runVideo(scriptId: number): Promise<void> {
  const script = getScript(scriptId);
  if (!script?.content) throw new Error("Script not found or not finished");
  const content = script.content;
  const dir = videoDir(scriptId);
  await mkdir(dir, { recursive: true });
  let project = newProject(scriptId, content.title);

  try {
    // 1. Voice + word timings
    setStep(scriptId, "voice", "running", "Deepgram Hermes (expressive male)");
    const narration = content.lines.map((l) => l.narration.trim()).join(" ");
    const audio = await synthesize(narration, VOICE);
    await writeFile(path.join(dir, "voice.mp3"), audio);
    const heard = await transcribe(audio);
    const words = alignWords(narration, heard.words);
    const timings = lineTimings(content.lines.map((l) => l.narration), words, heard.duration + TAIL_SECONDS);
    project = getProject(scriptId)!;
    project = saveProject({ ...project, voice: { file: "voice.mp3", duration: heard.duration, words } });
    setStep(scriptId, "voice", "done", `${heard.duration.toFixed(1)}s · ${words.length} words timed`);

    // 2. Design plan (3D scene, chart, kinetic text, company) + brand colors and logos
    setStep(scriptId, "visuals", "running", "Designing 3D, charts, text and logos");
    const design = await planDesign(content.title, content.lines);
    let accent = DEFAULT_ACCENT;
    let brand: VideoProject["brand"] = null;
    if (design.mainCompany) {
      const main = await getBrand(design.mainCompany.domain).catch(() => null);
      accent = (main && accentFrom(main.colors)) ?? DEFAULT_ACCENT;
      brand = { name: main?.name ?? design.mainCompany.name, domain: design.mainCompany.domain };
    }
    const logos = new Map<string, LogoAsset | null>();
    for (const d of design.lines) {
      const domain = d.company?.domain;
      if (!domain || logos.has(domain)) continue;
      const b = await getBrand(domain).catch(() => null);
      const file = b?.logo ? await copyLogo(domain, dir).catch(() => null) : null;
      logos.set(domain, file ? { domain, name: b?.name ?? d.company!.name, file, color: (b && accentFrom(b.colors)) ?? accent } : null);
    }

    // 3. Footage: 3 options per line (any line can be switched to footage later)
    setStep(scriptId, "visuals", "running", "Choosing footage");
    const queries = await planQueries(content.lines.map((l) => ({ narration: l.narration, visual: `${l.visual.type}: ${l.visual.description}` })));
    const exclude = usedPexelsIds(scriptId);
    const lines: StudioLine[] = [];
    // One line at a time so a clip is never used twice in the same Short.
    for (const [i, l] of content.lines.entries()) {
      const t = timings[i];
      const { query, options } = await findOptions([queries[i].primary, queries[i].backup, "technology abstract"], t.end - t.start, exclude);
      const chosen = options[0] ?? null;
      if (chosen) exclude.add(chosen.pexelsId);
      const d = design.lines[i];
      const logo = d.company ? (logos.get(d.company.domain) ?? null) : null;
      lines.push({
        index: i,
        part: l.part,
        narration: l.narration,
        plannedVisual: l.visual.type,
        visualDescription: l.visual.description,
        onScreenText: l.onScreenText,
        transition: l.transition,
        sfx: l.sfx,
        start: t.start,
        end: t.end,
        query,
        options,
        chosen: chosen?.pexelsId ?? null,
        file: null,
        mode: chosen || l.visual.type !== "b-roll" ? startMode(l.visual.type, Boolean(d.chart), Boolean(logo)) : "3d",
        design: { scene: d.scene, chart: d.chart, phrases: d.phrases, logo },
        aiClip: null,
      });
      setStep(scriptId, "visuals", "running", `Found footage for ${i + 1} of ${content.lines.length} lines`);
    }
    // Only footage lines need their clip now; others download when switched to footage.
    const files = await mapLimit(lines, 3, async (line) => {
      const opt = line.options.find((o) => o.pexelsId === line.chosen);
      return opt && line.mode === "footage" ? downloadOption(scriptId, line.index, opt) : null;
    });
    lines.forEach((l, i) => (l.file = files[i]));
    project = getProject(scriptId)!;
    saveProject({ ...project, lines, accent, brand, status: "running", editedAt: new Date().toISOString() });

    // 4. Agnes AI clips for a couple of B-roll lines (falls back to the stock footage)
    const aiTargets = lines.filter((l) => l.plannedVisual === "b-roll" && l.mode === "footage").slice(0, MAX_AI_CLIPS);
    let aiMade = 0;
    let aiNote = "";
    for (const target of aiTargets) {
      setStep(scriptId, "visuals", "running", `Trying an Agnes AI clip for line ${target.index + 1}`);
      try {
        const clip = await makeAiClip(scriptId, target);
        const fresh = getProject(scriptId)!;
        fresh.lines[target.index] = { ...fresh.lines[target.index], aiClip: clip, mode: "ai-clip" };
        saveProject(fresh);
        aiMade++;
      } catch (err) {
        aiNote = (err as Error).message;
        // A full queue won't clear in seconds: stop trying for this video.
        if (/queue/i.test(aiNote)) break;
      }
    }

    const final = getProject(scriptId)!;
    const count = (m: LineMode) => final.lines.filter((l) => l.mode === m).length;
    setStep(
      scriptId,
      "visuals",
      "done",
      [`${count("3d")} 3D`, `${count("footage")} footage`, `${count("ai-clip")} AI clip`, `${count("chart")} chart`, `${count("logo")} logo`, `${count("text")} text`].join(" · ") +
        (aiTargets.length && !aiMade ? ` · Agnes clips skipped (${aiNote.slice(0, 60)})` : ""),
    );

    // 5. Sound effects on the cuts
    await prepareAudio(scriptId);
    saveProject({ ...getProject(scriptId)!, status: "ready", editedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`[studio] #${scriptId} failed:`, err);
    const p = getProject(scriptId);
    if (p) {
      const steps = p.steps.map((s) => (s.state === "running" ? { ...s, state: "failed" as const } : s));
      saveProject({ ...p, steps, status: "failed", error: (err as Error).message });
    }
  }
}

/** Ask Agnes for a clip matching the line's visual direction; downloads it into the video folder. */
async function makeAiClip(scriptId: number, line: StudioLine): Promise<{ file: string; duration: number }> {
  const seconds = Math.min(12, Math.max(4, Math.ceil(line.end - line.start)));
  const prompt = `Vertical cinematic shot for a tech news video: ${line.visualDescription} Realistic, high detail, dramatic lighting, smooth camera movement, no text, no logos.`;
  const url = await generateClip(prompt, seconds);
  const name = `ai-${line.index}.mp4`;
  await downloadTo(url, path.join(videoDir(scriptId), name));
  return { file: name, duration: seconds };
}

/** Try (again) an Agnes AI clip for one line; takes up to ~4 minutes. */
export async function aiClipForLine(scriptId: number, lineIndex: number): Promise<VideoProject> {
  const p = getProject(scriptId);
  const line = p?.lines[lineIndex];
  if (!p || !line) throw new Error("Line not found");
  const clip = await makeAiClip(scriptId, line);
  const fresh = getProject(scriptId)!;
  fresh.lines[lineIndex] = { ...fresh.lines[lineIndex], aiClip: clip, mode: "ai-clip" };
  return saveProject({ ...fresh, editedAt: new Date().toISOString() });
}

/** Put a finished clip from the Clips library on a line (copied into the video folder). */
export async function applyLibraryClip(scriptId: number, lineIndex: number, clipId: number): Promise<VideoProject> {
  const { getClip, CLIP_DIR } = await import("@/lib/clips/clips");
  const clip = getClip(clipId);
  if (!clip?.file || clip.state !== "done") throw new Error("That clip is not ready");
  const p = getProject(scriptId);
  if (!p?.lines[lineIndex]) throw new Error("Line not found");
  const name = `lib-${lineIndex}-${clipId}.mp4`;
  await copyFile(path.join(CLIP_DIR(), clip.file), path.join(videoDir(scriptId), name));
  const fresh = getProject(scriptId)!;
  fresh.lines[lineIndex] = { ...fresh.lines[lineIndex], aiClip: { file: name, duration: clip.duration ?? clip.seconds }, mode: "ai-clip" };
  return saveProject({ ...fresh, editedAt: new Date().toISOString() });
}

/** Show a line as footage, AI clip, 3D, logo, chart or kinetic text (only modes that have content). */
export async function setLineMode(scriptId: number, lineIndex: number, mode: LineMode, scene?: Scene3D): Promise<VideoProject> {
  const p = getProject(scriptId);
  const line = p?.lines[lineIndex];
  if (!p || !line) throw new Error("Line not found");
  let file = line.file;
  if (mode === "footage" && !file) {
    const opt = line.options.find((o) => o.pexelsId === line.chosen);
    if (!opt) throw new Error("No footage found for this line. Search new clips first.");
    file = await downloadOption(scriptId, lineIndex, opt);
  }
  if (mode === "ai-clip" && !line.aiClip) throw new Error("No AI clip yet. Press Try AI clip.");
  if (mode === "logo" && !line.design.logo?.file) throw new Error("No company logo for this line.");
  if (mode === "chart" && !line.design.chart) throw new Error("This line has no number to chart.");
  const fresh = getProject(scriptId)!;
  fresh.lines[lineIndex] = { ...fresh.lines[lineIndex], mode, file, design: { ...fresh.lines[lineIndex].design, scene: scene ?? fresh.lines[lineIndex].design.scene } };
  return saveProject({ ...fresh, editedAt: new Date().toISOString() });
}

/** Use another of a line's options. */
export async function chooseClip(scriptId: number, lineIndex: number, pexelsId: number): Promise<VideoProject> {
  const p = getProject(scriptId);
  const line = p?.lines[lineIndex];
  const option = line?.options.find((o) => o.pexelsId === pexelsId);
  if (!p || !line || !option) throw new Error("Clip not found");
  const dupe = p.lines.find((l) => l.index !== lineIndex && l.chosen === pexelsId);
  if (dupe) throw new Error(`That clip is already used on line ${dupe.index + 1}. Pick another so the Short doesn't repeat footage.`);
  const file = await downloadOption(scriptId, lineIndex, option);
  const fresh = getProject(scriptId)!;
  fresh.lines[lineIndex] = { ...fresh.lines[lineIndex], chosen: pexelsId, file, mode: "footage" };
  return saveProject({ ...fresh, editedAt: new Date().toISOString() });
}

/** 3 new options for a line (your own search words, or the next page of results), first one used. */
export async function regenerateLine(scriptId: number, lineIndex: number, query?: string): Promise<VideoProject> {
  const p = getProject(scriptId);
  const line = p?.lines[lineIndex];
  if (!p || !line) throw new Error("Line not found");
  const exclude = usedPexelsIds(scriptId);
  p.lines.forEach((l) => {
    if (l.chosen) exclude.add(l.chosen);
    if (l.index === lineIndex) l.options.forEach((o) => exclude.add(o.pexelsId));
  });
  const q = query?.trim();
  const { query: used, options } = await findOptions(q ? [q] : [line.query], line.end - line.start, exclude, q ? 1 : 2);
  if (options.length === 0) throw new Error(`No new footage found for "${q || line.query}". Try other words.`);
  const file = await downloadOption(scriptId, lineIndex, options[0]);
  const fresh = getProject(scriptId)!;
  fresh.lines[lineIndex] = { ...fresh.lines[lineIndex], query: used, options, chosen: options[0].pexelsId, file, mode: "footage" };
  return saveProject({ ...fresh, editedAt: new Date().toISOString() });
}

// ---------- Props + render ----------

export function buildProps(p: VideoProject, assets: string): ShortProps {
  const duration = (p.voice?.duration ?? 0) + TAIL_SECONDS;
  return {
    duration,
    accent: p.accent,
    voice: p.voice?.file ?? "",
    words: p.voice?.words ?? [],
    lines: p.lines.map((l) => {
      const ai = l.mode === "ai-clip" && l.aiClip;
      return {
        start: l.start,
        end: l.end,
        mode: l.mode,
        clip: ai ? l.aiClip!.file : l.file,
        clipDuration: ai ? l.aiClip!.duration : (l.options.find((o) => o.pexelsId === l.chosen)?.duration ?? 0),
        onScreenText: l.onScreenText,
        part: l.part,
        transition: l.transition,
        design: l.design,
      };
    }),
    assets,
    sfx: sfxProps(p),
  };
}

function run(cmd: string, args: string[], onLine?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: process.cwd(), env: process.env });
    let tail = "";
    const read = (buf: Buffer) => {
      const text = buf.toString();
      tail = (tail + text).slice(-3000);
      text.split(/\r|\n/).forEach((l) => l.trim() && onLine?.(l.trim()));
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}: ${tail.slice(-800)}`))));
  });
}

/** Remotion renders 1080x1920 from the same composition as the preview, then FFmpeg sets Shorts loudness (-14 LUFS). */
export async function renderVideo(scriptId: number): Promise<void> {
  const p = getProject(scriptId);
  if (!p || !p.voice) return;
  const dir = videoDir(scriptId);
  const started = Date.now();
  saveProject({ ...p, status: "rendering", error: null });
  setStep(scriptId, "render", "running", "Starting Remotion");
  const propsFile = path.join(dir, "props.json");
  const raw = path.join(dir, "render.raw.mp4");
  const final = path.join(dir, "final.mp4");
  try {
    // Sounds must sit in the render's public folder (e.g. switched on since the make).
    await ensureAudioFiles(p);
    await writeFile(propsFile, JSON.stringify(buildProps(p, "static")));
    let lastUpdate = 0;
    await run(
      path.join(process.cwd(), "node_modules/.bin/remotion"),
      ["render", "src/remotion/index.ts", "Short", raw, `--props=${propsFile}`, `--public-dir=${dir}`, "--codec=h264", "--crf=20", "--log=info"],
      (line) => {
        const m = line.match(/Rendered (\d+)\/(\d+)/) ?? line.match(/(\d+)\/(\d+)/);
        if (m && Date.now() - lastUpdate > 3000) {
          lastUpdate = Date.now();
          setStep(scriptId, "render", "running", `Frame ${m[1]} of ${m[2]}`);
        }
      },
    );
    setStep(scriptId, "render", "running", "Setting loudness for Shorts");
    // Two-pass loudnorm: one pass undershoots (-16 instead of -14 LUFS).
    let measured = "";
    await run("ffmpeg", ["-hide_banner", "-y", "-i", raw, "-af", `loudnorm=${LOUDNORM}:print_format=json`, "-f", "null", "-"], (l) => (measured += `${l}\n`));
    const m = JSON.parse(measured.slice(measured.lastIndexOf("{"), measured.lastIndexOf("}") + 1)) as Record<string, string>;
    const second = `loudnorm=${LOUDNORM}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", second, "-ar", "48000", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", `${final}.tmp.mp4`]);
    await rename(`${final}.tmp.mp4`, final);
    await rm(raw, { force: true });
    const size = (await stat(final)).size;
    const seconds = Math.round((Date.now() - started) / 1000);
    const fresh = getProject(scriptId)!;
    const duration = Math.round(((fresh.voice?.duration ?? 0) + TAIL_SECONDS) * FPS) / FPS;
    saveProject({ ...fresh, status: "ready", render: { file: "final.mp4", duration, sizeBytes: size, seconds, createdAt: new Date().toISOString() } });
    setStep(scriptId, "render", "done", `${duration.toFixed(1)}s · ${(size / 1024 / 1024).toFixed(1)} MB · rendered in ${seconds}s`);
  } catch (err) {
    console.error(`[studio] render #${scriptId} failed:`, err);
    const fresh = getProject(scriptId)!;
    const steps = fresh.steps.map((s) => (s.key === "render" ? { ...s, state: "failed" as const } : s));
    saveProject({ ...fresh, steps, status: "ready", error: `Render failed: ${(err as Error).message.slice(0, 500)}` });
  }
}
