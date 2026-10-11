import { refreshNews, unusedStories } from "@/lib/news/store";

/** Fetch the latest AI news, save new stories, and return the unused ones. */
export async function GET() {
  const result = await refreshNews();
  return Response.json({ ...result, stories: unusedStories() });
}
