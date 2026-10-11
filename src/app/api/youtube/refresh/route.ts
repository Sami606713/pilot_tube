import { clearYouTubeCache, getYouTubeOverview, getYouTubeVideos } from "@/lib/youtube/analytics";

/** Drop the 15-minute cache and fetch fresh channel numbers from YouTube (through Composio). */
export async function POST() {
  try {
    clearYouTubeCache();
    const [overview] = await Promise.all([getYouTubeOverview(28, { force: true }), getYouTubeVideos({ force: true })]);
    return Response.json({ fetchedAt: overview.fetchedAt });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
