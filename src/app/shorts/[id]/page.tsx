import { ArrowLeft, ArrowSquareOut, DownloadSimple, FilmSlate, FilmStrip, Microphone, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ActionButton } from "@/components/action-button";
import { buttonStyles } from "@/components/button-styles";
import { MediaTile } from "@/components/media-tile";
import { RunPipelineButton } from "@/components/run-pipeline";
import { PreviewPlayer, PreviewProvider, SceneList, type PreviewData } from "@/components/short-preview";
import { StepTrack } from "@/components/step-track";
import { clock, parseDbDate, timeAgo } from "@/lib/format";
import { getShort, type ShortDetail } from "@/lib/shorts";

export default function ShortPage({ params }: PageProps<"/shorts/[id]">) {
  return (
    <Suspense fallback={<ShortSkeleton />}>
      {params.then(({ id }) => (
        <ShortView id={Number(id)} />
      ))}
    </Suspense>
  );
}

function previewData(short: ShortDetail): PreviewData {
  const base = `/api/script/${short.id}`;
  return {
    shortId: short.id,
    audioSrc: short.voiceover ? `${base}/audio?v=${encodeURIComponent(short.voiceover.createdAt)}` : null,
    duration: short.voiceover?.duration ?? short.duration,
    words: short.voiceover?.words ?? [],
    scenes: short.voiceover?.scenes ?? [],
    clips: short.script.scenes.map((_, i) => {
      const clip = short.clips.find((c) => c.sceneIndex === i);
      return clip ? { src: `${base}/clip/${i}?v=${clip.pexelsId}`, poster: `${base}/clip/${i}/poster?v=${clip.pexelsId}` } : null;
    }),
    cards: short.cards.map((c) => {
      const v = encodeURIComponent(c.createdAt);
      return { name: c.name, kind: c.kind, src: `${base}/card/${c.name}?v=${v}`, poster: `${base}/card/${c.name}/poster?v=${v}` };
    }),
  };
}

