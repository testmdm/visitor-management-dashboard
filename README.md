# Visitor Management Dashboard (multi-site via ThingsBoard CE)

Dashboard terpusat untuk semua site visitor-AI. Data ditarik dari ThingsBoard
(VPS publik). **Nama site = nama device di ThingsBoard** — tambah site cukup
buat device baru (tipe `visitor-site`), tanpa redeploy dashboard.

## Struktur

```
app/page.tsx                  ← overview semua site (grid + agregat)
app/site/[deviceId]/page.tsx  ← drill-down per site (grafik 24 jam)
app/api/sites/route.ts        ← agregat (server-side, pegang JWT TB)
app/api/sites/[deviceId]/route.ts ← timeseries 24 jam (server-side)
lib/tb.ts                     ← client TB (login, cache JWT, fetch)
```

Kredensial TB **hanya di server** (Route Handler). Env `TB_*` tanpa prefix
`NEXT_PUBLIC_` agar tidak bocor ke browser.

## Setup lokal

```bash
npm install
cp .env.example .env.local   # isi TB_BASE_URL / TB_USERNAME / TB_PASSWORD
npm run dev                  # http://localhost:3001
```

## Deploy ke Vercel

1. Push repo ini ke GitHub (repo terpisah).
2. Vercel → New Project → import repo.
3. Environment Variables (Production):
   - `TB_BASE_URL` = mis. `https://tb-anda.com`
   - `TB_USERNAME` = user read-only (Customer User)
   - `TB_PASSWORD` = password user itu
   - `TB_DEVICE_TYPE` = `visitor-site`
   - `TB_OFFLINE_AFTER_S` = `90`
4. Deploy. Tambah site baru = buat device di TB saja.

## Status online/offline

Online = latest telemetry device berumur < `TB_OFFLINE_AFTER_S` detik.
Site yang backend-nya mati berhenti kirim telemetry → otomatis 🔴.

## Prasyarat ThingsBoard

Lihat `../visitor-ai-enterprise/docs/THINGSBOARD_SETUP_CE.md`:
buat device per site (tipe `visitor-site`), catat token ke config backend site,
buat user read-only dan share device ke customer-nya.
