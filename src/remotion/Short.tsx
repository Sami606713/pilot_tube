import { loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MOVES } from "./moves";
import { FPS, type ShortProps } from "./types";

const { fontFamily } = loadFont("normal", { weights: ["800", "900"], subsets: ["latin"] });

const toFrame = (seconds: number) => Math.round(seconds * FPS);

const SceneImage: React.FC<{ src: string; move: number }> = ({ src, move }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const m = MOVES[move % MOVES.length];
  const t = (from: number, to: number) => interpolate(frame, [0, durationInFrames], [from, to], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ transform: `scale(${t(m.from.scale, m.to.scale)}) translateX(${t(m.from.x, m.to.x)}%)` }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};

/** One stock clip (older Shorts), slowed down if it is shorter than its scene, with a slow push-in for motion. */
const SceneClip: React.FC<{ clip: string; clipDuration: number; sceneDuration: number }> = ({ clip, clipDuration, sceneDuration }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const needed = sceneDuration + 0.2;
  const playbackRate = clipDuration < needed ? Math.max(clipDuration / needed, 0.5) : 1;
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <OffthreadVideo src={staticFile(clip)} muted playbackRate={playbackRate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};

/** Word-by-word captions: one short page at a time, the spoken word in the accent color. */
const Captions: React.FC<{ pages: ShortProps["captions"]; accent: string; hiddenFrom: number }> = ({ pages, accent, hiddenFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t >= hiddenFrom) return null;

  const page = pages.find((p) => t >= p.start && t < p.end);
  if (!page) return null;

  const pop = spring({ frame: frame - toFrame(page.start), fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 1130, paddingLeft: 80, paddingRight: 150 }}>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 84,
          lineHeight: 1.08,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          textAlign: "center",
          color: "#ffffff",
          WebkitTextStroke: "14px #0b0b0d",
          paintOrder: "stroke fill",
          textShadow: "0 8px 24px rgba(0,0,0,0.45)",
          transform: `scale(${interpolate(pop, [0, 1], [0.86, 1])})`,
        }}
      >
        {page.words.map((w, i) => (
          <span key={i} style={{ color: t >= w.start && t < w.end + 0.05 ? accent : undefined }}>
            {w.word}{" "}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Music sits low under the voice and comes up in the pauses; changes ease over ~0.35s instead of jumping.
const MUSIC_FULL = 0.28;
const MUSIC_DUCKED = 0.09;
const DUCK_EASE = 0.35;

function musicVolume(t: number, speech: { start: number; end: number }[], duration: number): number {
  let gap = Infinity;
  for (const r of speech) gap = Math.min(gap, t < r.start ? r.start - t : t > r.end ? t - r.end : 0);
  const level = MUSIC_DUCKED + (MUSIC_FULL - MUSIC_DUCKED) * Math.min(gap / DUCK_EASE, 1);
  const fade = Math.min(t / 1, (duration + 0.4 - t) / 1.5, 1);
  return Math.max(0, level * Math.max(0, fade));
}

export const Short: React.FC<ShortProps> = ({ duration, voice, accent, scenes, captions, cards, music }) => {
  const outro = cards.find((c) => c.kind === "outro");

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      {scenes.map((scene, i) => (
        <Sequence key={i} from={toFrame(scene.start)} durationInFrames={Math.max(toFrame(scene.end) - toFrame(scene.start), 1)} name={`Scene ${i + 1}`}>
          {scene.media.kind === "image" ? (
            <SceneImage src={scene.media.src} move={i} />
          ) : (
            <SceneClip clip={scene.media.src} clipDuration={scene.media.duration ?? scene.end - scene.start} sceneDuration={scene.end - scene.start} />
          )}
        </Sequence>
      ))}

      {/* Soft darkening top and bottom so white text reads on any footage. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 72%, rgba(0,0,0,0.15) 100%)",
        }}
      />

      <Captions pages={captions} accent={accent} hiddenFrom={outro ? outro.start : duration + 1} />

      {cards.map((card, i) => (
        <Sequence key={i} from={toFrame(card.start)} durationInFrames={Math.max(toFrame(card.end) - toFrame(card.start), 1)} name={`Card ${card.kind}`}>
          <OffthreadVideo src={staticFile(card.src)} transparent muted style={{ width: "100%", height: "100%" }} />
        </Sequence>
      ))}

      {voice && <Audio src={staticFile(voice)} />}
      {music && <Audio src={staticFile(music.src)} loop volume={(f) => musicVolume(f / FPS, music.speech, duration)} />}
    </AbsoluteFill>
  );
};
