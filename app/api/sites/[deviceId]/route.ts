/**
 * GET /api/sites/[deviceId] — 24h timeseries for one site (drill-down chart).
 * Query: ?hours=24 (default 24, max 168).
 */
import { NextRequest, NextResponse } from "next/server";
import { historyTelemetry } from "@/lib/tb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEYS = ["count_in", "count_out", "occupancy"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const url = new URL(_req.url);
    const hours = Math.min(168, Math.max(1, Number(url.searchParams.get("hours") || "24")));
    const endTs = Date.now();
    const startTs = endTs - hours * 3600 * 1000;
    const data = await historyTelemetry(params.deviceId, KEYS, startTs, endTs, 3600000, "SUM");

    const series: Record<string, { ts: number; value: number }[]> = {};
    for (const k of KEYS) {
      const arr = data?.[k] ?? [];
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
