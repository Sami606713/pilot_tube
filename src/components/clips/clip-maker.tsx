"use client";

import { ArrowClockwise, CircleNotch, DownloadSimple, FilmReel, Image as ImageIcon, Sparkle, Trash, UploadSimple, Warning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ago } from "@/components/run-steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Shape = "9:16" | "16:9";
type ClipView = {
  id: number;
  prompt: string;
  shape: Shape;
  seconds: number;
  model: string;
  picture: string | null;
  state: "waiting" | "making" | "done" | "failed";
  detail: string;
  progress: number;
  duration: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
type ScriptLines = { id: number; title: string; lines: { narration: string; visual: string }[] };
type ThumbChoice = { id: number; shape: Shape; concept: string };

const MODELS = { "agnes-video-2.5-flash": "Flash · 720p · free now", "agnes-video-2.5": "2.5 · 1080p · may cost" } as const;
const field = "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ClipMaker({ initial, scripts, thumbnails }: { initial: ClipView[]; scripts: ScriptLines[]; thumbnails: ThumbChoice[] }) {
  const router = useRouter();
  const [clips, setClips] = useState(initial);
  const [tab, setTab] = useState<"text" | "picture">("text");
  const [prompt, setPrompt] = useState("");
  const [shape, setShape] = useState<Shape>("9:16");
  const [seconds, setSeconds] = useState(6);
  const [model, setModel] = useState<keyof typeof MODELS>("agnes-video-2.5-flash");
  const [scriptId, setScriptId] = useState<number | "">("");
  const [thumbId, setThumbId] = useState<number | null>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = clips.some((c) => c.state === "waiting" || c.state === "making");
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(async () => {
      const res = await fetch("/api/clips");
      if (res.ok) setClips((await res.json()).clips);
    }, 4000);
    return () => clearTimeout(t);
  }, [active, clips]);

  async function make() {
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("prompt", prompt);
      form.set("shape", shape);
      form.set("seconds", String(seconds));
      form.set("model", model);
      if (tab === "picture") {
        if (upload) form.set("picture", upload);
        else if (thumbId) form.set("thumbnailId", String(thumbId));
        else throw new Error("Pick a thumbnail or upload a picture");
      }
      const res = await fetch("/api/clips", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setClips((c) => [data, ...c]);
      setPrompt("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function act(id: number, method: "POST" | "DELETE") {
    if (method === "DELETE" && !window.confirm("Delete this clip?")) return;
    setBusyId(id);
    const res = await fetch(`/api/clips/${id}`, { method });
    setBusyId(null);
    if (method === "DELETE") setClips((c) => c.filter((x) => x.id !== id));
    else if (res.ok) {
      const data = await res.json();
      setClips((c) => c.map((x) => (x.id === id ? data : x)));
    }
    router.refresh();
  }

  const script = scripts.find((s) => s.id === scriptId);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "text" | "picture")} className="gap-4">
            <TabsList>
              <TabsTrigger value="text">From text</TabsTrigger>
              <TabsTrigger value="picture">From a picture</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="flex flex-col gap-3">
              {scripts.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select value={scriptId} onChange={(e) => setScriptId(e.target.value ? Number(e.target.value) : "")} className={cn(field, "h-9 py-0 sm:max-w-xs")} aria-label="Script">
                    <option value="">Fill from a script line (optional)…</option>
                    {scripts.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.id} {s.title}
                      </option>
                    ))}
                  </select>
                  {script && (
                    <select onChange={(e) => e.target.value && setPrompt(script.lines[Number(e.target.value)].visual)} defaultValue="" className={cn(field, "h-9 py-0")} aria-label="Line">
                      <option value="">Pick a line…</option>
                      {script.lines.map((l, i) => (
                        <option key={i} value={i}>
                          {i + 1}. {l.narration.slice(0, 80)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="picture" className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">The picture becomes the first frame; Agnes brings it to life. Pick one of your thumbnails or upload an image.</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <label className={cn("grid h-28 w-20 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed text-center text-[11px] text-muted-foreground", upload ? "border-brand" : "border-border")}>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => (setUpload(e.target.files?.[0] ?? null), setThumbId(null))} />
                  <span className="flex flex-col items-center gap-1 px-1">
                    <UploadSimple className="size-4" /> {upload ? upload.name.slice(0, 14) : "Upload"}
                  </span>
                </label>
                {thumbnails.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => (setThumbId(t.id), setUpload(null), setShape(t.shape))}
                    aria-pressed={thumbId === t.id}
                    title={t.concept}
                    className={cn("h-28 shrink-0 overflow-hidden rounded-lg border-2", thumbId === t.id ? "border-brand" : "border-transparent opacity-80 hover:opacity-100", t.shape === "9:16" ? "w-16" : "w-48")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local generated image */}
                    <img src={`/api/thumbnails/${t.id}/image`} alt={t.concept} className="size-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {tab === "picture" ? "How should it move?" : "Describe the clip"}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={800}
              placeholder={tab === "picture" ? "e.g. the chip slowly rotates while light pulses through its circuits" : "e.g. slow cinematic push-in on a glowing blue AI chip in a dark server room"}
              className={cn(field, "sm:max-w-3xl")}
            />
          </label>

          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Shape</span>
              <div role="radiogroup" aria-label="Shape" className="inline-flex rounded-lg border border-border p-0.5">
                {(["9:16", "16:9"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={shape === s} onClick={() => setShape(s)} className={cn("rounded-md px-3 py-1 text-sm", shape === s ? "bg-muted" : "text-muted-foreground hover:text-foreground")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Length: <span className="font-mono text-foreground tabular-nums">{seconds}s</span>
              <input type="range" min={4} max={12} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-40 accent-[var(--brand)]" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Model
              <select value={model} onChange={(e) => setModel(e.target.value as keyof typeof MODELS)} className={cn(field, "h-9 py-0")}>
                {Object.entries(MODELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={make} disabled={pending || prompt.trim().length < 5}>
              {pending ? <CircleNotch className="animate-spin" /> : <Sparkle />} Make clip
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Agnes&apos;s free queue is often full: PilotTube keeps trying for up to 40 minutes. A clip usually takes 3-8 minutes. You can leave this page.
          </p>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
              <Warning className="size-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Clip library ({clips.length})</h2>
        {clips.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
              <FilmReel className="size-5 text-subtle" /> No clips yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {clips.map((c) => (
              <figure key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
                <div className={cn("relative overflow-hidden rounded-lg bg-black", c.shape === "9:16" ? "aspect-[9/16]" : "aspect-video")}>
                  {c.state === "done" ? (
                    <video
                      src={`/api/clips/${c.id}/file?v=${encodeURIComponent(c.updatedAt)}`}
                      poster={`/api/clips/${c.id}/file?poster=1`}
                      controls
                      loop
                      playsInline
                      preload="none"
                      className="size-full object-cover"
                    />
                  ) : (
                    <>
                      {c.picture && (
                        // eslint-disable-next-line @next/next/no-img-element -- first-frame source
                        <img src={`/api/clips/${c.id}/file?picture=1`} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                        {c.state === "failed" ? <Warning className="size-6 text-destructive" /> : <CircleNotch className="size-6 animate-spin text-brand" />}
                        <span className="text-xs">{c.state === "failed" ? "Failed" : c.detail}</span>
                        {c.state === "making" && (
                          <div className="h-1.5 w-3/4 overflow-hidden rounded bg-white/20">
                            <div className="h-full bg-brand" style={{ width: `${c.progress}%` }} />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <figcaption className="flex flex-col gap-0.5 px-1">
                  <span className="line-clamp-2 text-xs" title={c.prompt}>
                    {c.picture && <ImageIcon className="mr-1 inline size-3 text-subtle" />}
                    {c.prompt}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.shape} · {c.duration ? `${c.duration.toFixed(1)}s` : `${c.seconds}s`} · {ago(c.createdAt)}
                  </span>
                  {c.error && <span className="text-[11px] text-destructive">{c.error}</span>}
                </figcaption>
                <div className="flex gap-1">
                  {c.state === "done" && (
                    <Button size="sm" variant="outline" className="flex-1" asChild>
                      <a href={`/api/clips/${c.id}/file?download=1`}>
                        <DownloadSimple /> Download
                      </a>
                    </Button>
                  )}
                  {c.state === "failed" && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => act(c.id, "POST")} disabled={busyId === c.id}>
                      <ArrowClockwise /> Retry
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => act(c.id, "DELETE")} disabled={busyId === c.id} aria-label="Delete clip" className={c.state === "waiting" || c.state === "making" ? "ml-auto" : ""}>
                    <Trash />
                  </Button>
                </div>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
