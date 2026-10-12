import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, type ShortProps, type TimedWord } from "../lib/studio/types";
import { body, display } from "./fonts";
import { Shot } from "./fx";
import { Backdrop, ChartScene, Kinetic, LogoReveal } from "./scenes/graphics";
import { ThreeScene } from "./scenes/three-scenes";

const asset = (assets: string, name: string) => (assets === "static" ? staticFile(name) : `${assets}/${name}`);

/** Footage for one line: fills the frame, slow push-in (Ken Burns), slowed down if the clip is shorter than the line. */
function Footage({ src, lineSeconds, clipSeconds }: { src: string; lineSeconds: number; clipSeconds: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = interpolate(frame, [0, lineSeconds * fps], [1.06, 1.16], { extrapolateRight: "clamp" });
  const rate = clipSeconds > 0 ? Math.max(0.5, Math.min(1, clipSeconds / lineSeconds)) : 1;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
}

type Line = ShortProps["lines"][number];

/** The line's visual in its chosen mode. Older projects without a mode play their footage. */
function Visual({ line, frames, accent, assets }: { line: Line; frames: number; accent: string; assets: string }) {
  const mode = line.mode ?? "footage";
  const d = line.design;
  const seconds = frames / FPS;
  if ((mode === "footage" || mode === "ai-clip") && line.clip) return <Footage src={asset(assets, line.clip)} lineSeconds={seconds} clipSeconds={line.clipDuration} />;
  if (mode === "logo" && d?.logo?.file) return <LogoReveal logo={d.logo} src={asset(assets, d.logo.file)} accent={accent} />;
  if (mode === "chart" && d?.chart) return <ChartScene chart={d.chart} accent={accent} />;
  if (mode === "text" && d?.phrases?.length) return <Kinetic phrases={d.phrases} accent={accent} />;
  if (mode === "3d" || d) return <ThreeScene scene={d?.scene ?? "particles"} accent={accent} frames={frames} />;
  return <Backdrop accent={accent} />;
}

/** The script's on-screen text: slams in at the start of the line, holds, then fades. */
function OnScreenText({ text, accent, lineSeconds }: { text: string; accent: string; lineSeconds: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
  const hold = Math.min(lineSeconds, 2.4) * fps;
  const fade = interpolate(frame, [hold - 8, hold], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", top: 300, opacity: fade }}>
      <div
        style={{
          transform: `scale(${interpolate(pop, [0, 1], [1.6, 1])}) rotate(-2deg)`,
          opacity: pop,
          fontFamily: display,
          fontSize: 118,
          lineHeight: 1,
          letterSpacing: 1,
          color: "#fff",
          textTransform: "uppercase",
          textAlign: "center",
          maxWidth: 940,
          padding: "18px 34px 14px",
          background: accent,
          boxShadow: `0 20px 60px ${accent}66`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

/** Group words into 1-3 word caption chunks, breaking after punctuation. */
function chunks(words: TimedWord[]): TimedWord[][] {
  const out: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length === 3 || /[.,!?;:]$/.test(w.word)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Big word-by-word captions: the spoken word in the accent color, each chunk pops in. */
function Captions({ words, accent }: { words: TimedWord[]; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const groups = chunks(words);
  const group = groups.find((g, i) => t >= g[0].start - 0.05 && t < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.4));
  if (!group) return null;
  const since = (t - group[0].start) * fps;
  const pop = spring({ frame: Math.max(0, since), fps, config: { damping: 14, stiffness: 220, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 560 }}>
      <div
        style={{
          transform: `scale(${interpolate(pop, [0, 1], [0.82, 1])})`,
          maxWidth: 960,
          fontFamily: body,
          fontWeight: 900,
          fontSize: 92,
          lineHeight: 1.08,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {group.map((w, i) => {
          const active = t >= w.start && t < w.end + 0.08;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 14px",
                color: active ? accent : "#fff",
                transform: active ? "translateY(-6px)" : "none",
                WebkitTextStroke: "3px rgba(0,0,0,0.85)",
                paintOrder: "stroke fill",
                textShadow: "0 6px 24px rgba(0,0,0,0.75)",
              }}
            >
              {w.word.replace(/[.,!?;:]+$/, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** Music level: full in gaps, ducked under the voice, eased between, faded in and out. */
const MUSIC_FULL = 0.26;
const MUSIC_DUCKED = 0.08;

function musicVolume(t: number, words: TimedWord[], total: number): number {
  let gap = Infinity;
  for (const w of words) {
    if (t >= w.start - 0.1 && t <= w.end + 0.1) {
      gap = 0;
      break;
    }
    gap = Math.min(gap, Math.abs(t - w.start), Math.abs(t - w.end));
  }
  const level = MUSIC_DUCKED + (MUSIC_FULL - MUSIC_DUCKED) * Math.min(1, Math.max(0, (gap - 0.15) / 0.35));
  const fadeIn = Math.min(1, t / 0.8);
  const fadeOut = Math.min(1, Math.max(0, (total - t) / 1.5));
  return level * fadeIn * fadeOut;
}

/** Thin progress bar along the bottom, in the accent color. */
function Progress({ accent, total }: { accent: string; total: number }) {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 10, width: `${(frame / total) * 100}%`, background: accent }} />;
}

export function Short({ accent, voice, words, lines, assets, music, sfx, duration }: ShortProps) {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#050505" }}>
      {lines.map((l, i) => {
        const from = Math.round(l.start * fps);
        const frames = Math.max(1, Math.round(l.end * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={frames} name={`Line ${i + 1} · ${l.mode ?? "footage"}`}>
            <Shot inFx={lines[i - 1]?.transition ?? null} outFx={i < lines.length - 1 ? (l.transition ?? null) : null} frames={frames} accent={accent}>
              <Visual line={l} frames={frames} accent={accent} assets={assets} />
            </Shot>
          </Sequence>
        );
      })}
      {/* Readability: darker top and bottom, slight overall dim. */}
      <AbsoluteFill
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.75) 100%)" }}
      />
      {lines.map((l, i) => {
        const from = Math.round(l.start * fps);
        const frames = Math.max(1, Math.round(l.end * fps) - from);
        return l.onScreenText && l.mode !== "chart" && l.mode !== "text" ? (
          <Sequence key={`t${i}`} from={from} durationInFrames={frames} name={`Text ${i + 1}`}>
            <OnScreenText text={l.onScreenText} accent={accent} lineSeconds={frames / fps} />
          </Sequence>
        ) : null;
      })}
      <Captions words={words} accent={accent} />
      <Progress accent={accent} total={durationInFrames} />
      {voice && <Audio src={asset(assets, voice)} />}
      {music && <Audio src={asset(assets, music)} loop volume={(f) => musicVolume(f / fps, words, duration)} />}
      {(sfx ?? []).map((s, i) => (
        <Sequence key={`sfx${i}`} from={Math.round(s.at * fps)} name={`SFX ${s.file}`} layout="none">
          <Audio src={asset(assets, s.file)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
