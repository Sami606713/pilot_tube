import "server-only";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDb } from "@/lib/db";
import type { ShortScript } from "@/lib/script/schema";
import { videoDir } from "@/lib/voice/voiceover";

const run = promisify(execFile);

/** The HyperFrames project created with `npx hyperframes init cards`. */
const CARDS_PROJECT = path.resolve(/*turbopackIgnore: true*/ "cards");
// Every card composition has data-duration="3" on its root.
const CARD_SECONDS = 3;

export type CardKind = "hook" | "stat" | "outro";

export type Card = {
  name: string;
  kind: CardKind;
  variables: Record<string, string>;
  filePath: string;
  duration: number;
  createdAt: string;
};

type CardRow = { name: string; kind: CardKind; variables: string; file_path: string; duration: number; created_at: string };

/** Transparent PNG still of a card at 1.5s (fully animated in), ~270px wide, for dashboard previews. */
export async function ensureCardPoster(cardPath: string): Promise<string> {
  const posterPath = cardPath.replace(/\.webm$/, ".png");
  try {
    await access(posterPath);
    return posterPath;
  } catch {
    // Not made yet.
  }
  // libvpx-vp9 must be forced as the decoder, or FFmpeg drops the alpha channel.
  await run("ffmpeg", ["-v", "error", "-y", "-c:v", "libvpx-vp9", "-ss", "1.5", "-i", cardPath, "-frames:v", "1", "-vf", "scale=270:-2", posterPath], {
    timeout: 30_000,
  });
  return posterPath;
}

/** Use the exact HyperFrames version the cards project pins, so renders stay identical over time. */
async function hyperframesPackage(): Promise<string> {
  const pkg = JSON.parse(await readFile(path.join(CARDS_PROJECT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  const pinned = pkg.scripts.render?.match(/hyperframes@[\w.-]+/)?.[0];
  if (!pinned) throw new Error("Could not find the pinned hyperframes version in cards/package.json");
  return pinned;
}

function cardJobs(script: ShortScript): { name: string; kind: CardKind; variables: Record<string, string> }[] {
  const accent = process.env.CARD_ACCENT || "#7CFF6B";
  const handle = process.env.CHANNEL_HANDLE || "";
  return [
    { name: "hook", kind: "hook", variables: { headline: script.cards.hook, kicker: "AI NEWS", accent } },
    ...script.cards.stats.map((s, i) => ({
      name: `stat-${i + 1}`,
      kind: "stat" as const,
      variables: { value: s.value, label: s.label, accent },
    })),
    { name: "outro", kind: "outro", variables: { text: script.cards.outro, handle, accent } },
  ];
}

/** Render the hook, stat and outro cards for a script as transparent WebM overlays with HyperFrames. */
export async function renderCards(scriptId: number): Promise<Card[]> {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM scripts WHERE id = ?`).get(scriptId) as { data: string } | undefined;
  if (!row) throw new Error(`Script #${scriptId} not found`);
  const script = JSON.parse(row.data) as ShortScript;

  const outDir = path.join(videoDir(scriptId), "cards");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const pkg = await hyperframesPackage();

  const cards: Card[] = [];
  // One at a time: each render already uses several Chrome workers.
  for (const job of cardJobs(script)) {
    const varsFile = path.join(outDir, `${job.name}.vars.json`);
    const filePath = path.join(outDir, `${job.name}.webm`);
    await writeFile(varsFile, JSON.stringify(job.variables));
    try {
      await run(
        "npx",
        ["--yes", pkg, "render", "-c", `compositions/${job.kind}.html`, "--format", "webm", "-o", filePath, "--variables-file", varsFile, "--strict-variables", "--quiet"],
        { cwd: CARDS_PROJECT, timeout: 5 * 60_000, maxBuffer: 20 * 1024 * 1024 },
      );
    } catch (err) {
      const e = err as { stderr?: string; stdout?: string; message: string };
      const detail = (e.stderr || e.stdout || e.message).replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-5).join(" ");
      throw new Error(`HyperFrames failed on the ${job.name} card: ${detail}`);
    }
    await rm(varsFile, { force: true });
    await ensureCardPoster(filePath);
    cards.push({ ...job, filePath, duration: CARD_SECONDS, createdAt: new Date().toISOString() });
  }

  db.prepare(`DELETE FROM cards WHERE script_id = ?`).run(scriptId);
  const insert = db.prepare(
    `INSERT INTO cards (script_id, name, kind, variables, file_path, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of cards) insert.run(scriptId, c.name, c.kind, JSON.stringify(c.variables), c.filePath, c.duration, c.createdAt);
  db.prepare(`UPDATE scripts SET status = 'cards' WHERE id = ?`).run(scriptId);

  return cards;
}

export function getCards(scriptId: number): Card[] {
  const rows = getDb()
    .prepare(`SELECT * FROM cards WHERE script_id = ? ORDER BY CASE kind WHEN 'hook' THEN 0 WHEN 'stat' THEN 1 ELSE 2 END, name`)
    .all(scriptId) as CardRow[];
  return rows.map((r) => ({
    name: r.name,
    kind: r.kind,
    variables: JSON.parse(r.variables),
    filePath: r.file_path,
    duration: r.duration,
    createdAt: r.created_at,
  }));
}
