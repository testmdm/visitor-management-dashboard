/**
 * ThingsBoard CE REST client — SERVER-SIDE ONLY.
 *
 * Auth model: every dashboard user logs in with their OWN TB account.
 * The caller's JWT is passed per-request (from the httpOnly session cookie).
 * There is no shared service account and no anonymous access.
 */
import axios, { AxiosInstance } from "axios";

const TB_BASE = (process.env.TB_BASE_URL || "").replace(/\/$/, "");
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

function assertBase() {
  if (!TB_BASE) {
    throw new Error("TB_BASE_URL not configured on the server");
  }
}

/** GET with the caller's own JWT. Throws { status: 401 } when it expires. */
async function tbGet<T>(token: string, path: string, params?: Record<string, unknown>): Promise<T> {
  assertBase();
  const inst: AxiosInstance = axios.create({
    baseURL: TB_BASE,
    timeout: 10000,
    headers: { "X-Authorization": `Bearer ${token}` },
  });
  const res = await inst.get<T>(path, { params });
  return res.data;
}

export async function listSiteDevices(token: string): Promise<TbDevice[]> {
  // Type filter is OPTIONAL: when TB_DEVICE_TYPE is empty, list every device the
  // user may see. (Lets the dashboard work regardless of the device type set in TB.)
  const typeFilter = (TB_DEVICE_TYPE || "").trim();
  const params: Record<string, unknown> = { pageSize: 100, page: 0 };
  if (typeFilter) params.type = typeFilter;

  // 1) Tenant-scoped listing (works for tenant admins / sysadmins).
  try {
    const data = await tbGet<{ data: TbDevice[] }>(token, "/api/tenant/devices", params);
    return data.data ?? [];
  } catch (e: unknown) {
    if (!(axios.isAxiosError(e) && e.response?.status === 403)) throw e;
    // 2) Fallback for CUSTOMER_USER: list devices of our own customer.
    const me = await tbGet<{ customerId?: { id?: string } }>(token, "/api/auth/user");
    const customerId = me?.customerId?.id;
    if (!customerId) throw e;
    const data = await tbGet<{ data: TbDevice[] }>(
      token,
      `/api/customer/${customerId}/devices`,
      params
    );
    return data.data ?? [];
  }
}

export async function latestTelemetry(
  token: string,
  deviceId: string,
  keys: readonly string[] = TELEMETRY_KEYS
): Promise<Record<string, TbTsPoint>> {
  const data = await tbGet<Record<string, TbTsPoint[]>>(
    token,
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
  token: string,
  deviceId: string,
  keys: readonly string[],
  startTs: number,
  endTs: number,
  intervalMs = 3600000,
  agg = "SUM"
): Promise<Record<string, TbTsPoint[]>> {
  return tbGet<Record<string, TbTsPoint[]>>(
    token,
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
