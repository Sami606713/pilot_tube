"use client";

import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { buttonStyles } from "@/components/button-styles";

type Props = {
  endpoint: string;
  method?: "POST" | "GET";
  children: ReactNode;
  pendingLabel: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
  /** Where to go after success, e.g. "/shorts/{id}" ({id} comes from the JSON response). Defaults to refreshing the page. */
  redirectTo?: string;
  className?: string;
};

/** Calls a pipeline endpoint, shows elapsed time while it runs (some steps take a minute), and reports errors inline. */
export function ActionButton({ endpoint, method = "POST", children, pendingLabel, icon, variant = "secondary", redirectTo, className = "" }: Props) {
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

  async function run() {
    setPending(true);
    setElapsed(0);
    setError(null);
    try {
      const res = await fetch(endpoint, { method });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      if (redirectTo) router.push(redirectTo.replace("{id}", String(body.id ?? "")));
      else router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      <button type="button" onClick={run} disabled={pending} className={`${buttonStyles.base} ${buttonStyles[variant]}`}>
        {pending ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : icon}
        {pending ? (
          <span>
            {pendingLabel}
            <span className="ml-1.5 font-mono text-xs tabular-nums opacity-70">{elapsed}s</span>
          </span>
        ) : (
          children
        )}
      </button>
      {error && (
        <p role="alert" className="flex max-w-md items-start gap-1.5 text-xs text-danger">
          <WarningCircle size={14} weight="bold" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
