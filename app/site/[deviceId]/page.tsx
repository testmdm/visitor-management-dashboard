"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppShell from "../../components/AppShell";
import { fmtNum, type Site, type SitesResp } from "../../components/types";

interface Pt { ts: number; value: number; }
interface DetailResp { ok: boolean; error?: string; hours?: number; series?: Record<string, Pt[]>; }
interface Row { t: string; checkins: number; checkouts: number; inside: number; }

const HOURS = [24, 72, 168];

function fmtHour(ts: number): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SiteDetail({ params }: { params: { deviceId: string } }) {
  const [data, setData] = useState<DetailResp | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const load = useCallback(async (h: number) => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        fetch(`/api/sites/${params.deviceId}?hours=${h}`, { cache: "no-store" }).then((r) => r.json() as Promise<DetailResp>),
        fetch("/api/sites", { cache: "no-store" }).then((r) => r.json() as Promise<SitesResp>).catch(() => null),
      ]);
      setData(d);
      if (s?.ok && s.sites) setSites(s.sites);
    } catch (e) {
      setData({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }, [params.deviceId]);

  useEffect(() => { load(hours); }, [load, hours]);

  const s = data?.series;
  const rows: Row[] = useMemo(() => {
    if (!s) return [];
    const byTs = new Map<number, { checkins: number; checkouts: number; inside: number }>();
    for (const p of s.count_in || []) { const e = byTs.get(p.ts) || { checkins: 0, checkouts: 0, inside: 0 }; e.checkins = p.value; byTs.set(p.ts, e); }
    for (const p of s.count_out || []) { const e = byTs.get(p.ts) || { checkins: 0, checkouts: 0, inside: 0 }; e.checkouts = p.value; byTs.set(p.ts, e); }
    for (const p of s.occupancy || []) { const e = byTs.get(p.ts) || { checkins: 0, checkouts: 0, inside: 0 }; e.inside = p.value; byTs.set(p.ts, e); }
    return Array.from(byTs.entries()).sort((a, b) => a[0] - b[0]).map(([ts, e]) => ({ t: fmtHour(ts), ...e }));
  }, [s]);

  const totals = rows.reduce((a, r) => ({ checkins: a.checkins + r.checkins, checkouts: a.checkouts + r.checkouts }), { checkins: 0, checkouts: 0 });
  const lastInside = rows.length > 0 ? rows[rows.length - 1].inside : 0;
  const site = sites.find((x) => x.deviceId === params.deviceId);
  const idx = sites.findIndex((x) => x.deviceId === params.deviceId);
  const prev = idx > 0 ? sites[idx - 1] : null;
  const next = idx >= 0 && idx < sites.length - 1 ? sites[idx + 1] : null;

  return (
    <AppShell
      title={site ? site.name : "Site detail"}
      subtitle={`Last ${hours}h \u00b7 ${params.deviceId}`}
      actions={
        <>
          <div className="hours-seg" role="tablist" aria-label="Time range">
            {HOURS.map((h) => (
              <button key={h} className={hours === h ? "active" : ""} onClick={() => setHours(h)}>{h >= 168 ? "7d" : `${h}h`}</button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => load(hours)}>Refresh</button>
        </>
      }
    >
      <a className="crumb" href="/">\u2190 All sites</a>
      {site && (
        <div style={{ margin: "6px 0 12px" }}>
          <span className={`badge ${site.online ? "on" : "off"}`}>{site.online ? "\u25cf ONLINE" : "\u25cf OFFLINE"}</span>
        </div>
      )}

      {loading && !data && (
        <div className="grid-kpi">{Array.from({ length: 3 }).map((_, i) => (
          <div className="kpi" key={i}><div className="skel" style={{ height: 30 }} /><div className="skel" style={{ height: 12, marginTop: 8, width: "60%" }} /></div>))}
        </div>
      )}

      {!data?.ok && !loading && <div className="err" role="alert">Failed to load: {data?.error || "unknown"}</div>}

      {data?.ok && (
        <>
          <div className="grid-kpi">
            <div className="kpi"><div className="v">{fmtNum(totals.checkins)}</div><div className="l">Check-ins \u00b7 {hours}h</div></div>
            <div className="kpi"><div className="v">{fmtNum(totals.checkouts)}</div><div className="l">Check-outs \u00b7 {hours}h</div></div>
            <div className="kpi"><div className="v">{fmtNum(lastInside)}</div><div className="l">Inside \u00b7 latest</div></div>
          </div>
          <section className="panel chart-card" aria-label="Traffic chart">
            <div style={{ width: "100%", height: 440 }}>
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#263049" />
                  <XAxis dataKey="t" stroke="#9aa3b8" fontSize={11} tickLine={false} minTickGap={40} />
                  <YAxis stroke="#9aa3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#141926", border: "1px solid #263049", borderRadius: 10 }} />
                  <Legend />
                  <Line type="monotone" dataKey="checkins" name="Check-ins" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="checkouts" name="Check-outs" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="inside" name="Inside" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="meta">Hourly aggregates from ThingsBoard (SUM, 1-hour interval).</div>
          </section>
          {(prev || next) && (
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <span>{prev ? <a className="link-btn" href={`/site/${prev.deviceId}`}>\u2190 {prev.name}</a> : <span />}</span>
              <span>{next ? <a className="link-btn" href={`/site/${next.deviceId}`}>{next.name} \u2192</a> : <span />}</span>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
