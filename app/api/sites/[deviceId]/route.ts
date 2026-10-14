/**
 * GET /api/sites/[deviceId] — 24h timeseries for one site (drill-down chart).
 * Query: ?hours=24 (default 24, max 168).
 *
 * Server-side only: uses the signed-in user's TB JWT from the httpOnly
 * session cookie, with one transparent refresh on 401. No anonymous access.
 */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { historyTelemetry } from "@/lib/tb";
import { getSessionTokens, tbRefresh } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEYS = ["count_in", "count_out", "occupancy"] as const;

function isUnauthorized(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 401;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  let { token, refresh } = getSessionTokens();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(_req.url);
  const hours = Math.min(168, Math.max(1, Number(url.searchParams.get("hours") || "24")));
  const endTs = Date.now();
  const startTs = endTs - hours * 3600 * 1000;

  async function load(t: string) {
    const data = await historyTelemetry(t, params.deviceId, KEYS, startTs, endTs, 3600000, "SUM");
    const series: Record<string, { ts: number; value: number }[]> = {};
    for (const k of KEYS) {
      const arr = (data?.[k] ?? []) as { ts: number; value: string }[];
      series[k] = arr
        .map((p) => ({ ts: p.ts, value: Number(p.value) || 0 }))
        .sort((a, b) => a.ts - b.ts);
    }
    return NextResponse.json({
      ok: true,
      deviceId: params.deviceId,
      hours,
      startTs,
      endTs,
      series,
    });
  }

  try {
    return await load(token);
  } catch (e: unknown) {
    if (!isUnauthorized(e) || !refresh) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: message }, { status: isUnauthorized(e) ? 401 : 502 });
    }
    const nt = await tbRefresh(refresh);
    if (!nt) {
      return NextResponse.json({ ok: false, error: "Session expired. Please sign in again." }, { status: 401 });
    }
    try {
      return await load(nt);
    } catch (e2: unknown) {
      const message = e2 instanceof Error ? e2.message : String(e2);
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }
}

