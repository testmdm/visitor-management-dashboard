"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/sites", label: "Sites", icon: "◉" },
];

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
  connection,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  connection?: { online: number; total: number } | null;
}) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-title">Visitor Management</div>
            <div className="brand-sub">Multi-site operations</div>
          </div>
        </div>
        <nav className="side-nav">
          <div className="side-label">Monitor</div>
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`side-link${active ? " active" : ""}`}>
                <span className="side-ico" aria-hidden="true">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
          <div className="side-label">Source</div>
          <div className="side-link" style={{ cursor: "default" }}>
            <span className="side-ico" aria-hidden="true">⛁</span>
            ThingsBoard
          </div>
        </nav>
        <div className="side-foot">
          {connection ? (
            <>
              <span className={connection.online === connection.total ? "ok" : ""}>
                ● {connection.online}/{connection.total} sites online
              </span>
              <br />
              via ThingsBoard
            </>
          ) : (
            "via ThingsBoard"
          )}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <div className="page-sub">{subtitle}</div>}
          </div>
          <div className="topbar-right">{actions}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
