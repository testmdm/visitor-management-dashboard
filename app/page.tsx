"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import { fmtNum, fmtTime, fmtUptime, type Site, type SitesResp } from "./components/types";

type View = "table" | "cards";
type SortKey = "status" | "name" | "in" | "inside";

function sortSites(list: Site[], key: SortKey): Site[] {
  const arr = [...list];
  switch (key) {
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "in":
      return arr.sort((a, b) => (b.metrics?.count_in ?? -1) - (a.metrics?.count_in ?? -1));
    case "inside":
      return arr.sort((a, b) => (b.metrics?.occupancy ?? -1) - (a.metrics?.occupancy ?? -1));
    case "status":
    default:
      return arr.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }
}

export default function OverviewPage() {
  const [data, setData] = useState<SitesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [view, setView] = useState<View>("table");
  const [sort, setSort] = useState<SortKey>("status");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sites", { cache: "no-store" });
      const j = (await res.json()) as SitesResp;
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
    const filtered = (data?.sites || []).filter((s) => {
      if (onlineOnly && !s.online) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.label || "").toLowerCase().includes(q);
    });
    return sortSites(filtered, sort);
  }, [data?.sites, query, onlineOnly, sort]);

  return (
    <AppShell
      title="Network overview"
      subtitle={updatedAt ? `Last updated ${new Date(updatedAt).toLocaleTimeString("en-US")} \u00b7 auto-refresh 30s${data?.tookMs != null ? ` \u00b7 fetch ${data.tookMs}ms` : ""}` : "Multi-site operations console"}
      connection={agg ? { online: agg.onlineSites, total: agg.totalSites } : null}
      actions={<button className="btn-ghost" onClick={load}>Refresh</button>}
    >
      {loading && !data && (
        <div className="grid-kpi" aria-label="Loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="kpi" key={i}><div className="skel" style={{ height: 30 }} /><div className="skel" style={{ height: 12, marginTop: 8, width: "60%" }} /></div>
          ))}
        </div>
      )}

      {!data?.ok && !loading && (
        <div className="err" role="alert">
          Failed to load data: {data?.error || "unknown"}
          <br />
          Check the server env TB_BASE_URL / TB_USERNAME / TB_PASSWORD and ThingsBoard connectivity.
          <br />
          <button className="btn-ghost" style={{ marginTop: 10 }} onClick={load}>Retry</button>
        </div>
      )}

      {agg && (
        <section aria-label="Network summary">
          <div className="grid-kpi">
            <div className={`kpi ${agg.offlineSites > 0 ? "red" : "green"}`}>
              <div className="v">{agg.onlineSites}<span className="v-sub">/{agg.totalSites}</span></div>
              <div className="l">Sites online</div>
              {agg.offlineSites > 0 && <div className="l danger">{agg.offlineSites} offline</div>}
            </div>
            <div className="kpi"><div className="v">{fmtNum(agg.count_in)}</div><div className="l">Check-ins \u00b7 today</div></div>
            <div className="kpi"><div className="v">{fmtNum(agg.occupancy)}</div><div className="l">Inside \u00b7 all sites</div></div>
            <div className={`kpi ${agg.ambiguous_pending > 0 ? "amber" : ""}`}><div className="v">{fmtNum(agg.ambiguous_pending)}</div><div className="l">Pending review</div></div>
          </div>
        </section>
      )}

      <section className="panel" aria-label="Sites">
        <div className="panel-head">
          <h2>Sites</h2>
          <div className="filters">
            <input className="search" type="search" placeholder="Search sites\u2026" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Search sites" />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="search" style={{ minWidth: 0 }} aria-label="Sort sites">
              <option value="status">Sort: status</option>
              <option value="name">Sort: name</option>
              <option value="in">Sort: check-ins</option>
              <option value="inside">Sort: inside now</option>
            </select>
            <label className="check">
              <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
              Online only
            </label>
            <div className="seg" role="tablist" aria-label="Layout">
              <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Table</button>
              <button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>Cards</button>
            </div>
          </div>
        </div>
        <div className="panel-body">
          {view === "table" ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Status</th><th>Site</th><th>In / Out</th><th>Inside</th>
                    <th>Pending</th><th>Pipeline</th><th>Last seen</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={s.deviceId} className={s.online ? "" : "row-off"}>
                      <td><span className={`badge ${s.online ? "on" : "off"}`}>{s.online ? "\u25cf ONLINE" : "\u25cf OFFLINE"}</span></td>
                      <td><div className="site-name">{s.name}</div>{s.label && <div className="site-sub">{s.label}</div>}</td>
                      <td className="num">{s.metrics ? `${s.metrics.count_in} / ${s.metrics.count_out}` : "\u2014"}</td>
                      <td className="num">{s.metrics ? s.metrics.occupancy : "\u2014"}</td>
                      <td className="num">{s.metrics ? s.metrics.ambiguous_pending : "\u2014"}</td>
                      <td>{s.metrics ? (s.metrics.pipeline_running ? "Running" : "Stopped") : "\u2014"}</td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>{fmtTime(s.lastSeen)}{s.latencyMs != null ? ` \u00b7 ${s.latencyMs}ms` : ""}</td>
                      <td><a className="link-btn" href={`/site/${s.deviceId}`}>View \u2192</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.ok && sites.length === 0 && !loading && (
                <div className="empty">{(data?.sites || []).length === 0 ? "No visitor-site devices found in ThingsBoard." : "No sites match the current filter."}</div>
              )}
            </div>
          ) : (
            <>
              <div className="grid-sites">
                {sites.map((s) => (
                  <article key={s.deviceId} className={`card${s.online ? "" : " off"}`}>
                    <div className="card-head">
                      <div><h3>{s.name}</h3>{s.label && <div className="meta">{s.label}</div>}</div>
                      <span className={`badge ${s.online ? "on" : "off"}`}>{s.online ? "\u25cf ONLINE" : "\u25cf OFFLINE"}</span>
                    </div>
                    <div className="meta">Last seen: {fmtTime(s.lastSeen)}{s.latencyMs != null ? ` \u00b7 ${s.latencyMs}ms` : ""}</div>
                    {s.metrics && (
                      <dl className="metrics">
                        <div><dt>Check-in / out</dt><dd>{s.metrics.count_in} / {s.metrics.count_out}</dd></div>
                        <div><dt>Inside now</dt><dd>{s.metrics.occupancy}</dd></div>
                        <div><dt>Pending review</dt><dd>{s.metrics.ambiguous_pending}</dd></div>
                        <div><dt>FPS / Uptime</dt><dd>{s.metrics.avg_fps} / {fmtUptime(s.metrics.uptime_s)}</dd></div>
                      </dl>
                    )}
                    <a className="btn" href={`/site/${s.deviceId}`}>View 24h details \u2192</a>
                  </article>
                ))}
              </div>
              {data?.ok && sites.length === 0 && !loading && (
                <div className="empty">{(data?.sites || []).length === 0 ? "No visitor-site devices found in ThingsBoard." : "No sites match the current filter."}</div>
              )}
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
