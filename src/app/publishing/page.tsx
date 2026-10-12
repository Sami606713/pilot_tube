import { ArrowSquareOut, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PublishSheet } from "@/components/publish/publish-sheet";
import { UploadActions } from "@/components/publish/upload-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clock, timeAgo } from "@/lib/format";
import { getShortMusic } from "@/lib/music/short-music";
import { listUploads, uploadStats, type Upload, type VideoNumbers } from "@/lib/publish/youtube";
import { getRender } from "@/lib/render/render";
import { listShorts, type ShortSummary } from "@/lib/shorts";

export const metadata: Metadata = { title: "Publishing" };

export default function PublishingPage() {
  return (
    <>
      <PageHeader title="Publishing" description="Send finished Shorts to YouTube now, or schedule them. YouTube handles the go-live time." />
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        <PublishingContent />
      </Suspense>
    </>
  );
}

/** "in 5h 20m" / "in 2 days" until an ISO time. */
function timeUntil(iso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
  if (mins < 60) return `in ${mins}m`;
  if (mins < 48 * 60) return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `in ${Math.round(mins / 1440)} days`;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const compact = new Intl.NumberFormat("en", { notation: "compact" });

async function PublishingContent() {
  await connection();
  const shorts = listShorts(200);
  const byId = new Map(shorts.map((s) => [s.id, s]));
  const uploads = listUploads();
  const uploaded = new Set(uploads.map((u) => u.scriptId));
  const ready = shorts.filter((s) => s.done.includes("render") && !uploaded.has(s.id));
  const scheduled = uploads.filter((u) => u.state === "scheduled").sort((a, b) => Date.parse(a.publishAt!) - Date.parse(b.publishAt!));
  const published = uploads.filter((u) => u.state !== "scheduled");

  let stats = new Map<string, VideoNumbers>();
  let statsError: string | null = null;
  if (published.length) {
    try {
      stats = await uploadStats(published.map((u) => u.videoId));
    } catch (err) {
      statsError = (err as Error).message;
    }
  }

  return (
    <Tabs defaultValue="ready" className="gap-6">
      <TabsList>
        <TabsTrigger value="ready">Ready ({ready.length})</TabsTrigger>
        <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
        <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="ready" className="flex flex-col gap-3">
        {ready.length === 0 ? (
          <Empty text="No rendered Shorts waiting. Render a Short on its page and it shows up here." />
        ) : (
          ready.map((s) => <ReadyRow key={s.id} short={s} />)
        )}
      </TabsContent>

      <TabsContent value="scheduled" className="flex flex-col gap-3">
        {scheduled.length === 0 ? (
          <Empty text="Nothing scheduled. Use Schedule on a ready Short to pick a go-live time." />
        ) : (
          scheduled.map((u) => (
            <UploadRow key={u.scriptId} upload={u} short={byId.get(u.scriptId)}>
              <span className="font-medium text-foreground">Goes live {timeUntil(u.publishAt!)}</span>
              <span>{when(u.publishAt!)}</span>
            </UploadRow>
          ))
        )}
      </TabsContent>

      <TabsContent value="published" className="flex flex-col gap-3">
        {statsError && <p className="text-sm text-muted-foreground">Views are unavailable right now: {statsError}</p>}
        {published.length === 0 ? (
          <Empty text="Nothing published from PilotTube yet." />
        ) : (
          published.map((u) => {
            const n = stats.get(u.videoId);
            return (
              <UploadRow key={u.scriptId} upload={u} short={byId.get(u.scriptId)}>
                <span>Uploaded {timeAgo(u.createdAt)}</span>
                {n && (
                  <span className="font-mono tabular-nums">
                    {compact.format(n.views)} views · {compact.format(n.likes)} likes · {compact.format(n.comments)} comments
                  </span>
                )}
              </UploadRow>
            );
          })
        )}
      </TabsContent>
    </Tabs>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <PaperPlaneTilt className="size-5" />
        </span>
        <p className="max-w-[60ch] text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function Thumb({ short }: { short?: ShortSummary }) {
  return short?.thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- local generated poster
    <img src={short.thumbUrl} alt="" loading="lazy" className="aspect-[9/16] w-16 shrink-0 rounded-lg object-cover ring-1 ring-border" />
  ) : (
    <div className="aspect-[9/16] w-16 shrink-0 rounded-lg bg-muted ring-1 ring-border" />
  );
}

function ReadyRow({ short }: { short: ShortSummary }) {
  const render = getRender(short.id);
  const { track } = getShortMusic(short.id);
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Thumb short={short} />
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/shorts/${short.id}`} className="truncate font-medium hover:text-brand">
              {short.title}
            </Link>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {render && <span className="font-mono tabular-nums">{clock(render.duration)}</span>}
              {short.renderedAt && <span>Rendered {timeAgo(short.renderedAt)}</span>}
              <span>Music: {track ? <span className="capitalize">{track.mood}</span> : "none"}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <PublishSheet shortId={short.id} title={short.title} />
          <PublishSheet shortId={short.id} title={short.title} schedule />
        </div>
      </CardContent>
    </Card>
  );
}

const STATE_LABEL: Record<Upload["state"], string> = { scheduled: "Scheduled", live: "Public", private: "Private", unlisted: "Unlisted" };

function UploadRow({ upload, short, children }: { upload: Upload; short?: ShortSummary; children: React.ReactNode }) {
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Thumb short={short} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <Link href={`/shorts/${upload.scriptId}`} className="truncate font-medium hover:text-brand">
                {upload.title}
              </Link>
              <Badge variant={upload.state === "live" ? "default" : "secondary"} className="h-5 shrink-0 text-[10px]">
                {STATE_LABEL[upload.state]}
              </Badge>
            </span>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{children}</p>
            <a href={upload.url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Open on YouTube <ArrowSquareOut className="size-3.5" />
            </a>
          </div>
        </div>
        <UploadActions shortId={upload.scriptId} state={upload.state} publishAt={upload.publishAt} />
      </CardContent>
    </Card>
  );
}
