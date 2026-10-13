/**
 * ThingsBoard CE REST client — SERVER-SIDE ONLY.
 *
 * Never import this module from a client component. All credentials come from
 * server-only env vars (TB_BASE_URL, TB_USERNAME, TB_PASSWORD) which must NOT
 * have the NEXT_PUBLIC_ prefix. The JWT is cached in memory and refreshed on 401.
 */
import axios, { AxiosInstance } from "axios";

const TB_BASE = (process.env.TB_BASE_URL || "").replace(/\/$/, "");
const TB_USER = process.env.TB_USERNAME || "";
const TB_PASS = process.env.TB_PASSWORD || "";
export const TB_DEVICE_TYPE = process.env.TB_DEVICE_TYPE || "visitor-site";
export const TB_OFFLINE_AFTER_S = Number(process.env.TB_OFFLINE_AFTER_S || "90");

export const TELEMETRY_KEYS = [
  "site_id",
  "count_in",
  "count_out",
  "occupancy",
  "total_visitors",
  "ambiguous_pending",
  "pipeline_running",
  "avg_fps",
  "uptime_s",
] as const;

export interface TbDevice {
  id: { entityType: string; id: string };
  name: string;
  label?: string;
  type: string;
}

export interface TbTsPoint {
  ts: number;
  value: string;
}

function assertConfigured() {
  if (!TB_BASE || !TB_USER || !TB_PASS) {
    throw new Error(
      "ThingsBoard env not configured (TB_BASE_URL / TB_USERNAME / TB_PASSWORD)"
    );
  }
}

// ── JWT cache (module scope = per server instance) ──────────────────────────
let cachedToken: string | null = null;
let cachedAt = 0;
const JWT_TTL_MS = 1000 * 60 * 60 * 8; // re-login at most every 8h (also on 401)

async function login(): Promise<string> {
  assertConfigured();
  const res = await axios.post(
    `${TB_BASE}/api/auth/login`,
    { username: TB_USER, password: TB_PASS },
    { timeout: 10000 }
  );
  const token = res.data?.token as string | undefined;
  if (!token) throw new Error("ThingsBoard login returned no token");
  cachedToken = token;
  cachedAt = Date.now();
  return token;
}

async function token(): Promise<string> {
  if (cachedToken && Date.now() - cachedAt < JWT_TTL_MS) return cachedToken;
  return login();
}

function authed(token: string): AxiosInstance {
  return axios.create({
    baseURL: TB_BASE,
    timeout: 10000,
    headers: { "X-Authorization": `Bearer ${token}` },
  });
}

/** GET with one automatic re-login on 401. */
async function tbGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  let t = await token();
  try {
    const res = await authed(t).get<T>(path, { params });
    return res.data;
  } catch (e: unknown) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status === 401) {
      t = await login();
      const res = await authed(t).get<T>(path, { params });
      return res.data;
    }
    throw e;
  }
}

export async function listSiteDevices(): Promise<TbDevice[]> {
  const data = await tbGet<{ data: TbDevice[] }>("/api/tenant/devices", {
    pageSize: 100,
    page: 0,
    type: TB_DEVICE_TYPE,
  });
  return data.data ?? [];
}

export async function latestTelemetry(
  deviceId: string,
  keys: readonly string[] = TELEMETRY_KEYS
): Promise<Record<string, TbTsPoint>> {
  const data = await tbGet<Record<string, TbTsPoint[]>>(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    { keys: keys.join(",") }
  );
  const out: Record<string, TbTsPoint> = {};
  for (const [k, arr] of Object.entries(data || {})) {
    if (Array.isArray(arr) && arr.length > 0) out[k] = arr[0];
  }
  return out;
}

export async function historyTelemetry(
  deviceId: string,
  keys: readonly string[],
  startTs: number,
  endTs: number,
  intervalMs = 3600000,
  agg = "SUM"
): Promise<Record<string, TbTsPoint[]>> {
  return tbGet<Record<string, TbTsPoint[]>>(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    { keys: keys.join(","), startTs, endTs, interval: intervalMs, agg }
  );
}

export function num(v: TbTsPoint | undefined, fallback = 0): number {
  if (!v) return fallback;
  const n = Number(v.value);
  return Number.isFinite(n) ? n : fallback;
}

export function str(v: TbTsPoint | undefined, fallback = ""): string {
  return v ? String(v.value) : fallback;
}
