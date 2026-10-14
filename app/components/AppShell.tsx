"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/sites", label: "Sites", icon: "◉" },
];

type Me = { name: string; email: string; authority: string } | null;

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
  const router = useRouter();

  // ── Auth guard ─────────────────────────────────────────────────────────
  // Verify the session before rendering children. While checking we show a
  // splash and DO NOT render {children}, so the child data-fetches never fire
  // on a 401. On no/expired session we bounce to /login.
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState<Me>(null);

  const verify = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const j = await res.json();
      setMe(j.ok ? { name: j.name, email: j.email, authority: j.authority } : null);
    } catch {
      router.replace("/login");
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    verify();
  }, [verify]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.replace("/login");
  }

  if (checking) {
    return (
      <div className="auth-splash" role="status" aria-live="polite">
        <div className="auth-splash-card">
          <span className="brand-mark" aria-hidden="true" />
          <div className="auth-splash-title">Visitor Management</div>
          <div className="auth-splash-sub">Verifying your session…</div>
        </div>
      </div>
    );
  }

  if (!me) {
    // verify() already redirected; render nothing while navigating.
    return null;
  }

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
          <div className="side-label">Network</div>
          <div className="side-link" style={{ cursor: "default" }}>
            <span className="side-ico" aria-hidden="true">◈</span>
            All sites
          </div>
        </nav>
        <div className="side-foot">
          {connection ? (
            <span className={connection.online === connection.total ? "ok" : ""}>
              ● {connection.online}/{connection.total} sites online
            </span>
          ) : (
            "Operations console"
          )}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <div className="page-sub">{subtitle}</div>}
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            {actions}
            <div className="user-chip">
              <span className="user-avatar" aria-hidden="true">
                {me.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="user-meta">
                <span className="user-name" title={me.email}>{me.name}</span>
                {me.authority && <span className="user-role">{me.authority.replace(/_/g, " ").toLowerCase()}</span>}
              </span>
              <button className="btn-ghost user-logout" onClick={logout} title="Sign out">
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
