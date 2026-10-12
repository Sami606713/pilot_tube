import "server-only";
import { z } from "zod";
import { askJson } from "@/lib/agnes";
import { failResearch, finishResearch, getResearch, updateStep } from "./store";
import type { Depth, FactGroup, FactStatus, Report, ResearchResult, Score, Source, StepKey, TimeRange } from "./types";
import { canonicalUrl, classify, credits, domainOf, normalizeText, quoteInText, webRead, webSearch, type SearchHit } from "./web";

/** How much work each depth does. */
const LIMITS: Record<Depth, { questions: string; queriesPer: number; resultsPer: number; read: number; round2: number; maxPerDomain: number }> = {
  quick: { questions: "4", queriesPer: 1, resultsPer: 5, read: 5, round2: 0, maxPerDomain: 1 },
  deep: { questions: "6 to 7", queriesPer: 2, resultsPer: 6, read: 9, round2: 4, maxPerDomain: 2 },
};

/** Characters of page text Agnes reads per source. */
const PAGE_CHARS = 14_000;

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
const today = () => new Date().toISOString().slice(0, 10);

const RANGE_TEXT: Record<TimeRange, string> = {
  week: "The user wants what happened in the PAST 7 DAYS. Write queries that find the latest news (use words like 'this week', the month and year).",
  month: "The user wants what happened in the PAST 30 DAYS. Write queries that find recent news (use the month and year).",
  any: "Any time period is fine, but prefer the most recent developments.",
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------- 1. Plan ----------

const planSchema = z.object({
  title: z.string().min(1).max(120),
  isAI: z.boolean(),
  entities: z.array(z.object({ name: z.string(), officialDomains: z.array(z.string()).default([]) })).max(5).default([]),
  questions: z.array(z.object({ question: z.string().min(5), queries: z.array(z.string().min(3)).min(1).max(3) })).min(3).max(8),
  officialQueries: z.array(z.string().min(3)).max(3).default([]),
});
type Plan = z.infer<typeof planSchema>;

const PLAN_PROMPT = `You are the research lead for an AI-news YouTube channel. Break the topic into the questions a curious viewer would ask, then write web search queries that answer them.

Return ONLY this JSON:
{
  "title": "short, neutral name of the topic (max 10 words)",
  "isAI": true,                       // is the topic about artificial intelligence?
  "entities": [ { "name": "Microsoft", "officialDomains": ["microsoft.com", "blogs.microsoft.com"] } ],   // main companies/labs/products and THEIR OWN websites
  "questions": [ { "question": "What exactly was announced?", "queries": ["..."] } ],
  "officialQueries": ["queries that find the ORIGINAL source: the company's blog post, press release, paper or GitHub release"]
}

Cover: what happened, who is involved, the key numbers, why it matters, background/what came before, reactions or criticism, what happens next.
Queries: specific, include names and products, 3-10 words, no quotes or search operators.`;

async function makePlan(topic: string, range: TimeRange, depth: Depth, article: string | null): Promise<Plan> {
  const l = LIMITS[depth];
  const user = [
    `Topic: ${topic}`,
    `Today: ${today()}. ${RANGE_TEXT[range]}`,
    `Write ${l.questions} questions with ${l.queriesPer} quer${l.queriesPer > 1 ? "ies" : "y"} each, and 1-3 officialQueries.`,
    article ? `\nThe user gave this article as the starting point:\n${article.slice(0, 6000)}` : "",
  ].join("\n");
  const plan = await askJson(PLAN_PROMPT, user, (raw) => planSchema.parse(raw));
  plan.entities = plan.entities.map((e) => ({ ...e, officialDomains: e.officialDomains.map((d) => domainOf(d.includes("://") ? d : `https://${d}`)).filter(Boolean) }));
  return plan;
}

// ---------- 2-3. Search, rank, read ----------

type Candidate = SearchHit & { kind: Source["kind"]; rank: number };

function rankHits(hits: SearchHit[], officialDomains: string[], seen: Set<string>): Candidate[] {
  const byUrl = new Map<string, Candidate>();
  for (const h of hits) {
    const key = canonicalUrl(h.url);
    if (seen.has(key)) continue;
    const kind = classify(h.domain, officialDomains);
    const rank = h.score + (kind === "official" ? 1 : kind === "news" ? 0.6 : 0);
    const prev = byUrl.get(key);
    // The same page found by several queries is more central to the topic.
    if (prev) prev.rank = Math.max(prev.rank, rank) + 0.15;
    else byUrl.set(key, { ...h, kind, rank });
  }
  return [...byUrl.values()].sort((a, b) => b.rank - a.rank);
}

/**
 * Best candidates: the best official one first, official pages capped at about a third (so outside
 * reporting is heard too), at most `perDomain` per site. Leftover slots are filled by rank.
 */
function pickSources(cands: Candidate[], count: number, perDomain: number, forced: Candidate[] = []): Candidate[] {
  const picked: Candidate[] = [...forced];
  const perSite = new Map<string, number>();
  for (const c of forced) perSite.set(c.domain, (perSite.get(c.domain) ?? 0) + 1);
  const officialCap = Math.max(1, Math.ceil(count / 3));
  const official = cands.find((c) => c.kind === "official");
  const order = official ? [official, ...cands.filter((c) => c !== official)] : cands;
  const take = (capOfficial: boolean) => {
    for (const c of order) {
      if (picked.length >= count) break;
      if (picked.some((p) => canonicalUrl(p.url) === canonicalUrl(c.url))) continue;
      if ((perSite.get(c.domain) ?? 0) >= perDomain) continue;
      if (capOfficial && c.kind === "official" && picked.filter((p) => p.kind === "official").length >= officialCap) continue;
      picked.push(c);
      perSite.set(c.domain, (perSite.get(c.domain) ?? 0) + 1);
    }
  };
  take(true);
  take(false);
  return picked;
}

// ---------- 4. Facts ----------

const factsSchema = z.object({
  published: z.string().nullable().default(null),
  facts: z
    .array(
      z.object({
        claim: z.string().min(5),
        quote: z.string().min(12),
        kind: z.enum(["number", "date", "name", "claim"]).catch("claim"),
        question: z.number().int().catch(-1),
      }),
    )
    .max(12),
});

const FACTS_PROMPT = `You extract checkable facts from ONE web page for a fact-checked research report.

Return ONLY this JSON:
{
  "published": "YYYY-MM-DD or null",     // the page's own publish date if it states one
  "facts": [
    { "claim": "one short factual statement in your words", "quote": "the EXACT sentence copied character-for-character from the page that proves it", "kind": "number|date|name|claim", "question": 0 }
  ]
}

Rules:
- Only facts that help answer the questions. Prefer numbers, dates, names, direct statements and announcements.
- "quote" MUST be copied exactly from the page text (one sentence, max 300 characters). Never paraphrase it. If you cannot quote it, leave the fact out.
- "question" = index of the question it answers (or -1).
- Skip ads, navigation, opinions presented as facts, and anything not on this page. Max 8 facts.`;

type RawFact = { id: string; claim: string; quote: string; kind: string; question: number; source: number };

async function extractFacts(source: Source, text: string, questions: string[]): Promise<{ facts: RawFact[]; published: string | null; rejected: number }> {
  const qs = questions.map((q, i) => `${i}. ${q}`).join("\n");
  const user = `Questions:\n${qs}\n\nPage: ${source.title} (${source.domain})\n---\n${text.slice(0, PAGE_CHARS)}`;
  const out = await askJson(FACTS_PROMPT, user, (raw) => factsSchema.parse(raw), { temperature: 0 });
  const page = normalizeText(text);
  const facts: RawFact[] = [];
  let rejected = 0;
  out.facts.forEach((f, i) => {
    // The quote must really be on the page; otherwise the "fact" may be invented.
    if (quoteInText(f.quote, page)) facts.push({ id: `S${source.n}F${i + 1}`, claim: f.claim, quote: f.quote.trim(), kind: f.kind, question: f.question, source: source.n });
    else rejected++;
  });
  const published = out.published && /^\d{4}-\d{2}-\d{2}$/.test(out.published) && out.published <= today() ? out.published : null;
  return { facts, published, rejected };
}

// ---------- 5. Cross-check ----------

const groupsSchema = z.object({
  groups: z.array(z.object({ statement: z.string().min(5), factIds: z.array(z.string()).min(1), conflict: z.boolean().catch(false), note: z.string().optional() })),
});

const CHECK_PROMPT = `You cross-check facts collected from several sources. Group facts that state the SAME thing (even in different words). If facts about the same thing DISAGREE (different numbers, dates or claims), put them in one group with "conflict": true and explain the difference in "note".

Return ONLY this JSON:
{ "groups": [ { "statement": "the fact in one clear neutral sentence", "factIds": ["S1F2", "S3F1"], "conflict": false, "note": "optional" } ] }

Every fact id must appear in exactly one group. Do not add information that is not in the facts.`;

async function crossCheck(facts: RawFact[], sources: Source[]): Promise<FactGroup[]> {
  if (facts.length === 0) return [];
  const list = facts.map((f) => `${f.id} [source ${f.source}, ${sources.find((s) => s.n === f.source)?.domain}] ${f.claim}`).join("\n");
  const out = await askJson(CHECK_PROMPT, `Facts:\n${list}`, (raw) => groupsSchema.parse(raw), { temperature: 0 });

  const byId = new Map(facts.map((f) => [f.id, f]));
  const used = new Set<string>();
  const groups: FactGroup[] = [];
  const add = (statement: string, members: RawFact[], conflict: boolean, note?: string) => {
    const nums = [...new Set(members.map((m) => m.source))].sort((a, b) => a - b);
    const srcs = nums.map((n) => sources.find((s) => s.n === n)!).filter(Boolean);
    const domains = new Set(srcs.map((s) => s.domain));
    const status: FactStatus = conflict && domains.size > 1 ? "conflict" : srcs.some((s) => s.kind === "official") || domains.size >= 2 ? "confirmed" : "single";
    groups.push({ id: `G${groups.length + 1}`, statement, status, sources: nums, quotes: members.map((m) => ({ source: m.source, quote: m.quote })), note: conflict ? note : undefined });
  };
  for (const g of out.groups) {
    const members = g.factIds.map((id) => byId.get(id)).filter((f): f is RawFact => Boolean(f) && !used.has(f!.id));
    if (members.length === 0) continue;
    members.forEach((m) => used.add(m.id));
    add(g.statement, members, g.conflict, g.note);
  }
  // Facts Agnes forgot to group still count, as their own group.
  for (const f of facts) if (!used.has(f.id)) add(f.claim, [f], false);

  const order: Record<FactStatus, number> = { conflict: 0, confirmed: 1, single: 2 };
  return groups.sort((a, b) => order[a.status] - order[b.status] || b.sources.length - a.sources.length);
}

// ---------- 6. Gaps ----------

const gapsSchema = z.object({ gaps: z.array(z.object({ question: z.number().int(), queries: z.array(z.string().min(3)).min(1).max(2) })).max(3) });

const GAPS_PROMPT = `You review a research file. Find the questions that are NOT answered well by the facts, and any conflicts that need a deciding source. For each (max 3), write 1-2 new, more specific web search queries.

Return ONLY this JSON: { "gaps": [ { "question": 2, "queries": ["..."] } ] }   (empty list if everything is answered)`;

// ---------- 7. Report ----------

const cited = z.string().default("");
const nums = z.array(z.number().int()).default([]);
const reportSchema = z.object({
  summary: z.string().min(20),
  keyPoints: z.array(z.string()).default([]),
  keyNumbers: z.array(z.object({ value: z.string(), label: z.string(), sources: nums })).max(6).default([]),
  whyItMatters: cited,
  background: cited,
  viewpoints: z.array(z.string()).default([]),
  whatsNext: cited,
  openQuestions: z.array(z.string()).default([]),
  timeline: z.array(z.object({ date: z.string(), event: z.string(), sources: nums })).default([]),
  answered: z.array(z.number().int()).default([]),
});

const REPORT_PROMPT = `You write a professional, fact-checked research brief for an AI-news channel, using ONLY the verified facts provided. No outside knowledge.

Return ONLY this JSON:
{
  "summary": "3-4 sentences: what happened and why it matters, with citations",
  "keyPoints": ["5-8 bullet sentences, most important first, each with citations"],
  "keyNumbers": [ { "value": "40%", "label": "more tokens per megawatt", "sources": [1, 3] } ],
  "whyItMatters": "2-3 sentences with citations",
  "background": "2-3 sentences: what came before, with citations",
  "viewpoints": ["supporters, critics, competitors: each a sentence with citations (empty if none in the facts)"],
  "whatsNext": "1-3 sentences with citations",
  "openQuestions": ["important things the sources do NOT confirm"],
  "timeline": [ { "date": "2026-10-12 or Oct 2026", "event": "what happened", "sources": [2] } ],
  "answered": [0, 1, 3]          // indexes of the questions the facts answer
}

Rules:
- Cite sources as [n] right after each claim, using the source numbers given. Every factual sentence needs at least one citation.
- CONFIRMED facts can be stated plainly. SINGLE-SOURCE facts must be attributed ("according to <outlet>"). CONFLICTS must show both versions.
- Never invent numbers, names, dates or quotes. If the facts don't cover something, put it in openQuestions.
- Clear, neutral, simple English. No hype words ("revolutionary", "game-changing").`;

/** Keep only [n] citations that point at a real source; drop empty brackets. */
function cleanCitations(text: string, valid: Set<number>): string {
  return text
    .replace(/\[(\s*\d+(?:\s*[,;]\s*\d+)*\s*)\]/g, (_, inner: string) => {
      const keep = [...new Set(inner.split(/[,;]/).map((n) => Number(n.trim())))].filter((n) => valid.has(n));
      return keep.length ? `[${keep.join(", ")}]` : "";
    })
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

async function writeReport(title: string, questions: string[], sources: Source[], groups: FactGroup[]): Promise<{ report: Report; answered: Set<number> }> {
  const srcList = sources
    .map((s) => `[${s.n}] ${s.title} (${s.domain}, ${s.kind}${s.published ? `, ${s.published}` : ""})`)
    .join("\n");
  const factList = groups
    .map((g) => `- ${g.status.toUpperCase()} ${g.statement} [${g.sources.join(", ")}]${g.note ? ` (conflict: ${g.note})` : ""}`)
    .join("\n");
  const user = `Topic: ${title}\nToday: ${today()}\n\nQuestions:\n${questions.map((q, i) => `${i}. ${q}`).join("\n")}\n\nSources:\n${srcList}\n\nVerified facts:\n${factList}`;
  const raw = await askJson(REPORT_PROMPT, user, (r) => reportSchema.parse(r), { temperature: 0.3 });

  const valid = new Set(sources.map((s) => s.n));
  const c = (t: string) => cleanCitations(t, valid);
  const ns = (list: number[]) => [...new Set(list)].filter((n) => valid.has(n));
  return {
    report: {
      summary: c(raw.summary),
      keyPoints: raw.keyPoints.map(c).filter(Boolean),
      keyNumbers: raw.keyNumbers.map((k) => ({ value: k.value, label: k.label, sources: ns(k.sources) })).filter((k) => k.sources.length),
      whyItMatters: c(raw.whyItMatters),
      background: c(raw.background),
      viewpoints: raw.viewpoints.map(c).filter(Boolean),
      whatsNext: c(raw.whatsNext),
      openQuestions: raw.openQuestions.map((q) => q.trim()).filter(Boolean),
      timeline: raw.timeline.map((t) => ({ date: t.date, event: c(t.event), sources: ns(t.sources) })),
    },
    answered: new Set(raw.answered),
  };
}

// ---------- 8. Score ----------

function scoreResearch(range: TimeRange, sources: Source[], groups: FactGroup[], answeredShare: number): Score {
  const read = sources.filter((s) => s.read);
  const official = read.filter((s) => s.kind === "official").length;
  const news = new Set(read.filter((s) => s.kind === "news").map((s) => s.domain)).size;
  const confirmed = groups.filter((g) => g.status === "confirmed").length;
  const conflicts = groups.filter((g) => g.status === "conflict").length;
  const limitDays = range === "week" ? 10 : range === "month" ? 35 : 3650;
  const dated = sources.filter((s) => s.published);
  const fresh = dated.filter((s) => (Date.now() - Date.parse(s.published!)) / 86_400_000 <= limitDays).length;

  const parts: [number, string][] = [
    [official ? 25 : 0, official ? `${official} official source${official > 1 ? "s" : ""} read` : "No official source found"],
    [Math.min(confirmed * 5, 30), `${confirmed} fact${confirmed === 1 ? "" : "s"} confirmed by 2+ sources or an official one`],
    [Math.min(news * 5, 15), `${news} trusted news outlet${news === 1 ? "" : "s"}`],
    [dated.length ? Math.round((fresh / dated.length) * 15) : 5, dated.length ? `${fresh} of ${dated.length} dated sources are within the time range` : "Few sources show a date"],
    [Math.round(answeredShare * 15), `${Math.round(answeredShare * 100)}% of the questions answered`],
    [-Math.min(conflicts * 5, 15), conflicts ? `${conflicts} conflict${conflicts > 1 ? "s" : ""} between sources` : "No conflicts between sources"],
  ];
  const value = Math.max(0, Math.min(100, parts.reduce((sum, [p]) => sum + p, 0)));
  return { value, label: value >= 75 ? "Strong" : value >= 50 ? "OK" : "Weak", reasons: parts.map(([, r]) => r) };
}

// ---------- Run ----------

export async function runResearch(id: number): Promise<void> {
  const research = getResearch(id);
  if (!research) return;
  const { topic, timeRange, depth } = research;
  const l = LIMITS[depth];
  const started = Date.now();
  const stats = { searches: 0, results: 0, read: 0, quotesKept: 0, quotesRejected: 0, credits: 0, seconds: 0 };
  let current: StepKey = "plan";
  const step = (key: StepKey, detail?: string) => {
    current = key;
    updateStep(id, key, "running", detail);
  };
  const done = (key: StepKey, detail: string) => updateStep(id, key, "done", detail);

  try {
    // 1. Plan (a pasted link is read first and becomes source #1)
    step("plan");
    let startPage: { url: string; text: string } | null = null;
    if (isUrl(topic)) {
      const pages = await webRead([topic.trim()]);
      stats.credits += credits.extract(1);
      const text = pages.values().next().value;
      if (!text) throw new Error("Could not read that link (paywall or blocked). Try a topic in words instead.");
      startPage = { url: topic.trim(), text };
    }
    const plan = await makePlan(startPage ? `the story in this article: ${topic}` : topic, timeRange, depth, startPage?.text ?? null);
    const officialDomains = plan.entities.flatMap((e) => e.officialDomains);
    const questions = plan.questions.map((q) => q.question);
    done("plan", `${questions.length} questions, ${plan.entities.map((e) => e.name).join(", ") || "no main company"}${plan.isAI ? "" : " · not an AI topic"}`);

    // 2. Search
    step("search");
    // Advanced search (2 credits) only where precision matters most: finding the original source.
    const queries = [
      ...plan.officialQueries.map((q) => ({ q, deep: depth === "deep" })),
      ...plan.questions.flatMap((x) => x.queries.slice(0, l.queriesPer)).map((q) => ({ q, deep: false })),
    ];
    const hits = (
      await mapLimit(queries, 2, async ({ q, deep }) => {
        try {
          return await webSearch(q, { maxResults: l.resultsPer, deep });
        } catch (err) {
          console.warn(`[research] search failed "${q}": ${(err as Error).message}`);
          return [];
        }
      })
    ).flat();
    stats.searches = queries.length;
    stats.results = hits.length;
    stats.credits += queries.reduce((sum, x) => sum + credits.search(x.deep), 0);
    if (hits.length === 0 && !startPage) throw new Error("The web search found nothing. Check the Tavily connection in Composio, or try other words.");
    done("search", `${queries.length} searches, ${hits.length} results`);

    // 3. Rank and read
    step("read");
    const seen = new Set<string>();
    const ranked = rankHits(hits, officialDomains, seen);
    const forced: Candidate[] = startPage
      ? [{ url: startPage.url, title: plan.title, content: startPage.text.slice(0, 400), score: 1, domain: domainOf(startPage.url), kind: classify(domainOf(startPage.url), officialDomains), rank: 99 }]
      : [];
    const picked = pickSources(ranked, l.read, l.maxPerDomain, forced);
    const pages = await webRead(picked.filter((p) => p !== forced[0]).map((p) => p.url));
    if (startPage) pages.set(startPage.url, startPage.text);
    stats.credits += credits.extract(picked.length - forced.length);

    const sources: Source[] = [];
    const texts = new Map<number, string>();
    const addSources = (cands: Candidate[], pageText: Map<string, string>, round: 1 | 2) => {
      for (const c of cands) {
        seen.add(canonicalUrl(c.url));
        const full = pageText.get(c.url);
        const n = sources.length + 1;
        sources.push({ n, url: c.url, title: c.title, domain: c.domain, kind: c.kind, published: null, snippet: c.content.slice(0, 300), read: Boolean(full), round });
        // Unreadable pages still give their search snippet as (weaker) evidence.
        texts.set(n, full ?? c.content);
      }
    };
    addSources(picked, pages, 1);
    stats.read = sources.filter((s) => s.read).length;
    done("read", `${stats.read} of ${sources.length} sources read in full · ${sources.filter((s) => s.kind === "official").length} official`);

    // 4. Facts
    step("facts");
    const facts: RawFact[] = [];
    const extractFrom = async (list: Source[]) => {
      // Two at a time: free Agnes keys are rate limited.
      await mapLimit(list, 2, async (s) => {
        try {
          const out = await extractFacts(s, texts.get(s.n) ?? "", questions);
          s.published = out.published;
          facts.push(...out.facts);
          stats.quotesKept += out.facts.length;
          stats.quotesRejected += out.rejected;
        } catch (err) {
          console.warn(`[research] facts failed for ${s.url}: ${(err as Error).message}`);
        }
      });
    };
    await extractFrom(sources);
    if (facts.length === 0) throw new Error("No verifiable facts were found in the sources. Try a more specific topic or a longer time range.");
    done("facts", `${stats.quotesKept} facts with verified quotes · ${stats.quotesRejected} rejected (quote not on the page)`);

    // 5. Cross-check
    step("check");
    let groups = await crossCheck(facts, sources);
    const count = (s: FactStatus) => groups.filter((g) => g.status === s).length;
    done("check", `${count("confirmed")} confirmed · ${count("single")} single-source · ${count("conflict")} conflicts`);

    // 6. Gaps (deep only): targeted second round
    if (l.round2 > 0) {
      step("gaps");
      const file = groups.map((g) => `- ${g.status}: ${g.statement}`).join("\n");
      const { gaps } = await askJson(GAPS_PROMPT, `Questions:\n${questions.map((q, i) => `${i}. ${q}`).join("\n")}\n\nFacts so far:\n${file}`, (r) => gapsSchema.parse(r));
      const gapQueries = gaps.flatMap((g) => g.queries).slice(0, 4);
      if (gapQueries.length === 0) {
        done("gaps", "Every question already answered");
      } else {
        const more = (await mapLimit(gapQueries, 2, (q) => webSearch(q, { maxResults: 5, deep: true }).catch(() => []))).flat();
        stats.searches += gapQueries.length;
        stats.results += more.length;
        stats.credits += gapQueries.length * credits.search(true);
        const extra = pickSources(rankHits(more, officialDomains, seen), l.round2, l.maxPerDomain);
        const morePages = await webRead(extra.map((e) => e.url));
        stats.credits += credits.extract(extra.length);
        const before = sources.length;
        addSources(extra, morePages, 2);
        stats.read = sources.filter((s) => s.read).length;
        await extractFrom(sources.slice(before));
        groups = await crossCheck(facts, sources);
        done("gaps", `${gapQueries.length} new searches · ${extra.length} more sources`);
      }
    }

    // 7. Report
    step("report");
    const { report, answered } = await writeReport(plan.title, questions, sources, groups);
    stats.seconds = Math.round((Date.now() - started) / 1000);
    const result: ResearchResult = {
      title: plan.title,
      isAI: plan.isAI,
      questions: questions.map((q, i) => ({ question: q, answered: answered.has(i) })),
      sources,
      facts: groups,
      report,
      score: scoreResearch(timeRange, sources, groups, questions.length ? answered.size / questions.length : 0),
      stats,
    };
    done("report", `Done in ${stats.seconds}s`);
    finishResearch(id, result);
  } catch (err) {
    console.error(`[research] #${id} failed at ${current}:`, err);
    failResearch(id, (err as Error).message);
  }
}
