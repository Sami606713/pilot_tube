/** Shapes shared by the research engine (server) and the Research page (client). */

export type TimeRange = "week" | "month" | "any";
export type Depth = "quick" | "deep";
export type ResearchStatus = "running" | "done" | "failed";

export const TIME_RANGES: Record<TimeRange, string> = { week: "Past week", month: "Past month", any: "Any time" };
export const DEPTHS: Record<Depth, { label: string; hint: string }> = {
  quick: { label: "Quick", hint: "About 1-2 min, 1 round, 5 sources" },
  deep: { label: "Deep", hint: "About 2-6 min, 2 rounds, up to 13 sources" },
};

export type StepKey = "plan" | "search" | "read" | "facts" | "check" | "gaps" | "report";
export type StepState = "waiting" | "running" | "done" | "skipped" | "failed";
export type Step = { key: StepKey; label: string; state: StepState; detail?: string };

export const STEP_LABELS: Record<StepKey, string> = {
  plan: "Understanding the topic",
  search: "Searching the web",
  read: "Reading the best sources",
  facts: "Extracting facts with quotes",
  check: "Cross-checking facts",
  gaps: "Filling gaps (round 2)",
  report: "Writing the report",
};

/** official = the company/lab itself, papers, code; news = established outlets; other = everything else. */
export type SourceKind = "official" | "news" | "other";

export type Source = {
  /** Citation number used as [n] in the report. */
  n: number;
  url: string;
  title: string;
  domain: string;
  kind: SourceKind;
  /** Publish date (YYYY-MM-DD) when the page states one. */
  published: string | null;
  snippet: string;
  /** Fully read and fact-checked (not just a search snippet). */
  read: boolean;
  round: 1 | 2;
};

export type FactStatus = "confirmed" | "single" | "conflict";

export type FactGroup = {
  id: string;
  statement: string;
  status: FactStatus;
  /** Source numbers that support it. */
  sources: number[];
  /** Exact sentences from those sources (each checked to appear in the page text). */
  quotes: { source: number; quote: string }[];
  note?: string;
};

export type Cited = { text: string; sources: number[] };

export type Report = {
  summary: string;
  keyPoints: string[];
  keyNumbers: { value: string; label: string; sources: number[] }[];
  whyItMatters: string;
  background: string;
  viewpoints: string[];
  whatsNext: string;
  openQuestions: string[];
  timeline: { date: string; event: string; sources: number[] }[];
};

export type Score = { value: number; label: "Strong" | "OK" | "Weak"; reasons: string[] };

export type ResearchResult = {
  title: string;
  isAI: boolean;
  questions: { question: string; answered: boolean }[];
  sources: Source[];
  facts: FactGroup[];
  report: Report;
  score: Score;
  stats: { searches: number; results: number; read: number; quotesKept: number; quotesRejected: number; credits: number; seconds: number };
};

export type Research = {
  id: number;
  topic: string;
  timeRange: TimeRange;
  depth: Depth;
  status: ResearchStatus;
  steps: Step[];
  result: ResearchResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchSummary = Pick<Research, "id" | "topic" | "status" | "depth" | "createdAt"> & { title: string | null; score: Score | null };
