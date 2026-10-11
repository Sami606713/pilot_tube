import "server-only";
import { Composio } from "@composio/core";

/** Composio runs the Google login and calls the YouTube API for PilotTube. */
let client: Composio | undefined;

// Pinned so a Composio toolkit update can't silently change tool inputs or outputs.
const TOOLKIT_VERSIONS = { youtube: "20261008_00" };

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
  if (!result.successful) throw new Error(`${slug} failed: ${result.error ?? "unknown error"}`);
  return result.data as T;
}
