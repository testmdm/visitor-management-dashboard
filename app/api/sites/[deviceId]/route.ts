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

const KEYS = ["uniq_visitor", "overstay_count", "avg_duration_s"] as const;

function isUnauthorized(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 401;
}

/** Per-bucket aggregation: sums for counters, mean for the duration average. */
function aggFor(key: string): string {
  return key === "avg_duration_s" ? "AVG" : "SUM";
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
    // One request per key so each can use its own aggregation (SUM vs AVG).
    const results = await Promise.all(
      KEYS.map((k) =>
        historyTelemetry(t, params.deviceId, [k], startTs, endTs, 3600000, aggFor(k))
      )
    );
    const series: Record<string, { ts: number; value: number }[]> = {};
    KEYS.forEach((k, i) => {
      const arr = (results[i]?.[k] ?? []) as { ts: number; value: string }[];
      series[k] = arr
        .map((p) => ({ ts: p.ts, value: Number(p.value) || 0 }))
        .sort((a, b) => a.ts - b.ts);
    });
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

