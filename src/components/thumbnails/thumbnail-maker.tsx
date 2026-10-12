"use client";

import { CheckCircle, CircleNotch, DownloadSimple, ImageSquare, Sparkle, Trash, Warning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Shape = "9:16" | "16:9";
type Thumb = { id: number; scriptId: number | null; title: string; shape: Shape; concept: string; headline: string | null; selected: boolean; createdAt: string };
type VideoChoice = { id: number; title: string };

const field = "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function ShapePicker({ value, onChange }: { value: Shape; onChange: (s: Shape) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Shape</span>
      <div role="radiogroup" aria-label="Shape" className="inline-flex w-fit rounded-lg border border-border p-0.5">
        {(["9:16", "16:9"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className={cn("rounded-md px-3 py-1 text-sm", value === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {s === "9:16" ? "9:16 Short" : "16:9 YouTube"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThumbnailMaker({ videos, thumbnails }: { videos: VideoChoice[]; thumbnails: Thumb[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"video" | "custom">("video");
  const [scriptId, setScriptId] = useState<number | null>(videos[0]?.id ?? null);
  const [prompt, setPrompt] = useState("");
  const [headline, setHeadline] = useState("");
  const [shape, setShape] = useState<Shape>("9:16");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function make() {
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const body = tab === "video" ? { scriptId, shape, headline } : { prompt, shape, headline };
      const res = await fetch("/api/thumbnails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (data.failed) setNote(`${data.made} made, ${data.failed} failed (Agnes was busy). Try again for more.`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function act(id: number, method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !window.confirm("Delete this thumbnail?")) return;
    setBusyId(id);
    await fetch(`/api/thumbnails/${id}`, { method });
    setBusyId(null);
    router.refresh();
  }

  const shown = thumbnails.filter((t) => (tab === "video" ? t.scriptId !== null && t.scriptId === scriptId : t.scriptId === null));
  const canMake = !pending && (tab === "video" ? scriptId !== null : prompt.trim().length >= 5);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "video" | "custom")} className="gap-5">
            <TabsList>
              <TabsTrigger value="video">For a video</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="video" className="flex flex-col gap-4">
              {videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No finished scripts yet. Write one on the Scripts page first.</p>
              ) : (
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Video
                  <select value={scriptId ?? ""} onChange={(e) => setScriptId(Number(e.target.value))} className={cn(field, "h-9 py-0 sm:max-w-md")}>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        #{v.id} {v.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-xs text-muted-foreground">Agnes reads the video&apos;s script and draws 3 different, clear pictures of what it is about.</p>
            </TabsContent>

            <TabsContent value="custom" className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Describe the picture
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. a glowing AI computer chip on a dark desk with blue light"
                  className={cn(field, "sm:max-w-2xl")}
                />
              </label>
              <p className="text-xs text-muted-foreground">Agnes keeps your idea and makes 3 versions with different angles and lighting.</p>
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex flex-wrap items-end gap-6">
            <ShapePicker value={shape} onChange={setShape} />
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Text on it (optional)
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} placeholder="e.g. ESCAPE NVIDIA" className="w-64" />
            </label>
            <Button onClick={make} disabled={!canMake}>
              {pending ? <CircleNotch className="animate-spin" /> : <Sparkle />} {pending ? "Drawing 3 thumbnails…" : "Make 3 thumbnails"}
            </Button>
          </div>
          {pending && <p className="mt-3 text-xs text-muted-foreground">Usually 30-60 seconds.</p>}
          {note && <p className="mt-3 text-xs text-amber-400">{note}</p>}
          {error && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <Warning className="size-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {tab === "video" ? "Thumbnails for this video" : "Custom thumbnails"} ({shown.length})
        </h2>
        {shown.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
              <ImageSquare className="size-5 text-subtle" /> None yet. Press Make 3 thumbnails.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((t) => (
              <figure key={t.id} className={cn("flex flex-col gap-2 rounded-xl border p-2", t.selected ? "border-brand bg-brand-soft" : "border-border bg-card")}>
                <a href={`/api/thumbnails/${t.id}/image`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated local image */}
                  <img
                    src={`/api/thumbnails/${t.id}/image?v=${encodeURIComponent(t.createdAt)}`}
                    alt={t.concept}
                    loading="lazy"
                    className={cn("w-full object-cover", t.shape === "9:16" ? "aspect-[9/16]" : "aspect-video")}
                  />
                </a>
                <figcaption className="flex flex-col gap-0.5 px-1">
                  <span className="truncate text-sm">{t.concept}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.shape}
                    {t.headline ? ` · "${t.headline}"` : " · no text"}
                    {t.selected && <span className="text-brand"> · chosen</span>}
                  </span>
                </figcaption>
                <div className="flex gap-1">
                  <Button size="sm" variant={t.selected ? "default" : "outline"} className="flex-1" onClick={() => act(t.id, "PATCH")} disabled={busyId === t.id}>
                    {busyId === t.id ? <CircleNotch className="animate-spin" /> : <CheckCircle />} {t.selected ? "Chosen" : "Choose"}
                  </Button>
                  <Button size="sm" variant="ghost" asChild aria-label="Download">
                    <a href={`/api/thumbnails/${t.id}/image?download=1`}>
                      <DownloadSimple />
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => act(t.id, "DELETE")} disabled={busyId === t.id} aria-label="Delete">
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
