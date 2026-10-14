/**
 * Per-user ThingsBoard session — SERVER-SIDE ONLY.
 *
 * Each dashboard user logs in with their own TB account. The TB JWT +
 * refresh token live in httpOnly cookies (never readable by browser JS).
 * All data routes read the token from the cookie; there is NO anonymous
 * access and NO shared service account fallback.
 */
import axios from "axios";
import { cookies } from "next/headers";

const TB_BASE = (process.env.TB_BASE_URL || "").replace(/\/$/, "");

export const SESSION_COOKIE = "vm_tb_token";
export const REFRESH_COOKIE = "vm_tb_refresh";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 9, // 9h — TB default token TTL is ~2.5h; refresh extends it
};

function assertBase() {
  if (!TB_BASE) throw new Error("TB_BASE_URL not configured on the server");
}

export function getSessionTokens(): { token: string | null; refresh: string | null } {
  const jar = cookies();
  return {
    token: jar.get(SESSION_COOKIE)?.value ?? null,
    refresh: jar.get(REFRESH_COOKIE)?.value ?? null,
  };
}

export function setSessionCookies(token: string, refreshToken?: string) {
  const jar = cookies();
  jar.set(SESSION_COOKIE, token, COOKIE_OPTS);
  if (refreshToken) jar.set(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
}

export function clearSessionCookies() {
  const jar = cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Login to TB with a user's own credentials. Returns {token, refreshToken}. */
export async function tbLogin(
  username: string,
  password: string
): Promise<{ token: string; refreshToken?: string }> {
  assertBase();
  const res = await axios.post(
    `${TB_BASE}/api/auth/login`,
    { username, password },
    { timeout: 10000 }
  );
  const token = res.data?.token as string | undefined;
  if (!token) throw new Error("Login failed: no token returned");
  return { token, refreshToken: res.data?.refreshToken as string | undefined };
}

/** Try to refresh an expired JWT. Returns the new token or null. */
export async function tbRefresh(refreshToken: string): Promise<string | null> {
  assertBase();
  try {
    const res = await axios.post(
      `${TB_BASE}/api/auth/token`,
      { refreshToken },
      { timeout: 10000 }
    );
    const token = res.data?.token as string | undefined;
    if (!token) return null;
    const jar = cookies();
    jar.set(SESSION_COOKIE, token, COOKIE_OPTS);
    const rt = res.data?.refreshToken as string | undefined;
    if (rt) jar.set(REFRESH_COOKIE, rt, COOKIE_OPTS);
    return token;
  } catch {
    return null;
  }
}

/** Logout on the TB side (best-effort) + clear cookies. */
export async function tbLogout(token: string | null) {
  assertBase();
  if (token) {
    try {
      await axios.post(
        `${TB_BASE}/api/auth/logout`,
        {},
        { timeout: 8000, headers: { "X-Authorization": `Bearer ${token}` } }
      );
    } catch {
      /* best-effort */
    }
  }
  clearSessionCookies();
}

/** Current TB user for a token (for the topbar display). */
export async function tbMe(token: string): Promise<{
  email?: string;
  firstName?: string;
  lastName?: string;
  authority?: string;
} | null> {
  assertBase();
  try {
    const res = await axios.get(`${TB_BASE}/api/auth/user`, {
      timeout: 8000,
      headers: { "X-Authorization": `Bearer ${token}` },
    });
    return {
      email: res.data?.email,
      firstName: res.data?.firstName,
      lastName: res.data?.lastName,
      authority: res.data?.authority,
    };
  } catch {
    return null;
  }
}
