/**
 * POST /api/auth/login — sign in with the user's OWN ThingsBoard account.
 * Body: { username, password }. On success sets httpOnly session cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { setSessionCookies, tbLogin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Username and password are required" }, { status: 400 });
  }
  try {
    const { token, refreshToken } = await tbLogin(username, password);
    setSessionCookies(token, refreshToken);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    const message =
      status === 401 || status === 403
        ? "Invalid username or password"
        : "Sign-in failed. Please check the server connection and try again.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
