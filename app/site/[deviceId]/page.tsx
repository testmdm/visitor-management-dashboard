"use client";

import { useCallback, useEffect, useState } from "react";
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

interface Pt {
  ts: number;
  value: number;
}

interface DetailResp {
  ok: boolean;
  error?: string;
  hours?: number;
  series?: Record<string, Pt[]>;
}

interface Row {
  t: string;
  checkins: number;
  checkouts: number;
  inside: number;
}

function fmtHour(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function SiteDetail({ params }: { params: { deviceId: string } }) {
  const [data, setData] = useState<DetailResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${params.deviceId}?hours=24`, { cache: "no-store" });
      setData((await res.json()) as DetailResp);
    } catch (e) {
      setData({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }, [params.deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.series;
  const rows: Row[] = [];
  if (s) {
    const byTs = new Map<number, { checkins: number; checkouts: number; inside: number }>();
    for (const p of s.count_in || []) {
      const e = byTs.get(p.ts) || { checkins: 0, checkouts: 0, inside: 0 };
      e.checkins = p.value;
      byTs.set(p.ts, e);
    }
    for (const p of s.count_out || []) {
      const e = byTs.get(p.ts) || { checkins: 0, checkouts: 0, inside: 0 };
      e.checkouts = p.value;
      byTs.set(p.ts, e);
    }
    for (const p of s.occupancy || []) {
      const e = byTs.get(p.ts) || { checkins: 0, checkouts: 0, inside: 0 };
      e.inside = p.value;
      byTs.set(p.ts, e);
    }
    for (const [ts, e] of Array.from(byTs.entries()).sort((a, b) => a[0] - b[0])) {
      rows.push({ t: fmtHour(ts), ...e });
    }
  }

  const totals = rows.reduce(
    (a, r) => ({ checkins: a.checkins + r.checkins, checkouts: a.checkouts + r.checkouts }),
    { checkins: 0, checkouts: 0 }
  );
  const lastInside = rows.length > 0 ? rows[rows.length - 1].inside : 0;

  return (
    <div className="wrap">
      <a className="crumb" href="/">\u2190 All sites</a>
      <div className="detail-head">
        <div>
          <h1>Site detail \u2014 last 24 hours</h1>
          <div className="meta">{params.deviceId}</div>
        </div>
        <div className="topbar-right">
          <button className="btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>
      <div className="toolbar">
        <span>{loading ? "Loading\u2026" : `Window: last ${data?.hours ?? 24}h`}</span>
      </div>

      {!data?.ok && !loading && (
        <div className="err">Failed to load: {data?.error || "unknown"}</div>
      )}

      {data?.ok && (
        <>
          <div className="grid-kpi">
            <div className="kpi"><div className="v">{totals.checkins}</div><div className="l">Check-ins \u00b7 24h</div></div>
            <div className="kpi"><div className="v">{totals.checkouts}</div><div className="l">Check-outs \u00b7 24h</div></div>
            <div className="kpi"><div className="v">{lastInside}</div><div className="l">Inside \u00b7 latest</div></div>
          </div>
          <div className="card chart-card">
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#263049" />
                  <XAxis dataKey="t" stroke="#9aa3b8" fontSize={11} tickLine={false} />
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
          </div>
        </>
      )}
    </div>
  );
}
