export interface SiteMetrics {
  site_id: string;
  count_in: number;
  count_out: number;
  occupancy: number;
  total_visitors: number;
  ambiguous_pending: number;
  pipeline_running: boolean;
  avg_fps: number;
  uptime_s: number;
}

export interface Site {
  deviceId: string;
  name: string;
  label: string;
  online: boolean;
  lastSeen: number | null;
  latencyMs: number | null;
  error: string | null;
  metrics: SiteMetrics | null;
}

export interface SitesResp {
  ok: boolean;
  error?: string;
  fetchedAt?: number;
  tookMs?: number;
  offlineAfterS?: number;
  aggregate?: {
    totalSites: number;
    onlineSites: number;
    offlineSites: number;
    count_in: number;
    count_out: number;
    occupancy: number;
    total_visitors: number;
    ambiguous_pending: number;
  };
  sites?: Site[];
}

export function fmtUptime(s: number): string {
  if (!s || s < 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtNum(n: number): string {
  return (n ?? 0).toLocaleString("en-US");
}
