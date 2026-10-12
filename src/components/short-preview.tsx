"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clock } from "@/lib/format";
import { MOVES } from "@/remotion/moves";
import { captionPages, cardSchedule, indexAt, type CardKind, type SceneTiming, type TimedWord } from "@/lib/timeline";

export type PreviewData = {
  shortId: number;
  audioSrc: string | null;
  duration: number;
  words: TimedWord[];
  scenes: SceneTiming[];
  /** Per scene index: the scene's picture (or old stock clip) + poster URLs, or null when it has none yet. */
  visuals: ({ kind: "image" | "video"; src: string; poster: string } | null)[];
  cards: { name: string; kind: CardKind; src: string; poster: string }[];
};

type PreviewState = {
  data: PreviewData;
  playing: boolean;
  time: number;
  sceneIndex: number;
  toggle: () => void;
  seek: (t: number) => void;
};

const PreviewContext = createContext<PreviewState | null>(null);

function usePreview() {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used inside <PreviewProvider>");
  return ctx;
}

/**
 * Owns the voiceover <audio> as the master clock. Time is read in a rAF loop but React state
 * only changes when the caption page / scene / card actually changes (a few times a second).
 */
export function PreviewProvider({ data, children }: { data: PreviewData; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  const pages = useMemo(() => captionPages(data.words), [data.words]);
  const slots = useMemo(() => cardSchedule(data.cards, data.scenes, data.duration), [data.cards, data.scenes, data.duration]);
  const lastKey = useRef("");

  const sync = useCallback(
    (t: number) => {
      // Re-render on word changes too, so the active caption word lights up.
      const word = indexAt(data.words, t);
      const key = `${indexAt(data.scenes, t)}|${indexAt(pages, t)}|${word}|${indexAt(slots, t)}|${Math.floor(t * 4)}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        setTime(t);
      }
    },
    [data.scenes, data.words, pages, slots],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const loop = () => {
      const audio = audioRef.current;
      if (audio) sync(audio.currentTime);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, sync]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  const seek = useCallback(
    (t: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = t;
      sync(t);
    },
    [sync],
  );

  const sceneIndex = Math.max(indexAt(data.scenes, time), 0);
  const value = useMemo(() => ({ data, playing, time, sceneIndex, toggle, seek }), [data, playing, time, sceneIndex, toggle, seek]);

  return (
    <PreviewContext.Provider value={value}>
      {data.audioSrc && (
        <audio
          ref={audioRef}
          src={data.audioSrc}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            sync(0);
          }}
          className="hidden"
        />
      )}
      {children}
    </PreviewContext.Provider>
  );
}

/**
 * One scene's picture with the same camera move the render uses, started at the right offset.
 * Driven by the Web Animations API on the element, so no React state changes per frame.
 */
function SceneImage({ src, move, offset, duration, playing }: { src: string; move: number; offset: number; duration: number; playing: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = MOVES[move % MOVES.length];
    const frame = (p: { scale: number; x: number }) => ({ transform: `scale(${p.scale}) translateX(${p.x}%)` });
    const anim = el.animate([frame(m.from), frame(m.to)], { duration: Math.max(duration, 0.1) * 1000, fill: "forwards", easing: "linear" });
    anim.currentTime = Math.max(offset, 0) * 1000;
    if (!playing) anim.pause();
    return () => anim.cancel();
    // Re-sync only when play state flips; offset is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  // eslint-disable-next-line @next/next/no-img-element -- local generated scene picture
  return <img ref={ref} src={src} alt="" className="absolute inset-0 size-full object-cover" />;
}

/** One scene's clip (older Shorts). Mounted fresh per scene so it starts at the right offset. */
function SceneVideo({ src, poster, offset, playing }: { src: string; poster: string; offset: number; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const start = () => {
      video.currentTime = video.duration ? offset % video.duration : offset;
      if (playing) void video.play().catch(() => {});
    };
    if (video.readyState >= 1) start();
    else video.addEventListener("loadedmetadata", start, { once: true });
    return () => video.removeEventListener("loadedmetadata", start);
    // Only re-sync when play state flips; offset is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  return <video ref={ref} src={src} poster={poster} muted playsInline loop preload="auto" className="absolute inset-0 size-full object-cover" />;
}

export function PreviewPlayer() {
  const { data, playing, time, sceneIndex, toggle, seek } = usePreview();
  const pages = useMemo(() => captionPages(data.words), [data.words]);
  const slots = useMemo(() => cardSchedule(data.cards, data.scenes, data.duration), [data.cards, data.scenes, data.duration]);

  const scene = data.scenes[sceneIndex];
  const visual = data.visuals[sceneIndex] ?? data.visuals[0] ?? null;
  const page = pages[indexAt(pages, time)];
  const slot = slots[indexAt(slots, time)];
  const card = slot ? data.cards.find((c) => c.name === slot.name) : undefined;
  const hasAudio = Boolean(data.audioSrc);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-xl bg-[#0b0b0d] ring-1 ring-border">
        {visual ? (
          visual.kind === "image" ? (
            <SceneImage
              key={sceneIndex}
              src={visual.src}
              move={sceneIndex}
              offset={time - (scene?.start ?? 0)}
              duration={scene ? scene.end - scene.start : 4}
              playing={playing}
            />
          ) : playing ? (
            <SceneVideo key={sceneIndex} src={visual.src} poster={visual.poster} offset={time - (scene?.start ?? 0)} playing={playing} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local 270px poster
            <img src={visual.poster} alt="" className="absolute inset-0 size-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-[#a6a6b0]">Make the scene images to see pictures here</div>
        )}

        {card &&
          slot &&
          (playing ? (
            <video key={card.name} src={card.src} muted playsInline autoPlay className="absolute inset-0 size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- transparent card still
            <img src={card.poster} alt="" className="absolute inset-0 size-full object-cover" />
          ))}

        {/* Captions sit in the lower-middle, clear of the cards above and the Shorts UI below. */}
        {page && !(slot?.kind === "outro") && (
          <p className="absolute inset-x-5 top-[60%] text-center text-[22px] font-extrabold uppercase leading-tight tracking-tight text-white [text-shadow:0_2px_0_#000,0_0_12px_rgba(0,0,0,0.6)] [-webkit-text-stroke:1px_#000]">
            {page.words.map((w, i) => (
              <span key={i} className={time >= w.start && time < w.end + 0.05 ? "text-[#7cff6b]" : ""}>
                {w.word}{" "}
              </span>
            ))}
          </p>
        )}

        {!hasAudio && (
          <div className="absolute inset-x-4 bottom-4 rounded-lg bg-black/70 px-3 py-2 text-center text-xs text-white/80 backdrop-blur">
            Make the voice to play the preview
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[340px] items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!hasAudio}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
        </button>
        <input
          type="range"
          min={0}
          max={data.duration || 1}
          step={0.05}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!hasAudio}
          aria-label="Seek"
          className="h-1 flex-1 cursor-pointer accent-[var(--primary)] disabled:cursor-default"
        />
        <span className="shrink-0 whitespace-nowrap text-right font-mono text-xs tabular-nums text-muted-foreground">
          {clock(time)} / {clock(data.duration)}
        </span>
      </div>
    </div>
  );
}

/** Scene list that follows playback; click a scene to jump to it. */
export function SceneList({ scenes }: { scenes: { narration: string; visual: string }[] }) {
  const { data, time, sceneIndex, seek, playing } = usePreview();
  const hasTimings = data.scenes.length === scenes.length && Boolean(data.audioSrc);

  return (
    <ol className="flex flex-col">
      {scenes.map((scene, i) => {
        const timing = data.scenes[i];
        const active = hasTimings && i === sceneIndex && (playing || time > 0);
        const clip = data.visuals[i];
        return (
          <li key={i}>
            <button
              type="button"
              disabled={!hasTimings}
              onClick={() => timing && seek(timing.start + 0.01)}
              className={`grid w-full grid-cols-[2rem_1fr_auto] items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors enabled:hover:bg-secondary/70 ${
                active ? "bg-secondary" : ""
              }`}
            >
              <span className={`pt-0.5 font-mono text-xs tabular-nums ${active ? "text-brand" : "text-subtle"}`}>
                {hasTimings && timing ? clock(timing.start) : String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm leading-relaxed text-foreground">{scene.narration}</span>
                <span className="line-clamp-2 text-[11px] text-subtle">{scene.visual}</span>
              </span>
              {clip ? (
                // eslint-disable-next-line @next/next/no-img-element -- local 270px poster
                <img src={clip.poster} alt="" loading="lazy" className="aspect-[9/16] w-8 rounded object-cover ring-1 ring-border" />
              ) : (
                <span className="w-8" />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
