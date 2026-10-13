/**
 * GET /api/sites — aggregate overview of all sites (devices) from ThingsBoard.
 *
 * Server-side only: holds the TB JWT (env), never exposed to the browser.
 * One slow device must not fail the whole response -> Promise.allSettled.
 */
import { NextResponse } from "next/server";
import {
  TELEMETRY_KEYS,
  TB_OFFLINE_AFTER_S,
  latestTelemetry,
  listSiteDevices,
  num,
  str,
} from "@/lib/tb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms = FETCH_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("site fetch timeout")), ms)
    ),
  ]);
}

export async function GET() {
  const startedAt = Date.now();
  try {
    const devices = await listSiteDevices();

    const settled = await Promise.allSettled(
      devices.map(async (d) => {
        const t0 = Date.now();
        const ts = await withTimeout(latestTelemetry(d.id.id, TELEMETRY_KEYS));
        return { device: d, ts, latencyMs: Date.now() - t0 };
      })
    );

    const now = Date.now();
    const sites = settled.map((r, i) => {
      const device = devices[i];
      if (r.status === "rejected") {
        return {
          deviceId: device.id.id,
          name: device.name,
          label: device.label || "",
          online: false,
          lastSeen: null as number | null,
          latencyMs: null as number | null,
          error: String((r.reason as Error)?.message || r.reason),
          metrics: null as null,
        };
      }
      const { ts, latencyMs } = r.value;
      // lastSeen = newest timestamp across keys (telemetry arrives together).
      let lastSeen = 0;
      for (const v of Object.values(ts)) {
        if (v && typeof v.ts === "number" && v.ts > lastSeen) lastSeen = v.ts;
      }
      const ageS = lastSeen > 0 ? (now - lastSeen) / 1000 : Number.POSITIVE_INFINITY;
      const online = lastSeen > 0 && ageS <= TB_OFFLINE_AFTER_S;
      return {
        deviceId: device.id.id,
        name: device.name, // site display name IS the TB device name
        label: device.label || "",
        online,
        lastSeen: lastSeen > 0 ? lastSeen : null,
        latencyMs,
        error: null as string | null,
        metrics: {
          site_id: str(ts["site_id"], device.name),
          count_in: num(ts["count_in"]),
          count_out: num(ts["count_out"]),
          occupancy: num(ts["occupancy"]),
          total_visitors: num(ts["total_visitors"]),
          ambiguous_pending: num(ts["ambiguous_pending"]),
          pipeline_running: str(ts["pipeline_running"], "false") === "true",
          avg_fps: num(ts["avg_fps"]),
          uptime_s: num(ts["uptime_s"]),
        },
      };
    });

    const up = sites.filter((s) => s.online);
    const agg = {
      totalSites: sites.length,
      onlineSites: up.length,
      offlineSites: sites.length - up.length,
      count_in: up.reduce((a, s) => a + (s.metrics?.count_in ?? 0), 0),
      count_out: up.reduce((a, s) => a + (s.metrics?.count_out ?? 0), 0),
      occupancy: up.reduce((a, s) => a + (s.metrics?.occupancy ?? 0), 0),
      total_visitors: up.reduce((a, s) => a + (s.metrics?.total_visitors ?? 0), 0),
      ambiguous_pending: up.reduce((a, s) => a + (s.metrics?.ambiguous_pending ?? 0), 0),
    };

    return NextResponse.json({
      ok: true,
      fetchedAt: now,
      tookMs: Date.now() - startedAt,
      offlineAfterS: TB_OFFLINE_AFTER_S,
      aggregate: agg,
      sites,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
