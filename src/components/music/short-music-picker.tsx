"use client";

import { Check, CircleNotch, Copy, MagicWand, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "@/components/button-styles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: number; title: string; mood: string };

type Props = {
  shortId: number;
  tracks: Option[];
  trackId: number | null;
  mood: string | null;
  attribution: string | null;
};

const NONE = "none";

/** Pick music for one Short: automatically by mood, or by hand. */
export function ShortMusicPicker({ shortId, tracks, trackId, mood, attribution }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"auto" | "set" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function send(body: object, kind: "auto" | "set") {
    setPending(kind);
    setError(null);
    try {
      const res = await fetch(`/api/script/${shortId}/music`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function copyCredit() {
    if (!attribution) return;
    await navigator.clipboard.writeText(attribution);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => send({ auto: true }, "auto")} disabled={pending !== null || tracks.length === 0} className={`${buttonStyles.base} ${buttonStyles.secondary}`}>
          {pending === "auto" ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : <MagicWand size={16} />}
          {pending === "auto" ? "Reading the mood" : "Pick by mood"}
        </button>
        <Select value={trackId ? String(trackId) : NONE} onValueChange={(v) => send({ trackId: v === NONE ? null : Number(v) }, "set")} disabled={pending !== null}>
          <SelectTrigger className="w-64" aria-label="Background music">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No music</SelectItem>
            {tracks.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.title} <span className="text-muted-foreground capitalize">({t.mood})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending === "set" && <CircleNotch size={16} weight="bold" className="animate-spin text-muted-foreground" />}
      </div>
      {mood && <p className="text-xs text-muted-foreground">Script mood: <span className="capitalize text-foreground">{mood}</span></p>}
      {attribution && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">This track needs credit. Paste this into the YouTube description:</p>
          <p className="whitespace-pre-line text-sm">{attribution}</p>
          <button type="button" onClick={copyCredit} className={`${buttonStyles.base} ${buttonStyles.secondary} w-fit`}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy credit"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <WarningCircle weight="bold" size={16} /> {error}
        </p>
      )}
    </div>
  );
}
