import { ArrowRight, FilmStrip, Lightning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { StepBar, STEP_META } from "@/components/step-track";
import { clock, timeAgo } from "@/lib/format";
import type { ShortSummary } from "@/lib/shorts";

export function NewShortButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <ActionButton
      endpoint="/api/script"
      pendingLabel="Writing script"
      icon={<Lightning size={16} weight="fill" />}
      variant={variant}
      redirectTo="/shorts/{id}"
    >
      New Short
    </ActionButton>
  );
}

function Thumb({ short }: { short: ShortSummary }) {
  return (
    <div className="relative aspect-[9/16] w-11 shrink-0 overflow-hidden rounded-md bg-surface-2 ring-1 ring-inset ring-line">
      {short.thumbId ? (
        // eslint-disable-next-line @next/next/no-img-element -- local API thumbnail, already 270px
        <img src={`/api/script/${short.id}/clip/0/poster?v=${short.thumbId}`} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <FilmStrip size={16} className="absolute inset-0 m-auto text-subtle" />
      )}
    </div>
  );
}

export function ShortsList({ shorts }: { shorts: ShortSummary[] }) {
  if (shorts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-line-strong px-6 py-12">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">No Shorts yet</h3>
          <p className="max-w-[52ch] text-sm text-muted">
            PilotTube reads today&apos;s AI news, picks the strongest story and writes a 30 to 45 second script from the real article.
          </p>
        </div>
        <NewShortButton />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {shorts.map((short) => (
        <li key={short.id}>
          <Link
            href={`/shorts/${short.id}`}
            className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2 focus-visible:outline-none"
          >
            <Thumb short={short} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium text-fg">{short.title}</span>
              <span className="truncate text-xs text-muted">
                {short.source} <span className="text-subtle">/</span> {timeAgo(short.createdAt)}
              </span>
              <div className="mt-1 flex items-center gap-3 sm:hidden">
                <StepBar done={short.done} next={short.next} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden flex-col items-end gap-1.5 sm:flex">
                <StepBar done={short.done} next={short.next} />
                <span className="text-xs text-subtle">
                  {short.done.includes("render") ? "Rendered" : short.next === "render" ? "Ready to render" : `Next: ${STEP_META[short.next].label}`}
                </span>
              </div>
              <span className="hidden w-12 text-right font-mono text-xs tabular-nums text-muted md:block">{clock(short.duration)}</span>
              <ArrowRight size={16} className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ShortsListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true" aria-label="Loading Shorts">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="skeleton aspect-[9/16] w-11 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-3.5 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
