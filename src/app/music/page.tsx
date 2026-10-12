import { ArrowSquareOut, MusicNotes } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { TrackRow } from "@/components/music/track-row";
import { UploadTrack } from "@/components/music/upload-track";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTracks, MOODS } from "@/lib/music/library";

export const metadata: Metadata = { title: "Music" };

export default function MusicPage() {
  return (
    <>
      <PageHeader title="Music" description="Copyright-safe background music for your Shorts, picked by the mood of each script." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <Suspense fallback={<div className="skeleton h-64 rounded-xl" aria-busy="true" />}>
            <Library />
          </Suspense>
        </div>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add a track</CardTitle>
              <CardDescription>Upload music you downloaded from the YouTube Audio Library.</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadTrack />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Getting safe music</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5">
                <li>Open the YouTube Audio Library in YouTube Studio.</li>
                <li>Filter by &ldquo;Attribution not required&rdquo; so no credit is needed.</li>
                <li>Download a track, then add it here with its mood.</li>
              </ol>
              <p>Audio Library music won&apos;t get Content ID claims on YouTube and works in monetized videos. Creative Commons tracks must be credited in the description; PilotTube shows the credit on each Short.</p>
              <a href="https://www.youtube.com/audiolibrary" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 font-medium text-foreground hover:text-brand">
                Open the Audio Library <ArrowSquareOut className="size-4" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

async function Library() {
  await connection();
  const tracks = listTracks();
  if (tracks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <MusicNotes className="size-5" />
          </span>
          <p className="font-medium">Your music library is empty</p>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Add a few tracks in different moods (about 2 per mood is plenty). PilotTube then reads each script and picks a matching track automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {MOODS.filter((m) => tracks.some((t) => t.mood === m)).map((mood) => (
        <Card key={mood}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{mood}</CardTitle>
            <CardDescription>{tracks.filter((t) => t.mood === mood).length} tracks</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {tracks
                .filter((t) => t.mood === mood)
                .map((t) => (
                  <TrackRow key={t.id} track={{ id: t.id, title: t.title, artist: t.artist, mood: t.mood, license: t.license, duration: t.duration, usedBy: t.usedBy }} />
                ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
