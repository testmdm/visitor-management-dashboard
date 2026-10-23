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
import { fmtDuration, fmtNum, type Site, type SitesResp } from "../../components/types";

interface Pt { ts: number; value: number; }
interface DetailResp { ok: boolean; error?: string; hours?: number; series?: Record<string, Pt[]>; }
interface Row { t: string; visitors: number; overstays: number; avgDurationS: number; }

const HOURS = [24, 72, 168];

function fmtHour(ts: number): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function chartTheme(): {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
} {
  if (typeof document !== "undefined") {
    const cs = getComputedStyle(document.documentElement);
    const line = cs.getPropertyValue("--line").trim();
    const muted = cs.getPropertyValue("--muted").trim();
    const panel = cs.getPropertyValue("--panel").trim();
    if (line && muted && panel) {
      return { grid: line, axis: muted, tooltipBg: panel, tooltipBorder: line };
    }
  }
  return { grid: "#263049", axis: "#9aa3b8", tooltipBg: "#141926", tooltipBorder: "#263049" };
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
    const byTs = new Map<number, { visitors: number; overstays: number; avgDurationS: number }>();
    const put = (key: string, field: "visitors" | "overstays" | "avgDurationS") => {
      for (const p of s[key] || []) {
        const e = byTs.get(p.ts) || { visitors: 0, overstays: 0, avgDurationS: 0 };
        e[field] = p.value;
        byTs.set(p.ts, e);
      }
    };
    put("uniq_visitor", "visitors");
    put("overstay_count", "overstays");
    put("avg_duration_s", "avgDurationS");
    return Array.from(byTs.entries()).sort((a, b) => a[0] - b[0]).map(([ts, e]) => ({ t: fmtHour(ts), ...e }));
  }, [s]);

  const totals = rows.reduce(
    (a, r) => ({
      visitors: a.visitors + r.visitors,
      overstays: a.overstays + r.overstays,
      durSum: a.durSum + r.avgDurationS * (r.visitors > 0 ? 1 : 0),
      durN: a.durN + (r.visitors > 0 && r.avgDurationS > 0 ? 1 : 0),
    }),
    { visitors: 0, overstays: 0, durSum: 0, durN: 0 }
  );
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const overallAvgDuration = totals.durN > 0 ? Math.round(totals.durSum / totals.durN) : 0;
  const ct = chartTheme();
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
            <div className="kpi"><div className="v">{fmtNum(totals.visitors)}</div><div className="l">Unique visitors · {hours}h</div></div>
            <div className={`kpi ${totals.overstays > 0 ? "amber" : ""}`}><div className="v">{fmtNum(totals.overstays)}</div><div className="l">Overstays · {hours}h</div></div>
            <div className="kpi"><div className="v">{fmtDuration(overallAvgDuration)}</div><div className="l">Avg visit duration · {hours}h</div></div>
            <div className="kpi"><div className="v">{lastRow ? fmtNum(lastRow.visitors) : "—"}</div><div className="l">Visitors · latest hour</div></div>
          </div>
          <section className="panel chart-card" aria-label="Traffic chart">
            <div style={{ width: "100%", height: 440 }}>
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="t" stroke={ct.axis} fontSize={12} tickLine={false} minTickGap={40} />
                  <YAxis stroke={ct.axis} fontSize={12} tickLine={false} allowDecimals={false} />
                  <YAxis
                    yAxisId="dur"
                    orientation="right"
                    stroke={ct.axis}
                    fontSize={12}
                    tickLine={false}
                    allowDecimals={false}
                    tickFormatter={(v: number) => fmtDuration(v)}
                  />
                  <Tooltip
                    contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 10 }}
                    labelStyle={{ color: ct.axis }}
                    itemStyle={{ color: ct.axis }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="visitors" name="Unique visitors" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="overstays" name="Overstays" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgDurationS" name="Avg duration (s)" stroke="#f59e0b" strokeWidth={2} dot={false} yAxisId="dur" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="meta">Hourly aggregates from ThingsBoard (SUM for counters, AVG for duration).</div>
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
