import { ImageSquare } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { GenerateThumbnailsButton, ShortPicker, ThumbnailActions } from "@/components/thumbnails/thumbnail-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";
import { listShorts } from "@/lib/shorts";
import { FORMATS, listThumbnails, type Thumbnail, type ThumbnailFormat } from "@/lib/thumbnails/thumbnails";

export const metadata: Metadata = { title: "Thumbnails" };

export default function ThumbnailsPage({ searchParams }: PageProps<"/thumbnails">) {
  return (
    <>
      <PageHeader
        title="Thumbnails"
        description="Agnes Image 2.5 Flash draws the picture, PilotTube adds the headline. Make a few, choose the best."
      />
      {/* The chosen Short is in the URL (request-time data). */}
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        {searchParams.then((sp) => (
          <ThumbnailsContent requested={Number(Array.isArray(sp.short) ? sp.short[0] : sp.short)} />
        ))}
      </Suspense>
    </>
  );
}

async function ThumbnailsContent({ requested }: { requested: number }) {
  await connection();
  const shorts = listShorts(100);
  if (shorts.length === 0) {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Make a Short first, then come back to design its thumbnail.</p>
          <Button variant="outline" asChild>
            <Link href="/research">Find a story</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const short = shorts.find((s) => s.id === requested) ?? shorts[0];
  const thumbnails = listThumbnails(short.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <ShortPicker shorts={shorts.map((s) => ({ id: s.id, title: s.title }))} current={short.id} />
        <p className="text-sm text-muted-foreground">
          Headline on the thumbnail: <span className="text-foreground">&ldquo;{short.hook}&rdquo;</span>.{" "}
          <Link href={`/shorts/${short.id}`} className="underline decoration-border-strong underline-offset-2 hover:text-foreground">
            Open the Short
          </Link>
        </p>
      </div>

      {(Object.keys(FORMATS) as ThumbnailFormat[]).map((format) => (
        <FormatSection key={format} shortId={short.id} format={format} thumbnails={thumbnails.filter((t) => t.format === format)} />
      ))}

      <p className="max-w-[75ch] text-xs text-muted-foreground">
        YouTube shows custom Shorts thumbnails only on channels in the Partner Program, cropped to about 3:2. The 9:16 design also works as a strong first frame for
        the Short. The 16:9 version is for regular videos at 1280 by 720.
      </p>
    </div>
  );
}

function FormatSection({ shortId, format, thumbnails }: { shortId: number; format: ThumbnailFormat; thumbnails: Thumbnail[] }) {
  const isShort = format === "short";
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">{FORMATS[format].label}</CardTitle>
          <CardDescription>{isShort ? "1080 by 1920, for the Shorts cover and first frame" : "1280 by 720, for YouTube video thumbnails"}</CardDescription>
        </div>
        <GenerateThumbnailsButton shortId={shortId} format={format} label={thumbnails.length ? "Make 3 more" : "Make 3 options"} primary={thumbnails.length === 0} />
      </CardHeader>
      <CardContent>
        {thumbnails.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-8 text-sm text-muted-foreground">
            <ImageSquare className="size-5 shrink-0" />
            No {FORMATS[format].label} thumbnails yet. Each run makes 3 different picture ideas in about 40 seconds.
          </div>
        ) : (
          <ul className={`grid gap-4 ${isShort ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
            {thumbnails.map((t) => (
              <li key={t.id} className="flex flex-col gap-2">
                <a href={`/api/thumbnails/${t.id}/image`} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local generated JPG */}
                  <img
                    src={`/api/thumbnails/${t.id}/image`}
                    alt={`${t.concept}: ${t.headline}`}
                    loading="lazy"
                    className={`w-full rounded-xl bg-secondary object-cover ${isShort ? "aspect-[9/16]" : "aspect-video"} ${
                      t.selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border"
                    }`}
                  />
                </a>
                <div className="flex flex-col gap-1">
                  <span className="line-clamp-1 text-sm font-medium" title={t.prompt}>
                    {t.concept}
                  </span>
                  <span className="text-xs text-subtle">{timeAgo(t.createdAt)}</span>
                </div>
                <ThumbnailActions id={t.id} selected={t.selected} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