function Section({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-subtle">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

async function ShortView({ id }: { id: number }) {
  await connection();
  const short = Number.isInteger(id) ? getShort(id) : null;
  if (!short) notFound();

  const base = `/api/script/${short.id}`;
  const missing = (["voice", "clips", "cards", "render"] as const).filter((s) => !short.done.includes(s));
  const render = short.render;
  // A render is stale when the voice or cards were remade after it.
  const renderedAt = render ? parseDbDate(render.createdAt).getTime() : 0;
  const stale =
    render !== null &&
    [short.voiceover?.createdAt, ...short.cards.map((c) => c.createdAt)].some((t) => t && parseDbDate(t).getTime() > renderedAt);
  const canRender = Boolean(short.voiceover) && short.clips.length >= short.script.scenes.length;
  const lastScene = short.clips.length - 1;

  return (
    <PreviewProvider data={previewData(short)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <Link href="/shorts" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Scripts
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-[28px]">{short.title}</h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <a href={short.storyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  {short.source} <ArrowSquareOut size={13} />
                </a>
                <span>{timeAgo(short.createdAt)}</span>
                <span className="font-mono tabular-nums">{clock(short.duration)}</span>
                <span>{short.words} words</span>
              </p>
            </div>
            <RunPipelineButton shortId={short.id} missing={missing} />
          </div>
        </div>

        <StepTrack done={short.done} next={short.next} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <aside className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-8 flex flex-col gap-6">
              <PreviewPlayer />
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <h2 className="text-xs text-muted-foreground">YouTube details</h2>
                <p className="text-sm font-medium">{short.script.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{short.script.description}</p>
                <p className="text-sm text-brand">{short.script.hashtags.join(" ")}</p>
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-8 lg:col-span-7 xl:col-span-8">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Script</h2>
              <p className="text-xs text-muted-foreground">
                Written from{" "}
                <a href={short.storyUrl} target="_blank" rel="noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-foreground">
                  {short.storyTitle}
                </a>
                . Click a scene to jump the preview there.
              </p>
              <SceneList scenes={short.script.scenes} />
            </section>

            <Section
              title="Voice"
              icon={<Microphone size={16} />}
              action={
                <ActionButton endpoint={`${base}/voice`} pendingLabel="Making voice" icon={<Microphone size={16} />}>
                  {short.voiceover ? "Remake voice" : "Make voice"}
                </ActionButton>
              }
            >
              {short.voiceover ? (
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Length</dt>
                    <dd className="font-mono tabular-nums">{short.voiceover.duration.toFixed(1)}s</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Caption words</dt>
                    <dd className="font-mono tabular-nums">{short.voiceover.words.length}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Voice</dt>
                    <dd className="truncate font-mono text-xs leading-5">{short.voiceover.voice}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Deepgram Aura reads the script, then Nova times every word for the captions.</p>
              )}
            </Section>

            <Section
              title="Clips"
              icon={<FilmStrip size={16} />}
              action={
                <ActionButton endpoint={`${base}/footage`} pendingLabel="Finding clips" icon={<FilmStrip size={16} />}>
                  {short.clips.length ? "Find new clips" : "Find clips"}
                </ActionButton>
              }
            >
              {short.clips.length ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                  {short.clips.map((clip) => {
                    const v = clip.pexelsId;
                    const tooShort = clip.sceneDuration > 0 && clip.duration < clip.sceneDuration;
                    return (
                      <MediaTile
                        key={clip.sceneIndex}
                        poster={`${base}/clip/${clip.sceneIndex}/poster?v=${v}`}
                        video={`${base}/clip/${clip.sceneIndex}?v=${v}`}
                        label={`Scene ${clip.sceneIndex + 1}: ${clip.query}`}
                      >
                        <span className="truncate text-xs font-medium">{clip.query}</span>
                        <span className={`text-[11px] ${tooShort ? "text-destructive" : "text-subtle"}`}>
                          {clip.duration}s clip{tooShort ? ", will loop" : ""}
                        </span>
                        <a href={clip.pexelsUrl} target="_blank" rel="noreferrer" className="truncate text-[11px] text-subtle hover:text-foreground">
                          {clip.author}
                        </a>
                      </MediaTile>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  One vertical Pexels clip per scene, never reused within 30 days.
                  {!short.voiceover && " Make the voice first so clips match the real scene lengths."}
                </p>
              )}
            </Section>

            <Section
              title="Cards"
              icon={<Sparkle size={16} />}
              action={
                <ActionButton endpoint={`${base}/cards`} pendingLabel="Rendering cards" icon={<Sparkle size={16} />}>
                  {short.cards.length ? "Re-render cards" : "Render cards"}
                </ActionButton>
              }
            >
              {short.cards.length ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                  {short.cards.map((card, i) => {
                    const v = encodeURIComponent(card.createdAt);
                    const bgScene = short.clips.length === 0 ? null : card.kind === "hook" ? 0 : card.kind === "outro" ? lastScene : Math.min(i, Math.max(lastScene - 1, 0));
                    const bgClip = bgScene === null ? undefined : short.clips.find((c) => c.sceneIndex === bgScene);
                    const text = Object.entries(card.variables)
                      .filter(([k, val]) => k !== "accent" && val)
                      .map(([, val]) => val)
                      .join(", ");
                    return (
                      <MediaTile
                        key={card.name}
                        poster={`${base}/card/${card.name}/poster?v=${v}`}
                        video={`${base}/card/${card.name}?v=${v}`}
                        background={bgClip ? `${base}/clip/${bgClip.sceneIndex}/poster?v=${bgClip.pexelsId}` : undefined}
                        label={`${card.name} card: ${text}`}
                      >
                        <span className="text-xs font-medium capitalize">{card.name.replace("-", " ")}</span>
                        <span className="truncate text-[11px] text-subtle">{text}</span>
                      </MediaTile>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">HyperFrames renders the hook, stat and outro overlays from the script&apos;s card text, about a minute.</p>
              )}
            </Section>

            <Section
              title="Render"
              icon={<FilmSlate size={16} />}
              action={
                canRender && (
                  <ActionButton endpoint={`${base}/render`} pendingLabel="Rendering video" icon={<FilmSlate size={16} />} variant={render ? "secondary" : "primary"}>
                    {render ? "Re-render" : "Render video"}
                  </ActionButton>
                )
              }
            >
              {render ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
                  <video
                    src={`${base}/video?v=${encodeURIComponent(render.createdAt)}`}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-full rounded-xl bg-[#0b0b0d] ring-1 ring-border"
                  />
                  <div className="flex flex-col gap-4">
                    {stale && (
                      <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
                        The voice or cards changed after this render. Re-render to include them.
                      </p>
                    )}
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Length</dt>
                        <dd className="font-mono tabular-nums">{render.duration.toFixed(1)}s</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">File size</dt>
                        <dd className="font-mono tabular-nums">{(render.sizeBytes / 1024 / 1024).toFixed(1)} MB</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Render time</dt>
                        <dd className="font-mono tabular-nums">{clock(render.renderSeconds)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Rendered</dt>
                        <dd>{timeAgo(render.createdAt)}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">1080 by 1920, H.264, 30 fps, audio normalized to Shorts loudness.</p>
                    <a href={`${base}/video?download=1&v=${encodeURIComponent(render.createdAt)}`} className={`${buttonStyles.base} ${buttonStyles.secondary} w-fit`}>
                      <DownloadSimple size={16} /> Download MP4
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {canRender
                    ? "Remotion joins the clips, voice, captions and cards into the final 1080 by 1920 MP4. Takes a few minutes."
                    : "Make the voice and find clips first. Cards are optional but recommended."}
                </p>
              )}
            </Section>
          </div>
        </div>
      </div>
    </PreviewProvider>
  );
}

function ShortSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading Short">
      <div className="skeleton h-4 w-16 rounded" />
      <div className="skeleton h-8 w-2/3 rounded" />
      <div className="skeleton h-14 rounded-xl" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="skeleton mx-auto aspect-[9/16] w-full max-w-[340px] rounded-xl lg:col-span-5 xl:col-span-4" />
        <div className="flex flex-col gap-3 lg:col-span-7 xl:col-span-8">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
