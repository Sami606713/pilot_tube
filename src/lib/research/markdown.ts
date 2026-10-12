import { TIME_RANGES, type Research } from "./types";

const STATUS_LABEL = { confirmed: "Confirmed", single: "Single source", conflict: "Conflict" } as const;

/** The finished research as a Markdown document (for copy and download). */
export function researchMarkdown(r: Research): string {
  const res = r.result;
  if (!res) return `# ${r.topic}\n\nNot finished.`;
  const p = res.report;
  const refs = (list: number[]) => (list.length ? ` [${list.join(", ")}]` : "");
  const section = (title: string, body: string) => (body.trim() ? `## ${title}\n\n${body.trim()}\n` : "");
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

  return [
    `# ${res.title}`,
    `Topic: ${r.topic} · ${TIME_RANGES[r.timeRange]} · ${r.depth} research · ${new Date(r.createdAt).toLocaleString("en-GB")}`,
    `Evidence score: ${res.score.value}/100 (${res.score.label})`,
    "",
    section("Summary", p.summary),
    section("Key numbers", bullets(p.keyNumbers.map((k) => `**${k.value}** ${k.label}${refs(k.sources)}`))),
    section("Key points", bullets(p.keyPoints)),
    section("Why it matters", p.whyItMatters),
    section("Background", p.background),
    section("Viewpoints", bullets(p.viewpoints)),
    section("What's next", p.whatsNext),
    section("Open questions", bullets(p.openQuestions)),
    section("Timeline", bullets(p.timeline.map((t) => `**${t.date}**: ${t.event}${refs(t.sources)}`))),
    section(
      "Facts",
      res.facts
        .map((f) => `- **${STATUS_LABEL[f.status]}**: ${f.statement}${refs(f.sources)}${f.note ? `\n  - Note: ${f.note}` : ""}${f.quotes.map((q) => `\n  - [${q.source}] "${q.quote}"`).join("")}`)
        .join("\n"),
    ),
    section("Sources", res.sources.map((s) => `${s.n}. [${s.title}](${s.url}) (${s.domain}, ${s.kind}${s.published ? `, ${s.published}` : ""})`).join("\n")),
  ]
    .filter(Boolean)
    .join("\n");
}
