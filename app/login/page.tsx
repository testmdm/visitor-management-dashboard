"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";

/**
 * Standalone sign-in page — intentionally NOT wrapped in <AppShell>, otherwise
 * the auth guard would bounce an unauthenticated visitor straight to /login and
 * loop. Credentials are the user's own account (verified against the server).
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        // Ensure the httpOnly session cookie set by the login response is
        // committed before we navigate, so the guard on "/" sees a valid
        // session on its very first /api/auth/me check (no blank/redirect loop).
        router.replace("/");
        router.refresh();
        return;
      }
      setError(j.error || "Sign-in failed. Please try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-theme">
        <ThemeToggle />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="login-title">Visitor Management</div>
            <div className="login-sub">Multi-site operations console</div>
          </div>
        </div>

        <form className="login-form" onSubmit={onSubmit} noValidate>
          <label className="login-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="login-input"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
          />

          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="login-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={busy}
          />

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-foot">Use your account credentials to continue.</div>
      </div>
    </div>
  );
}
