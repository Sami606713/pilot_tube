"use client";

import { CheckCircle, CircleNotch, DownloadSimple, MagicWand, Trash, WarningCircle } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Switch the Short whose thumbnails are shown (kept in the URL so it can be linked to). */
export function ShortPicker({ shorts, current }: { shorts: { id: number; title: string }[]; current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select value={String(current)} onValueChange={(v) => router.push(`${pathname}?short=${v}`)}>
      <SelectTrigger className="w-full max-w-xl" aria-label="Short">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {shorts.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            #{s.id} {s.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Make 3 new options in one format (about 40s: ideas, 3 pictures in parallel, then text). */
export function GenerateThumbnailsButton({ shortId, format, label, primary }: { shortId: number; format: "short" | "wide"; label: string; primary?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  async function generate() {
    setPending(true);
    setElapsed(0);
    setError(null);
    try {
      const res = await fetch(`/api/script/${shortId}/thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant={primary ? "default" : "outline"} onClick={generate} disabled={pending}>
        {pending ? <CircleNotch className="animate-spin" /> : <MagicWand />}
        {pending ? (
          <span>
            Making 3 options <span className="font-mono text-xs tabular-nums opacity-75">{elapsed}s</span>
          </span>
        ) : (
          label
        )}
      </Button>
      {error && (
        <p role="alert" className="flex max-w-sm items-start gap-1 text-xs text-destructive">
          <WarningCircle weight="bold" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Choose, download or delete one thumbnail. */
export function ThumbnailActions({ id, selected }: { id: number; selected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"select" | "delete" | null>(null);

  async function act(kind: "select" | "delete") {
    if (kind === "delete" && !window.confirm("Delete this thumbnail?")) return;
    setBusy(kind);
    await fetch(`/api/thumbnails/${id}`, { method: kind === "select" ? "POST" : "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {selected ? (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-success/15 px-2.5 text-xs font-medium text-success">
          <CheckCircle weight="fill" className="size-4" /> Chosen
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => act("select")} disabled={busy !== null}>
          {busy === "select" ? <CircleNotch className="animate-spin" /> : <CheckCircle />} Choose
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" asChild aria-label="Download thumbnail">
        <a href={`/api/thumbnails/${id}/image?download=1`}>
          <DownloadSimple />
        </a>
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => act("delete")} disabled={busy !== null} aria-label="Delete thumbnail">
        {busy === "delete" ? <CircleNotch className="animate-spin" /> : <Trash />}
      </Button>
    </div>
  );
}
