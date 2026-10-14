import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visitor Management — Multi-Site Overview",
  description: "Central management dashboard for all visitor-AI sites",
};

// Runs before paint: applies stored theme (or OS preference, dark fallback)
// so there is no dark/light flash on load.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('vm-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
