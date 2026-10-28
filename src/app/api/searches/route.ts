import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSearch, searchInputSchema } from "@/lib/discovery/pipeline";

/** GET /api/searches — latest searches. */
export async function GET() {
  const searches = await db.search.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ searches });
}

/** POST /api/searches { niche, location, count } — creates a search and queues discovery. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = searchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos", issues: parsed.error.issues }, { status: 400 });
  }
  const search = await createSearch(parsed.data);
  return NextResponse.json({ search }, { status: 201 });
}
