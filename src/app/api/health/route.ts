import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/health — public liveness check used by the host (no data exposed). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[health] la base de datos no responde:", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
