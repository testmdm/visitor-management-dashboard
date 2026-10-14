/**
 * POST /api/auth/logout — sign out (TB logout best-effort + clear cookies).
 */
import { NextResponse } from "next/server";
import { getSessionTokens, tbLogout } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const { token } = getSessionTokens();
  await tbLogout(token);
  return NextResponse.json({ ok: true });
}
