"use client";

import { useCallback, useEffect, useState } from "react";

interface SiteMetrics {
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

interface Site {
  deviceId: string;
  name: string;
  label: string;
  online: boolean;
  lastSeen: number | null;
  latencyMs: number | null;
  error: string | null;
  metrics: SiteMetrics | null;
}

interface ApiResp {
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

function fmtUptime(s: number): string {
  if (!s || s < 0) return "-";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}h ${h % 24}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function fmtTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function OverviewPage() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sites", { cache: "no-store" });
      const j = (await res.json()) as ApiResp;
      setData(j);
      setUpdatedAt(Date.now());
    } catch (e) {
      setData({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const agg = data?.aggregate;

  return (
    <div className="wrap">
      <div className="header">
        <h1>Visitor Management — Multi-Site</h1>
        <span className="sub">via ThingsBoard · nama site = nama device TB</span>
      </div>

      <div className="toolbar">
        <button onClick={load}>Muat ulang</button>
        <span>
          {loading
            ? "Memuat…"
            : updatedAt
              ? `Terakhir update: ${new Date(updatedAt).toLocaleTimeString("id-ID")} (auto 30s)`
              : ""}
          {data?.tookMs != null ? ` · fetch ${data.tookMs}ms` : ""}
        </span>
      </div>

      {!data?.ok && !loading && (
        <div className="err">
          Gagal memuat data: {data?.error || "unknown"}
          <br />
          Periksa env TB_BASE_URL / TB_USERNAME / TB_PASSWORD di server dan
          konektivitas ke ThingsBoard.
        </div>
      )}

      {agg && (
        <div className="grid-kpi">
          <div className="kpi"><div className="v">{agg.onlineSites}/{agg.totalSites}</div><div className="l">Site online</div></div>
          <div className="kpi"><div className="v">{agg.count_in}</div><div className="l">Masuk (hari ini)</div></div>
          <div className="kpi"><div className="v">{agg.count_out}</div><div className="l">Keluar (hari ini)</div></div>
          <div className="kpi"><div className="v">{agg.occupancy}</div><div className="l">Di dalam (semua site)</div></div>
          <div className="kpi"><div className="v">{agg.total_visitors}</div><div className="l">Total visitor</div></div>
          <div className="kpi"><div className="v">{agg.ambiguous_pending}</div><div className="l">Perlu konfirmasi</div></div>
        </div>
      )}

      <div className="grid-sites">
        {(data?.sites || []).map((s) => (
          <div key={s.deviceId} className={`card${s.online ? "" : " off"}`}>
            <span className={`badge ${s.online ? "on" : "off"}`}>
              {s.online ? "● ONLINE" : "● OFFLINE"}
            </span>
            <h3 style={{ marginTop: 8 }}>{s.name}</h3>
            {s.label && <div className="meta">{s.label}</div>}
            <div className="meta">
              Terakhir terlihat: {fmtTime(s.lastSeen)}
              {s.latencyMs != null ? ` · ${s.latencyMs}ms` : ""}
            </div>
            {s.error && !s.metrics && (
              <div className="meta" style={{ color: "#fca5a5" }}>{s.error}</div>
            )}
            {s.metrics && (
              <div style={{ marginTop: 8 }}>
                <div className="row"><span>Masuk / Keluar</span><b>{s.metrics.count_in} / {s.metrics.count_out}</b></div>
                <div className="row"><span>Di dalam</span><b>{s.metrics.occupancy}</b></div>
                <div className="row"><span>Total visitor</span><b>{s.metrics.total_visitors}</b></div>
                <div className="row"><span>Perlu konfirmasi</span><b>{s.metrics.ambiguous_pending}</b></div>
                <div className="row"><span>Pipeline</span><b>{s.metrics.pipeline_running ? "jalan" : "berhenti"}</b></div>
                <div className="row"><span>FPS / Uptime</span><b>{s.metrics.avg_fps} / {fmtUptime(s.metrics.uptime_s)}</b></div>
              </div>
            )}
            <a className="btn" href={`/site/${s.deviceId}`}>Detail 24 jam →</a>
          </div>
        ))}
      </div>

      {data?.ok && (data?.sites || []).length === 0 && !loading && (
        <div className="err">
          Tidak ada device tipe visitor-site di ThingsBoard. Buat device per site
          (tipe visitor-site) — lihat docs/THINGSBOARD_SETUP_CE.md.
        </div>
      )}
    </div>
  );
}
