"use client";

import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Actions for a Short already on YouTube: change the schedule, publish now, cancel, or make public. */
export function UploadActions({ shortId, state, publishAt }: { shortId: number; state: "scheduled" | "live" | "private" | "unlisted"; publishAt: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [at, setAt] = useState(publishAt ? toLocalInput(publishAt) : "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: string, body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(kind);
    setError(null);
    try {
      const res = await fetch(`/api/publish/${shortId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const spin = (kind: string) => pending === kind && <CircleNotch className="animate-spin" />;

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            aria-label="New go-live time"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm [color-scheme:dark]"
          />
          <Button size="sm" onClick={() => send("time", { action: "schedule", publishAt: new Date(at).toISOString() })} disabled={!at || pending !== null}>
            {spin("time")} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state === "scheduled" && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={pending !== null}>
                Change time
              </Button>
              <Button size="sm" variant="outline" onClick={() => send("now", { action: "visibility", privacy: "public" }, "Make this Short public now?")} disabled={pending !== null}>
                {spin("now")} Publish now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => send("cancel", { action: "visibility", privacy: "private" }, "Cancel the schedule? The Short stays private on YouTube.")} disabled={pending !== null}>
                {spin("cancel")} Cancel schedule
              </Button>
            </>
          )}
          {(state === "private" || state === "unlisted") && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={pending !== null || state === "unlisted"}>
                Schedule
              </Button>
              <Button size="sm" onClick={() => send("now", { action: "visibility", privacy: "public" }, "Make this Short public now?")} disabled={pending !== null}>
                {spin("now")} Make public
              </Button>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="flex max-w-sm items-start gap-1.5 text-sm text-destructive">
          <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
