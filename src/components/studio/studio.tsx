"use client";

import { ArrowClockwise, CircleNotch, DownloadSimple, FilmSlate, MagnifyingGlass, Play, Sparkle, Warning } from "@phosphor-icons/react";
import { Player, type PlayerRef } from "@remotion/player";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RunSteps } from "@/components/run-steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PARTS, TRANSITIONS, VISUALS } from "@/lib/scripts/types";
import { FPS, HEIGHT, MODES, SCENES, WIDTH, type LineMode, type Scene3D, type ShortProps, type VideoProject } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Short } from "@/remotion/Short";

type ScriptChoice = { id: number; title: string };
type LibraryClip = { id: number; prompt: string; shape: string; duration: number };
type Loaded = { project: VideoProject; props: ShortProps };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Studio({ scripts, clips, scriptId, initial }: { scripts: ScriptChoice[]; clips: LibraryClip[]; scriptId: number | null; initial: Loaded | null }) {
  const router = useRouter();
  const player = useRef<PlayerRef>(null);
  const [data, setData] = useState<Loaded | null>(initial);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const project = data?.project ?? null;
  const working = project?.status === "running" || project?.status === "rendering";

  const load = useCallback(async () => {
    if (scriptId === null) return;
    const res = await fetch(`/api/studio/${scriptId}`);
    if (res.ok) setData(await res.json());
  }, [scriptId]);

  // Poll while voice/visuals are being made or the video renders.
  useEffect(() => {
    if (!working) return;
    const t = setTimeout(load, 2500);
    return () => clearTimeout(t);
  }, [working, data, load]);

  async function post(url: string, body: object | null, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      return json;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function make() {
    if (scriptId === null) return;
    if (await post("/api/studio", { scriptId }, "make")) {
      // The project row exists a moment after the request returns.
      setTimeout(load, 800);
      setData((d) => (d ? { ...d, project: { ...d.project, status: "running" } } : d));
    }
  }

  async function render() {
    if (!project) return;
    if (await post(`/api/studio/${project.scriptId}/render`, null, "render")) {
      setData((d) => (d ? { ...d, project: { ...d.project, status: "rendering" } } : d));
      setTimeout(load, 800);
    }
  }

  async function audio(body: object, label: string) {
    if (!project) return;
    if (await post(`/api/studio/${project.scriptId}/audio`, body, label)) await load();
  }

  async function lineAction(body: object, label: string) {
    if (!project) return;
    const next = (await post(`/api/studio/${project.scriptId}/line`, body, label)) as VideoProject | null;
    if (next) await load();
  }

  function selectLine(i: number) {
    setSelected(i);
    setQuery("");
    const line = project?.lines[i];
    if (line) player.current?.seekTo(Math.round(line.start * FPS));
  }

  // ----- No script chosen / no project yet -----
  const picker = (
    <select
      value={scriptId ?? ""}
      onChange={(e) => router.push(e.target.value ? `/studio?script=${e.target.value}` : "/studio")}
      aria-label="Script"
      className="h-9 max-w-full rounded-lg border border-input bg-transparent px-3 text-sm sm:w-80"
    >
      <option value="">Pick a script…</option>
      {scripts.map((s) => (
        <option key={s.id} value={s.id}>
          #{s.id} {s.title}
        </option>
      ))}
    </select>
  );

  if (scriptId === null || !project || (project.status === "failed" && project.lines.length === 0) || (project.status === "running" && project.lines.length === 0)) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">{picker}</div>
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-start gap-4">
            {scriptId === null ? (
              <>
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <FilmSlate className="size-5" />
                </span>
                <p className="font-medium">Turn a script into a Short</p>
                <p className="max-w-[60ch] text-sm text-muted-foreground">
                  Pick a finished script. PilotTube makes the voice, finds footage for every line, adds captions and on-screen text, lets you preview and swap clips, then renders the
                  final 1080×1920 video.
                </p>
              </>
            ) : project && project.status === "running" ? (
              <>
                <p className="font-medium">Making the voice and visuals…</p>
                <RunSteps steps={project.steps} skippedNote="off" />
              </>
            ) : (
              <>
                {project?.error && (
                  <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <Warning className="mt-0.5 size-4 shrink-0" /> {project.error}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Voice (Deepgram, deep male) + footage for every line (Pexels). About 1-2 minutes.</p>
                <Button onClick={make} disabled={busy !== null}>
                  {busy === "make" ? <CircleNotch className="animate-spin" /> : <Play weight="fill" />} Make video
                </Button>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Studio -----
  const props = data!.props;
  const total = props.duration;
  const line = project.lines[Math.min(selected, project.lines.length - 1)];
  const stale = project.render && project.editedAt && Date.parse(project.editedAt) > Date.parse(project.render.createdAt);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {picker}
          <span className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{total.toFixed(1)}s</span> · {project.lines.length} lines
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={make} disabled={working || busy !== null} title="Make the voice and footage again">
            {busy === "make" ? <CircleNotch className="animate-spin" /> : <ArrowClockwise />} Remake
          </Button>
          <Button onClick={render} disabled={working || busy !== null}>
            {project.status === "rendering" || busy === "render" ? <CircleNotch className="animate-spin" /> : <FilmSlate />}
            {project.status === "rendering" ? "Rendering" : project.render ? "Render again" : "Render"}
          </Button>
        </div>
      </div>
      {(error || project.error) && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <Warning className="mt-0.5 size-4 shrink-0" /> {error ?? project.error}
        </p>
      )}

      {/* Preview + steps */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[340px] self-start overflow-hidden rounded-xl bg-black ring-1 ring-border">
          <Player
            ref={player}
            component={Short}
            inputProps={props}
            durationInFrames={Math.max(1, Math.ceil(total * FPS))}
            fps={FPS}
            compositionWidth={WIDTH}
            compositionHeight={HEIGHT}
            style={{ width: "100%", aspectRatio: "9 / 16" }}
            controls
            acknowledgeRemotionLicense
          />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Steps</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <RunSteps steps={project.steps} skippedNote="off" />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                Accent color <span className="inline-block size-4 rounded" style={{ background: project.accent }} /> <span className="font-mono">{project.accent}</span>
                {project.brand && <span>from {project.brand.name}&apos;s brand colors</span>}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sound effects</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex w-fit items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={project.sfxEnabled !== false}
                  onChange={(e) => audio({ sfx: e.target.checked }, "sfx")}
                  disabled={busy !== null || working}
                  className="size-4 accent-[var(--brand)]"
                />
                Sound effects on cuts ({props.sfx.length})
              </label>
            </CardContent>
          </Card>

          {project.render && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Final video</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row">
                <video
                  src={`/api/studio/${project.scriptId}/file/final.mp4?v=${encodeURIComponent(project.render.createdAt)}`}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-[9/16] w-40 shrink-0 rounded-lg bg-black ring-1 ring-border"
                />
                <div className="flex flex-col gap-2 text-sm">
                  <p className="font-mono tabular-nums">
                    {project.render.duration.toFixed(1)}s · {(project.render.sizeBytes / 1024 / 1024).toFixed(1)} MB · 1080×1920
                  </p>
                  <p className="text-xs text-muted-foreground">Rendered in {project.render.seconds}s, loudness set for Shorts (about -14 LUFS).</p>
                  {stale && <p className="text-xs text-amber-400">You changed clips after this render. Render again to include them.</p>}
                  <a
                    href={`/api/studio/${project.scriptId}/file/final.mp4?download=1`}
                    className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    <DownloadSimple className="size-4" /> Download MP4
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex w-full gap-1 overflow-x-auto pb-1" role="listbox" aria-label="Lines">
            {project.lines.map((l, i) => {
              const opt = l.options.find((o) => o.pexelsId === l.chosen);
              return (
                <button
                  key={i}
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  onClick={() => selectLine(i)}
                  style={{ flexGrow: Math.max(0.5, l.end - l.start), flexBasis: 0 }}
                  className={cn(
                    "relative flex h-24 min-w-14 flex-col justify-between overflow-hidden rounded-lg border p-1.5 text-left transition-colors",
                    i === selected ? "border-brand ring-2 ring-brand/40" : "border-border hover:border-foreground/30",
                  )}
                >
                  {opt && (l.mode ?? "footage") === "footage" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote Pexels thumbnail
                    <img src={opt.poster} alt="" className="absolute inset-0 size-full object-cover opacity-60" loading="lazy" />
                  ) : (
                    <span className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 40%, ${project.accent}66, #0a0b10 70%)` }} />
                  )}
                  <span className="relative font-mono text-[10px] text-white/90 tabular-nums [text-shadow:0_1px_2px_#000]">{clock(l.start)}</span>
                  <span className="relative truncate rounded bg-black/70 px-1 text-[10px] font-medium text-white">{MODES[l.mode ?? "footage"]}</span>
                </button>
              );
            })}
          </div>
          {/* Voice: one tick per spoken word, at its real time. */}
          <div className="relative ml-12 h-6 rounded bg-muted/60" aria-label="Voice">
            {props.words.map((w, i) => (
              <span key={i} className="absolute top-1.5 bottom-1.5 w-[2px] rounded bg-sky-400/70" style={{ left: `${(w.start / total) * 100}%` }} />
            ))}
            <span className="absolute top-1 -left-12 text-[10px] text-muted-foreground">voice</span>
          </div>
          <div className="relative ml-12 h-6 rounded bg-muted/40" aria-label="Sound effects">
            {props.sfx.map((s, i) => (
              <span
                key={i}
                title={s.file.replace(/^sfx-|\.wav$/g, "")}
                className="absolute top-1 h-4 rounded-sm bg-amber-400/80 px-1 text-[9px] leading-4 text-black"
                style={{ left: `${(s.at / total) * 100}%` }}
              >
                {s.file.replace(/^sfx-|\.wav$/g, "")}
              </span>
            ))}
            <span className="absolute top-1 -left-12 text-[10px] text-muted-foreground">sfx</span>
          </div>
        </CardContent>
      </Card>

      {/* Selected line */}
      {line && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              Line {line.index + 1} · <span className="font-mono tabular-nums">{clock(line.start)}</span> · {PARTS[line.part]}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-base">&ldquo;{line.narration}&rdquo;</p>
            <p className="text-xs text-muted-foreground">
              Script wants: <span className="text-foreground">{VISUALS[line.plannedVisual]}</span>, {line.visualDescription}
            </p>

            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Show this line as">
              {(Object.keys(MODES) as LineMode[]).map((m) => {
                const available =
                  m === "footage" ? line.options.length > 0 : m === "ai-clip" ? Boolean(line.aiClip) : m === "logo" ? Boolean(line.design?.logo?.file) : m === "chart" ? Boolean(line.design?.chart) : true;
                const active = (line.mode ?? "footage") === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!available || busy !== null || working}
                    onClick={() => !active && lineAction({ index: line.index, mode: m }, `mode-${m}`)}
                    title={available ? undefined : m === "ai-clip" ? "Press Try AI clip first" : m === "logo" ? "No company logo for this line" : "This line states no number"}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40",
                      active ? "border-brand bg-brand-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {busy === `mode-${m}` ? <CircleNotch className="inline size-3 animate-spin" /> : null} {MODES[m]}
                  </button>
                );
              })}
            </div>

            {(line.mode ?? "footage") === "3d" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Scene:</span>
                {(Object.keys(SCENES) as Scene3D[]).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => sc !== line.design.scene && lineAction({ index: line.index, mode: "3d", scene: sc }, `scene-${sc}`)}
                    disabled={busy !== null || working}
                    className={cn("rounded-md px-2 py-1 text-xs", sc === line.design.scene ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {SCENES[sc]}
                  </button>
                ))}
              </div>
            )}
            {(line.mode ?? "footage") === "chart" && line.design.chart && (
              <p className="text-xs text-muted-foreground">
                Chart:{" "}
                {line.design.chart.kind === "counter"
                  ? `${line.design.chart.prefix}${line.design.chart.value}${line.design.chart.suffix} ${line.design.chart.label}`
                  : line.design.chart.items.map((it) => `${it.label} ${it.value}`).join(" vs ")}{" "}
                (numbers taken from the line itself)
              </p>
            )}
            {(line.mode ?? "footage") === "text" && <p className="text-xs text-muted-foreground">Kinetic text: {line.design.phrases.join(" · ")}</p>}
            {(line.mode ?? "footage") === "logo" && line.design.logo && <p className="text-xs text-muted-foreground">Logo: {line.design.logo.name} (Brandfetch)</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => lineAction({ index: line.index, ai: true }, "ai")} disabled={busy !== null || working}>
                {busy === "ai" ? <CircleNotch className="animate-spin" /> : <Sparkle />} {line.aiClip ? "New AI clip" : "Try AI clip"}
              </Button>
              <span className="text-xs text-muted-foreground">{busy === "ai" ? "Agnes is generating (up to 4 min)…" : "Agnes Video, free but often busy"}</span>
            </div>
            {clips.length > 0 && (
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground sm:max-w-md">
                Or use a clip from your Clips library
                <select
                  value=""
                  onChange={(e) => e.target.value && lineAction({ index: line.index, clipId: Number(e.target.value) }, "lib")}
                  disabled={busy !== null || working}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
                >
                  <option value="">{busy === "lib" ? "Adding clip…" : "Pick a clip…"}</option>
                  {clips.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} · {c.shape} · {c.duration.toFixed(0)}s · {c.prompt.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p className="text-xs font-medium text-muted-foreground">Stock footage options</p>
            <div className="grid grid-cols-3 gap-3 sm:max-w-md">
              {line.options.map((o) => (
                <button
                  key={o.pexelsId}
                  type="button"
                  onClick={() => o.pexelsId !== line.chosen && lineAction({ index: line.index, pexelsId: o.pexelsId }, `pick-${o.pexelsId}`)}
                  disabled={busy !== null || working}
                  aria-pressed={o.pexelsId === line.chosen}
                  className={cn(
                    "relative aspect-[9/16] overflow-hidden rounded-lg border-2 bg-muted",
                    o.pexelsId === line.chosen ? "border-brand" : "border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Pexels thumbnail */}
                  <img src={o.poster} alt={`Clip by ${o.author}`} className="size-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{Math.round(o.duration)}s</span>
                  {busy === `pick-${o.pexelsId}` && (
                    <span className="absolute inset-0 grid place-items-center bg-black/50">
                      <CircleNotch className="size-5 animate-spin text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <form
              className="flex flex-col gap-2 sm:max-w-md sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                lineAction({ index: line.index, regenerate: true, query }, "regen");
              }}
            >
              <div className="relative flex-1">
                <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search words (now: ${line.query})`} className="pl-8" aria-label="Footage search" />
              </div>
              <Button type="submit" variant="outline" disabled={busy !== null || working}>
                {busy === "regen" ? <CircleNotch className="animate-spin" /> : <Sparkle />} New clips
              </Button>
            </form>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>
                On-screen text: <span className="font-semibold text-foreground uppercase">{line.onScreenText || "none"}</span>
              </span>
              <span>Transition out: {TRANSITIONS[line.transition]}</span>
              <span>SFX cue: {line.sfx || "none"}</span>
              {(() => {
                const o = line.options.find((x) => x.pexelsId === line.chosen);
                return o ? (
                  <a href={o.pageUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                    Footage: {o.author} on Pexels
                  </a>
                ) : null;
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
