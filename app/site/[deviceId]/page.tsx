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

function fmtHour(ts: number): string {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
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
  const rows: { t: string; masuk: number; keluar: number; diDalam: number }[] = [];
  if (s) {
    const byTs = new Map<number, { masuk: number; keluar: number; diDalam: number }>();
    for (const p of s.count_in || []) {
      const e = byTs.get(p.ts) || { masuk: 0, keluar: 0, diDalam: 0 };
      e.masuk = p.value;
      byTs.set(p.ts, e);
    }
    for (const p of s.count_out || []) {
      const e = byTs.get(p.ts) || { masuk: 0, keluar: 0, diDalam: 0 };
      e.keluar = p.value;
      byTs.set(p.ts, e);
    }
    for (const p of s.occupancy || []) {
      const e = byTs.get(p.ts) || { masuk: 0, keluar: 0, diDalam: 0 };
      e.diDalam = p.value;
      byTs.set(p.ts, e);
    }
    for (const [ts, e] of Array.from(byTs.entries()).sort((a, b) => a[0] - b[0])) {
      rows.push({ t: fmtHour(ts), ...e });
    }
  }

  return (
    <div className="wrap">
      <div className="header">
        <h1>Detail Site — 24 jam</h1>
        <span className="sub">{params.deviceId}</span>
      </div>
      <div className="toolbar">
        <a className="btn" href="/">← Semua site</a>
        <button onClick={load}>Muat ulang</button>
        <span>{loading ? "Memuat…" : ""}</span>
      </div>

      {!data?.ok && !loading && (
        <div className="err">Gagal memuat: {data?.error || "unknown"}</div>
      )}

      {data?.ok && (
        <div className="card">
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263049" />
                <XAxis dataKey="t" stroke="#9aa3b8" fontSize={11} />
                <YAxis stroke="#9aa3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#141926", border: "1px solid #263049" }}
                />
                <Legend />
                <Line type="monotone" dataKey="masuk" stroke="#22c55e" dot={false} />
                <Line type="monotone" dataKey="keluar" stroke="#3b82f6" dot={false} />
                <Line type="monotone" dataKey="diDalam" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="meta">Agregat per jam dari ThingsBoard (SUM, interval 1 jam).</div>
        </div>
      )}
    </div>
  );
}
