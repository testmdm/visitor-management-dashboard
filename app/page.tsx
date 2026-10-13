"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  if (!s || s < 0) return "\u2014";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTime(ts: number | null): string {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

export default function OverviewPage() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

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

  const sites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.sites || []).filter((s) => {
      if (onlineOnly && !s.online) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.label || "").toLowerCase().includes(q);
    });
  }, [data?.sites, query, onlineOnly]);

  return (
    <div className="wrap">
      <nav className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-title">Visitor Management</div>
            <div className="brand-sub">Multi-site operations \u00b7 via ThingsBoard</div>
          </div>
        </div>
        <div className="topbar-right">
          {agg && (
            <span className={`pill ${agg.offlineSites > 0 ? "warn" : "ok"}`}>
              <span className="dot" aria-hidden="true" />
              {agg.onlineSites}/{agg.totalSites} sites online
            </span>
          )}
          <button className="btn-ghost" onClick={load}>Refresh</button>
        </div>
      </nav>

      <div className="toolbar">
        <span>
          {loading
            ? "Loading\u2026"
            : updatedAt
              ? `Last updated: ${new Date(updatedAt).toLocaleTimeString("en-US")} (auto-refresh 30s)`
              : ""}
          {data?.tookMs != null ? ` \u00b7 fetch ${data.tookMs}ms` : ""}
        </span>
      </div>

      {!data?.ok && !loading && (
        <div className="err">
          Failed to load data: {data?.error || "unknown"}
          <br />
          Check the server env TB_BASE_URL / TB_USERNAME / TB_PASSWORD and ThingsBoard connectivity.
        </div>
      )}

      {agg && (
        <section aria-label="Network summary">
          <div className="grid-kpi">
            <div className="kpi">
              <div className="v">{agg.onlineSites}<span className="v-sub">/{agg.totalSites}</span></div>
              <div className="l">Sites online</div>
              {agg.offlineSites > 0 && <div className="l danger">{agg.offlineSites} offline</div>}
            </div>
            <div className="kpi"><div className="v">{fmtNum(agg.count_in)}</div><div className="l">Check-ins \u00b7 today</div></div>
            <div className="kpi"><div className="v">{fmtNum(agg.count_out)}</div><div className="l">Check-outs \u00b7 today</div></div>
            <div className="kpi"><div className="v">{fmtNum(agg.occupancy)}</div><div className="l">Inside \u00b7 all sites</div></div>
            <div className="kpi"><div className="v">{fmtNum(agg.total_visitors)}</div><div className="l">Total visitors</div></div>
            <div className="kpi"><div className="v">{fmtNum(agg.ambiguous_pending)}</div><div className="l">Pending review</div></div>
          </div>
        </section>
      )}

      <section aria-label="Sites">
        <div className="section-head">
          <h2>Sites</h2>
          <div className="filters">
            <input className="search" type="search" placeholder="Search sites\u2026" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Search sites" />
            <label className="check">
              <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
              Online only
            </label>
          </div>
        </div>

        <div className="grid-sites">
          {sites.map((s) => (
            <article key={s.deviceId} className={`card${s.online ? "" : " off"}`}>
              <div className="card-head">
                <div>
                  <h3>{s.name}</h3>
                  {s.label && <div className="meta">{s.label}</div>}
                </div>
                <span className={`badge ${s.online ? "on" : "off"}`}>
                  {s.online ? "\u25cf ONLINE" : "\u25cf OFFLINE"}
                </span>
              </div>
              <div className="meta">
                Last seen: {fmtTime(s.lastSeen)}
                {s.latencyMs != null ? ` \u00b7 ${s.latencyMs}ms` : ""}
              </div>
              {s.error && !s.metrics && (
                <div className="meta" style={{ color: "#fca5a5" }}>{s.error}</div>
              )}
              {s.metrics && (
                <dl className="metrics">
                  <div><dt>Check-in / out</dt><dd>{s.metrics.count_in} / {s.metrics.count_out}</dd></div>
                  <div><dt>Inside now</dt><dd>{s.metrics.occupancy}</dd></div>
                  <div><dt>Total visitors</dt><dd>{s.metrics.total_visitors}</dd></div>
                  <div><dt>Pending review</dt><dd>{s.metrics.ambiguous_pending}</dd></div>
                  <div><dt>Pipeline</dt><dd>{s.metrics.pipeline_running ? "Running" : "Stopped"}</dd></div>
                  <div><dt>FPS / Uptime</dt><dd>{s.metrics.avg_fps} / {fmtUptime(s.metrics.uptime_s)}</dd></div>
                </dl>
              )}
              <a className="btn" href={`/site/${s.deviceId}`}>View 24h details \u2192</a>
            </article>
          ))}
        </div>

        {data?.ok && sites.length === 0 && !loading && (
          <div className="err">
            {(data?.sites || []).length === 0
              ? "No visitor-site devices found in ThingsBoard. Create one device per site first."
              : "No sites match the current filter."}
          </div>
        )}
      </section>
    </div>
  );
}
