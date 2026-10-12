"use client";

import { ArrowsClockwise, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** A scene's Agnes picture with a one-click redraw (about 12s). */
export function SceneImageTile({ shortId, sceneIndex, src, poster, prompt }: { shortId: number; sceneIndex: number; src: string; poster: string; prompt: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redo() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/script/${shortId}/images/${sceneIndex}`, { method: "POST" });
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
    <figure className="flex flex-col gap-1.5">
      <a href={src} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-lg ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- local 270px poster */}
        <img src={poster} alt={prompt ?? `Scene ${sceneIndex + 1}`} loading="lazy" className={`aspect-[9/16] w-full bg-secondary object-cover ${pending ? "opacity-40" : ""}`} />
        {pending && <CircleNotch className="absolute inset-0 m-auto size-6 animate-spin text-foreground" aria-label="Redrawing" />}
      </a>
      <figcaption className="flex items-start justify-between gap-1">
        <span className="line-clamp-2 text-[11px] text-subtle" title={prompt ?? undefined}>
          <span className="font-medium text-foreground">{sceneIndex + 1}.</span> {prompt}
        </span>
        <Button size="icon-xs" variant="ghost" onClick={redo} disabled={pending} aria-label={`Redraw scene ${sceneIndex + 1}`} title="Redraw this picture">
          <ArrowsClockwise />
        </Button>
      </figcaption>
      {error && (
        <p role="alert" className="flex items-start gap-1 text-[11px] text-destructive">
          <WarningCircle weight="bold" className="mt-px size-3 shrink-0" />
          {error}
        </p>
      )}
    </figure>
  );
}
