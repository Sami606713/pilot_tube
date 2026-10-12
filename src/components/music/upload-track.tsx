"use client";

import { CircleNotch, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MOODS = ["tense", "dramatic", "upbeat", "inspiring", "techy", "chill"];

/** Add a track downloaded from the YouTube Audio Library. */
export function UploadTrack() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [mood, setMood] = useState("techy");
  const [license, setLicense] = useState<"standard" | "cc">("standard");
  const [attribution, setAttribution] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseFile(f: File | null) {
    setFile(f);
    // Audio Library files are named after the track, so use that as a starting title.
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose an audio file");
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("title", title);
    form.set("artist", artist);
    form.set("mood", mood);
    form.set("license", license);
    form.set("attribution", license === "cc" ? attribution : "");
    try {
      const res = await fetch("/api/music", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      setFile(null);
      setTitle("");
      setArtist("");
      setAttribution("");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const label = "text-xs font-medium text-muted-foreground";
  return (
    <form onSubmit={upload} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="track-file" className={label}>Audio file (MP3, M4A, WAV or OGG, up to 25 MB)</label>
        <Input id="track-file" type="file" accept=".mp3,.m4a,.wav,.ogg,audio/*" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="track-title" className={label}>Title</label>
        <Input id="track-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="track-artist" className={label}>Artist (optional)</label>
        <Input id="track-artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>Mood</span>
        <Select value={mood} onValueChange={setMood}>
          <SelectTrigger className="w-full capitalize" aria-label="Mood">
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
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>License in the Audio Library</span>
        <Select value={license} onValueChange={(v) => setLicense(v as "standard" | "cc")}>
          <SelectTrigger className="w-full" aria-label="License">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Attribution not required</SelectItem>
            <SelectItem value="cc">Creative Commons (credit required)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {license === "cc" && (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor="track-credit" className={label}>Credit text (copy it from the Creative Commons icon in the Audio Library)</label>
          <textarea
            id="track-credit"
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
            rows={3}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          />
        </div>
      )}
      <div className="flex flex-col items-start gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <CircleNotch className="animate-spin" /> : <UploadSimple />}
          {pending ? "Uploading" : "Add to library"}
        </Button>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <WarningCircle weight="bold" className="size-4" /> {error}
          </p>
        )}
      </div>
    </form>
  );
}
