import "server-only";
import { runTavilyTool } from "@/lib/composio";
import type { SourceKind } from "./types";

export type SearchHit = { url: string; title: string; content: string; score: number; domain: string };

/** Social and video sites: not citable evidence for a news fact. */
const EXCLUDED = ["youtube.com", "tiktok.com", "instagram.com", "facebook.com", "pinterest.com", "x.com", "twitter.com", "quora.com", "linkedin.com"];

/** Established outlets that do their own reporting (tech and general news). */
const TRUSTED_NEWS = [
  "reuters.com", "apnews.com", "bloomberg.com", "ft.com", "wsj.com", "nytimes.com", "washingtonpost.com", "bbc.com", "bbc.co.uk",
  "theguardian.com", "cnbc.com", "cnn.com", "axios.com", "semafor.com", "theinformation.com", "fortune.com", "businessinsider.com",
  "economist.com", "theverge.com", "techcrunch.com", "wired.com", "arstechnica.com", "engadget.com", "zdnet.com", "venturebeat.com",
  "technologyreview.com", "theregister.com", "tomshardware.com", "siliconangle.com", "datacenterdynamics.com", "spectrum.ieee.org",
  "nature.com", "science.org", "newscientist.com", "404media.co", "platformer.news", "geekwire.com", "9to5google.com", "9to5mac.com",
  "macrumors.com", "theinformation.com", "nikkei.com", "asia.nikkei.com", "scmp.com", "the-decoder.com", "infoq.com",
];

/** Primary-source hosts: papers, code, model cards. */
const PRIMARY = ["arxiv.org", "github.com", "openreview.net", "huggingface.co", "paperswithcode.com", "sec.gov", "patents.google.com"];

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const matches = (domain: string, list: string[]) => list.some((d) => domain === d || domain.endsWith(`.${d}`));

export function classify(domain: string, officialDomains: string[]): SourceKind {
  if (matches(domain, officialDomains) || matches(domain, PRIMARY)) return "official";
  if (matches(domain, TRUSTED_NEWS)) return "news";
  return "other";
}

/** Same page, different tracking parameters or trailing slash. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|fbclid|gclid|cmpid|src$)/i.test(key)) u.searchParams.delete(key);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url;
  }
}

/** Tavily credits: basic search 1, advanced 2; extract 1 per 5 pages read (basic). */
export const credits = { search: (deep: boolean) => (deep ? 2 : 1), extract: (pages: number) => Math.ceil(pages / 5) };

type TavilySearch = { results?: { url: string; title?: string; content?: string; score?: number }[] };

export async function webSearch(query: string, { maxResults, deep }: { maxResults: number; deep: boolean }): Promise<SearchHit[]> {
  const data = await runTavilyTool<TavilySearch & { response_data?: TavilySearch }>("TAVILY_SEARCH", {
    query,
    max_results: maxResults,
    search_depth: deep ? "advanced" : "basic",
    include_answer: false,
    exclude_domains: EXCLUDED,
  });
  const results = data.results ?? data.response_data?.results ?? [];
  return results
    .filter((r) => r.url && /^https?:/.test(r.url))
    .map((r) => ({ url: r.url, title: (r.title ?? r.url).trim(), content: (r.content ?? "").trim(), score: r.score ?? 0, domain: domainOf(r.url) }));
}

type TavilyExtract = { results?: { url: string; raw_content?: string | null }[]; failed_results?: unknown[] };

/** Clean page text (markdown) for each URL that could be read. */
export async function webRead(urls: string[]): Promise<Map<string, string>> {
  const pages = new Map<string, string>();
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const data = await runTavilyTool<TavilyExtract & { response_data?: TavilyExtract }>("TAVILY_EXTRACT", {
      urls: batch,
      extract_depth: "basic",
      format: "markdown",
    });
    for (const r of data.results ?? data.response_data?.results ?? []) {
      if (r.raw_content && r.raw_content.length > 200) pages.set(r.url, r.raw_content);
    }
  }
  return pages;
}

/** Lower-case, unify quotes/dashes, drop markdown symbols, collapse spaces: so a copied sentence can be found in the page. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚′`]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the quote really appears in the page (after normalizing both). */
export function quoteInText(quote: string, normalizedPage: string): boolean {
  const q = normalizeText(quote).replace(/^[\s"'.,;:…-]+|[\s"'.,;:…-]+$/g, "");
  if (q.length < 12) return false;
  if (normalizedPage.includes(q)) return true;
  // Agnes sometimes joins two sentences with "..."; accept when every part is in the page.
  const parts = q.split(/\s*(?:\.\.\.|…)\s*/).filter((p) => p.length >= 12);
  return parts.length > 1 && parts.every((p) => normalizedPage.includes(p));
}
