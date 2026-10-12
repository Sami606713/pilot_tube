"use client";

import { CircleNotch, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MOODS = ["tense", "dramatic", "upbeat", "inspiring", "techy", "chill"];

type TrackView = { id: number; title: string; artist: string | null; mood: string; license: "standard" | "cc"; duration: number; usedBy: number };

const length = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function TrackRow({ track }: { track: TrackView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setMood(mood: string) {
    setBusy(true);
    await fetch(`/api/music/${track.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mood }) });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    const note = track.usedBy ? ` ${track.usedBy} Short(s) using it will switch to no music.` : "";
    if (!window.confirm(`Delete "${track.title}"?${note}`)) return;
    setBusy(true);
    await fetch(`/api/music/${track.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <li className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)_auto] md:items-center">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{track.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {track.artist && <span>{track.artist}</span>}
          <span className="font-mono tabular-nums">{length(track.duration)}</span>
          <Badge variant={track.license === "cc" ? "outline" : "secondary"} className="h-5 text-[10px]">
            {track.license === "cc" ? "Credit required" : "No credit needed"}
          </Badge>
          {track.usedBy > 0 && <span>Used in {track.usedBy} Short{track.usedBy > 1 ? "s" : ""}</span>}
        </span>
      </div>
      <audio src={`/api/music/${track.id}/audio`} controls preload="none" className="h-9 w-full" />
      <div className="flex items-center gap-1">
        <Select value={track.mood} onValueChange={setMood} disabled={busy}>
          <SelectTrigger className="w-32 capitalize" aria-label={`Mood of ${track.title}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOODS.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" onClick={remove} disabled={busy} aria-label={`Delete ${track.title}`}>
          {busy ? <CircleNotch className="animate-spin" /> : <Trash />}
        </Button>
      </div>
    </li>
  );
}
