"use client";

import { CalendarBlank, CheckCircle, CircleNotch, PaperPlaneTilt, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Check = { label: string; ok: boolean; detail?: string };
type Defaults = { title: string; description: string; checks: Check[] };
type Privacy = "public" | "unlisted" | "private";

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input, defaulting to tomorrow 6 PM. */
function defaultTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const field = "rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PublishSheet({ shortId, title, schedule }: { shortId: number; title: string; schedule?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Defaults | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", privacy: "public" as Privacy, when: "now" as "now" | "later", at: defaultTime() });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(next: boolean) {
    setOpen(next);
    if (!next || data) return;
    try {
      const res = await fetch(`/api/publish/${shortId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setData(body);
      setForm((f) => ({ ...f, title: body.title, description: body.description, when: schedule ? "later" : "now" }));
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }

  // The file checks come from the server; title and description are checked as you type.
  const checks: Check[] = (data?.checks ?? []).map((c) => {
    if (c.label === "Title") return { ...c, ok: form.title.trim().length > 0 && form.title.length <= 100, detail: `${form.title.length}/100` };
    if (c.label === "Description") {
      const bytes = new TextEncoder().encode(form.description).length;
      const angle = /[<>]/.test(form.description);
      return { ...c, ok: bytes <= 5000 && !angle, detail: bytes > 5000 ? "Too long" : angle ? "No < or > allowed" : undefined };
    }
    return c;
  });
  const ready = data !== null && checks.every((c) => c.ok);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/publish/${shortId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          privacy: form.privacy,
          publishAt: form.when === "later" ? new Date(form.at).toISOString() : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={load}>
      <SheetTrigger asChild>
        <Button variant={schedule ? "outline" : "default"} size="sm">
          {schedule ? <CalendarBlank /> : <PaperPlaneTilt />} {schedule ? "Schedule" : "Publish now"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Publish to YouTube</SheetTitle>
          <SheetDescription className="line-clamp-2">{title}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!data && !loadError && <div className="skeleton h-96 rounded-xl" aria-busy="true" />}
          {data && (
            <>
              <video src={`/api/studio/${shortId}/file/final.mp4`} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] h-72 rounded-xl bg-[#0b0b0d] ring-1 ring-border" />

              <div className="flex flex-col gap-2">
                <label htmlFor="pub-title" className="flex justify-between text-xs font-medium text-muted-foreground">
                  Title <span className="font-mono tabular-nums">{form.title.length}/100</span>
                </label>
                <Input id="pub-title" value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="pub-desc" className="text-xs font-medium text-muted-foreground">Description (source links and hashtags are already in it)</label>
                <textarea id="pub-desc" rows={7} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs font-medium text-muted-foreground">When</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(["now", "later"] as const).map((w) => (
                    <label key={w} className="flex items-center gap-2">
                      <input type="radio" name="when" checked={form.when === w} onChange={() => setForm({ ...form, when: w })} className="accent-primary" />
                      {w === "now" ? "Now" : "Schedule"}
                    </label>
                  ))}
                </div>
                {form.when === "later" && (
                  <>
                    <input type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} className={`${field} w-fit [color-scheme:dark]`} aria-label="Go-live time" />
                    <p className="text-xs text-muted-foreground">Uploaded as private now; YouTube makes it public at this time, even if PilotTube is off.</p>
                  </>
                )}
              </fieldset>

              {form.when === "now" && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-medium text-muted-foreground">Visibility</legend>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {(["public", "unlisted", "private"] as const).map((p) => (
                      <label key={p} className="flex items-center gap-2 capitalize">
                        <input type="radio" name="privacy" checked={form.privacy === p} onChange={() => setForm({ ...form, privacy: p })} className="accent-primary" />
                        {p}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Checks</p>
                {checks.map((c) => (
                  <p key={c.label} className="flex items-center gap-2 text-sm">
                    {c.ok ? <CheckCircle weight="fill" className="size-4 shrink-0 text-emerald-500" /> : <XCircle weight="fill" className="size-4 shrink-0 text-destructive" />}
                    {c.label}
                    {c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
                  </p>
                ))}
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                  <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={!ready || pending}>
                  {pending ? <CircleNotch className="animate-spin" /> : form.when === "later" ? <CalendarBlank /> : <PaperPlaneTilt />}
                  {pending ? "Uploading" : form.when === "later" ? "Schedule" : "Publish"}
                </Button>
              </div>
              {pending && <p className="text-right text-xs text-muted-foreground">Uploading the video can take a minute.</p>}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
