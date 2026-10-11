import { Article, Check, FilmSlate, FilmStrip, Microphone, Sparkle, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";
import { STEPS, type Step } from "@/lib/shorts";

export const STEP_META: Record<Step, { label: string; Icon: ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill" }> ; soon?: boolean }> = {
  script: { label: "Script", Icon: Article },
  voice: { label: "Voice", Icon: Microphone },
  clips: { label: "Clips", Icon: FilmStrip },
  cards: { label: "Cards", Icon: Sparkle },
  render: { label: "Render", Icon: FilmSlate },
  upload: { label: "Upload", Icon: UploadSimple, soon: true },
};

/** Compact progress: one segment per step. Done = accent, next = outlined, later = muted. */
export function StepBar({ done, next }: { done: Step[]; next: Step }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${done.length} of ${STEPS.length} steps done`}>
      {STEPS.map((step) => {
        const isDone = done.includes(step);
        const isNext = step === next && !isDone;
        return (
          <span
            key={step}
            title={STEP_META[step].label}
            className={`h-1.5 w-5 rounded-full ${isDone ? "bg-accent" : isNext ? "bg-line-strong" : "bg-surface-2 ring-1 ring-inset ring-line"}`}
          />
        );
      })}
    </div>
  );
}

/** Full step list for the Short page. */
export function StepTrack({ done, next }: { done: Step[]; next: Step }) {
  return (
    <ol className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-6">
      {STEPS.map((step, i) => {
        const { label, Icon, soon } = STEP_META[step];
        const isDone = done.includes(step);
        const isNext = step === next && !isDone;
        return (
          <li key={step} className={`flex items-center gap-2.5 bg-surface px-3 py-2.5 ${isNext ? "bg-surface-2" : ""}`}>
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full ${
                isDone ? "bg-accent text-accent-fg" : isNext ? "border border-line-strong text-fg" : "border border-line text-subtle"
              }`}
            >
              {isDone ? <Check size={14} weight="bold" /> : <Icon size={14} weight="bold" />}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-mono text-[10px] text-subtle">{i + 1}</span>
              <span className={`truncate text-sm ${isDone || isNext ? "font-medium text-fg" : "text-muted"}`}>
                {label}
                {soon && <span className="ml-1 hidden text-xs font-normal text-subtle xl:inline">soon</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
