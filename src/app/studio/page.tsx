import { DownloadSimple, FilmSlate } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clock, timeAgo } from "@/lib/format";
import { listShorts } from "@/lib/shorts";

export const metadata: Metadata = { title: "Video studio" };

export default function StudioPage() {
  return (
    <>
      <PageHeader title="Video studio" description="Every finished Short, ready to watch, download or publish." />
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton aspect-[9/16] rounded-xl" />
            ))}
          </div>
        }
      >
        <RenderedGrid />
      </Suspense>
    </>
  );
}

async function RenderedGrid() {
  await connection();
  const rendered = listShorts(200).filter((s) => s.renderedAt);

  if (rendered.length === 0) {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex flex-col items-start gap-3">
          <FilmSlate className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No rendered videos yet. Open a Short and press Render video.</p>
          <Button variant="outline" asChild>
            <Link href="/shorts">Open Shorts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {rendered.map((short) => {
        const v = encodeURIComponent(short.renderedAt!);
        return (
          <li key={short.id} className="flex flex-col gap-2">
            <video
              src={`/api/script/${short.id}/video?v=${v}`}
              poster={short.thumbUrl ?? undefined}
              controls
              playsInline
              preload="none"
              className="aspect-[9/16] w-full rounded-xl bg-card object-cover ring-1 ring-border"
            />
            <Link href={`/shorts/${short.id}`} className="line-clamp-2 text-sm font-medium hover:text-brand">
              {short.title}
            </Link>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-mono tabular-nums">{clock(short.duration)}</span> / {timeAgo(short.renderedAt!)}
              </span>
              <a href={`/api/script/${short.id}/video?download=1&v=${v}`} aria-label={`Download ${short.title}`} className="hover:text-foreground">
                <DownloadSimple className="size-4" />
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
