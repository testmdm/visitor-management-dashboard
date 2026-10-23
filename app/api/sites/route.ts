/**
 * GET /api/sites — aggregate overview of all sites (devices) from ThingsBoard.
 *
 * Server-side only: holds the TB JWT (env), never exposed to the browser.
 * One slow device must not fail the whole response -> Promise.allSettled.
 */
import { NextResponse } from "next/server";
import axios from "axios";
import {
  TELEMETRY_KEYS,
  TB_OFFLINE_AFTER_S,
  latestTelemetry,
  listSiteDevices,
  num,
  str,
} from "@/lib/tb";
import { getSessionTokens, tbRefresh } from "@/lib/session";

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

function isUnauthorized(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 401;
}

export async function GET() {
  const startedAt = Date.now();
  let { token, refresh } = getSessionTokens();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  async function loadSites(t: string) {
    const devices = await listSiteDevices(t);
    return Promise.allSettled(
      devices.map(async (d) => {
        const t0 = Date.now();
        const ts = await withTimeout(latestTelemetry(t, d.id.id, TELEMETRY_KEYS));
        return { device: d, ts, latencyMs: Date.now() - t0 };
      })
    );
  }

  let settled: PromiseSettledResult<{
    device: Awaited<ReturnType<typeof listSiteDevices>>[number];
    ts: Record<string, { ts: number; value: string }>;
    latencyMs: number;
  }>[];
  let devices: Awaited<ReturnType<typeof listSiteDevices>>;
  try {
    devices = await listSiteDevices(token);
    settled = await loadSites(token);
  } catch (e: unknown) {
    if (!isUnauthorized(e) || !refresh) {
      const message = e instanceof Error ? e.message : String(e);
      const status = isUnauthorized(e) ? 401 : 502;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    // Session expired — try one refresh, then retry once.
    const nt = await tbRefresh(refresh);
    if (!nt) {
      return NextResponse.json({ ok: false, error: "Session expired. Please sign in again." }, { status: 401 });
    }
    token = nt;
    try {
      devices = await listSiteDevices(token);
      settled = await loadSites(token);
    } catch (e2: unknown) {
      const message = e2 instanceof Error ? e2.message : String(e2);
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }

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
          uniq_visitor: num(ts["uniq_visitor"]),
          overstay_count: num(ts["overstay_count"]),
          avg_duration_s: num(ts["avg_duration_s"]),
        },
      };
    });

    const up = sites.filter((s) => s.online);
    const withDuration = up.filter((s) => (s.metrics?.avg_duration_s ?? 0) > 0);
    const agg = {
      totalSites: sites.length,
      onlineSites: up.length,
      offlineSites: sites.length - up.length,
      uniq_visitor: up.reduce((a, s) => a + (s.metrics?.uniq_visitor ?? 0), 0),
      overstay_count: up.reduce((a, s) => a + (s.metrics?.overstay_count ?? 0), 0),
      // Average of per-site averages (weighted by sites reporting a duration).
      avg_duration_s:
        withDuration.length > 0
          ? Math.round(withDuration.reduce((a, s) => a + (s.metrics?.avg_duration_s ?? 0), 0) / withDuration.length)
          : 0,
    };

    return NextResponse.json({
      ok: true,
      fetchedAt: now,
      tookMs: Date.now() - startedAt,
      offlineAfterS: TB_OFFLINE_AFTER_S,
      aggregate: agg,
      sites,
    });
}
