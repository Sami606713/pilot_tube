/** SQLite's datetime('now') is UTC without a zone ("2026-10-11 01:24:00"); ISO strings already have one. */
export function parseDbDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value.replace(" ", "T") + "Z");
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(value: string, now = Date.now()): string {
  const seconds = Math.round((parseDbDate(value).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86400), "day");
}

/** 27.53 → "0:28" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
