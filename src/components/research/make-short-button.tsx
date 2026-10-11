"use client";

import { CircleNotch, Lightning, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Writes a Short from this exact story, then opens it. Takes ~20-40s (reads the article, Agnes writes). */
export function MakeShortButton({ storyId }: { storyId: number }) {
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

  async function make() {
    setPending(true);
    setElapsed(0);
    setError(null);
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      router.push(`/shorts/${body.id}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" onClick={make} disabled={pending}>
        {pending ? <CircleNotch className="animate-spin" /> : <Lightning weight="fill" />}
        {pending ? (
          <span>
            Writing script <span className="font-mono text-xs tabular-nums opacity-75">{elapsed}s</span>
          </span>
        ) : (
          "Make Short"
        )}
      </Button>
      {error && (
        <p role="alert" className="flex max-w-xs items-start gap-1 text-xs text-destructive">
          <WarningCircle weight="bold" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
