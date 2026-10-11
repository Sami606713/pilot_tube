import { generateScript, listScripts } from "@/lib/script/generate";

export async function GET() {
  return Response.json({ scripts: listScripts() });
}

/** Pick today's best AI story and write a Shorts script for it. */
export async function POST() {
  try {
    return Response.json(await generateScript());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
