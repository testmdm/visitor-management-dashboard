/**
 * GET /api/auth/me — current signed-in user (for the topbar display).
 * 401 when not signed in or the session expired.
 */
import { NextResponse } from "next/server";
import { getSessionTokens, tbMe, tbRefresh } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  let { token, refresh } = getSessionTokens();
  if (!token && refresh) token = await tbRefresh(refresh);
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await tbMe(token);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const name =
    [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email || "User";
  return NextResponse.json({ ok: true, name, email: me.email || "", authority: me.authority || "" });
}
