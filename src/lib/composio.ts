import "server-only";
import { Composio } from "@composio/core";

/** Composio holds the logins for YouTube (Google) and Tavily (web research) and calls their APIs for PilotTube. */
let client: Composio | undefined;

// Pinned so a Composio toolkit update can't silently change tool inputs or outputs.
const TOOLKIT_VERSIONS = { youtube: "20261008_00", tavily: "20260930_00" };

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

export function composio(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is missing in .env.local");
  client ??= new Composio({ apiKey, toolkitVersions: TOOLKIT_VERSIONS });
  return client;
}

/** Composio user that owns the connections (the dashboard default is "default"). */
export function composioUserId(): string {
  return process.env.COMPOSIO_USER_ID || "default";
}

let youtubeAccount: string | undefined;

/** The active YouTube connected account (set COMPOSIO_YOUTUBE_ACCOUNT_ID to pin one). */
export async function youtubeAccountId(): Promise<string> {
  if (process.env.COMPOSIO_YOUTUBE_ACCOUNT_ID) return process.env.COMPOSIO_YOUTUBE_ACCOUNT_ID;
  if (youtubeAccount) return youtubeAccount;
  const list = await composio().connectedAccounts.list({ toolkitSlugs: ["youtube"] });
  const active = (list.items as { id: string; status: string }[]).find((a) => a.status === "ACTIVE");
  if (!active) throw new Error("YouTube is not connected in Composio");
  youtubeAccount = active.id;
  return active.id;
}

/** Run a YouTube tool on the connected channel; throws with Composio's message when it fails. */
export async function runYouTubeTool<T = Record<string, unknown>>(slug: string, args: Record<string, unknown>): Promise<T> {
  const result = await composio().tools.execute(slug, {
    userId: composioUserId(),
    connectedAccountId: await youtubeAccountId(),
    arguments: args,
  });
  if (!result.successful) throw new Error(youtubeError(slug, String(result.error ?? "unknown error")));
  return result.data as T;
}

const QUOTA_MESSAGE =
  "YouTube's daily API limit is used up. It resets at midnight Pacific time (about 12 PM in Pakistan). Connecting YouTube in Composio with your own Google app gives PilotTube its own limit.";

function youtubeError(slug: string, message: string): string {
  if (/exceeded your .*quota|quotaExceeded/i.test(message)) return QUOTA_MESSAGE;
  // Composio reports a used-up quota on the channel video list as "Access forbidden".
  if (/Access forbidden when fetching channel/i.test(message)) return `YouTube refused the request, most likely because the daily API limit is used up. ${QUOTA_MESSAGE.split(". ").slice(1).join(". ")}`;
  return `${slug} failed: ${message}`;
}

/**
 * Call any YouTube API endpoint (full URL) with the connected account's login, for things
 * Composio has no tool for, like scheduling. Throws with YouTube's message on a non-2xx reply.
 */
export async function youtubeApi<T = Record<string, unknown>>(
  method: "GET" | "PUT" | "POST" | "DELETE",
  url: string,
  query: Record<string, string>,
  body?: unknown,
): Promise<T> {
  const res = await composio().tools.proxyExecute({
    endpoint: url,
    method,
    connectedAccountId: await youtubeAccountId(),
    parameters: Object.entries(query).map(([name, value]) => ({ in: "query" as const, name, value })),
    body,
  });
  if (res.status < 200 || res.status >= 300) {
    const data = res.data as { error?: { message?: string } } | undefined;
    throw new Error(youtubeError(url, data?.error?.message ?? `HTTP ${res.status}`));
  }
  return res.data as T;
}

let tavilyAccount: string | undefined;

/** Run a Tavily tool (search, extract) with the Tavily key connected in Composio. */
export async function runTavilyTool<T = Record<string, unknown>>(slug: string, args: Record<string, unknown>): Promise<T> {
  if (!tavilyAccount) {
    const list = await composio().connectedAccounts.list({ toolkitSlugs: ["tavily"] });
    const active = (list.items as { id: string; status: string }[]).find((a) => a.status === "ACTIVE");
    if (!active) throw new Error("Tavily is not connected in Composio. Add your Tavily API key there.");
    tavilyAccount = active.id;
  }
  const result = await composio().tools.execute(slug, { userId: composioUserId(), connectedAccountId: tavilyAccount, arguments: args });
  if (!result.successful) throw new Error(`${slug} failed: ${String(result.error ?? "unknown error").slice(0, 300)}`);
  return result.data as T;
}
