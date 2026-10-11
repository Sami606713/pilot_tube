"use client";

import { CircleNotch, PlayCircle, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/button-styles";

const ENDPOINTS = {
  voice: { path: "voice", label: "Making voice" },
  clips: { path: "footage", label: "Finding clips" },
  cards: { path: "cards", label: "Rendering cards" },
  render: { path: "render", label: "Rendering video" },
} as const;

type RunnableStep = keyof typeof ENDPOINTS;

/** Runs every missing step in order (voice, then clips, then cards), refreshing the page after each. */
export function RunPipelineButton({ shortId, missing }: { shortId: number; missing: RunnableStep[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState<RunnableStep | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [current]);

  if (missing.length === 0) return null;

  async function run() {
    setError(null);
    for (const step of missing) {
      setCurrent(step);
      setElapsed(0);
      try {
        const res = await fetch(`/api/script/${shortId}/${ENDPOINTS[step].path}`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        router.refresh();
      } catch (err) {
        setError(`${ENDPOINTS[step].label} failed: ${(err as Error).message}`);
        break;
      }
    }
    setCurrent(null);
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button type="button" onClick={run} disabled={current !== null} className={`${buttonStyles.base} ${buttonStyles.primary}`}>
        {current ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : <PlayCircle size={16} weight="fill" />}
        {current ? (
          <span>
            {ENDPOINTS[current].label}
            <span className="ml-1.5 font-mono text-xs tabular-nums opacity-70">
              {missing.indexOf(current) + 1}/{missing.length} · {elapsed}s
            </span>
          </span>
        ) : (
          `Run ${missing.length === 1 ? "next step" : `${missing.length} remaining steps`}`
        )}
      </button>
      {error && (
        <p role="alert" className="flex max-w-sm items-start gap-1.5 text-xs text-danger">
          <WarningCircle size={14} weight="bold" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
