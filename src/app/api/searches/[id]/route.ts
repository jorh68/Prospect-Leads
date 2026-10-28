import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/searches/:id — status, progress and found companies. */
export async function GET(_request: Request, ctx: RouteContext<"/api/searches/[id]">) {
  const { id } = await ctx.params;
  const search = await db.search.findUnique({
    where: { id },
    include: {
      results: { orderBy: { rank: "asc" }, include: { company: true } },
      jobs: { orderBy: { createdAt: "desc" }, take: 1, where: { type: "discovery" } },
    },
  });
  if (!search) return NextResponse.json({ error: "Búsqueda no encontrada" }, { status: 404 });
  const { jobs, ...rest } = search;
  return NextResponse.json({ search: rest, progress: jobs[0]?.progress ?? null });
}
