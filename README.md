# Visitor Management Dashboard (multi-site via ThingsBoard CE)

Central management dashboard for all visitor-AI sites. Data is pulled from a
public ThingsBoard instance. **The site name is the ThingsBoard device name**
\u2014 adding a site means creating a new device (type `visitor-site`); no
dashboard redeploy is needed.

## Structure

```
app/page.tsx                    \u2190 overview: network KPIs + site grid + status
app/site/[deviceId]/page.tsx    \u2190 per-site drill-down (24h chart)
app/api/sites/route.ts          \u2190 aggregate (server-side, holds the TB JWT)
app/api/sites/[deviceId]/route.ts \u2190 24h timeseries (server-side)
lib/tb.ts                       \u2190 TB client (login, cached JWT, fetch)
```

TB credentials live **server-side only** (Route Handlers). Env vars use no
`NEXT_PUBLIC_` prefix so they never leak to the browser.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill TB_BASE_URL / TB_USERNAME / TB_PASSWORD
npm run dev                  # http://localhost:3001
```

## Deploy to Vercel

1. Push this repo to GitHub (standalone repo).
2. Vercel \u2192 New Project \u2192 import the repo.
3. Environment Variables (Production):
   - `TB_BASE_URL` = e.g. `https://tb-example.com`
   - `TB_USERNAME` = read-only user (Customer User)
   - `TB_PASSWORD` = that user\u2019s password
   - `TB_DEVICE_TYPE` = `visitor-site`
   - `TB_OFFLINE_AFTER_S` = `90`
4. Deploy. Adding a new site = create the device in TB only.

## Online / offline status

Online = the device\u2019s latest telemetry is younger than `TB_OFFLINE_AFTER_S`
seconds. A site whose backend stops pushing telemetry automatically shows \u25cf OFFLINE.

## Telemetry keys displayed

Each site device must publish these telemetry keys:

| Key | Meaning |
| --- | --- |
| `uniq_visitor` | Unique visitors (counter) |
| `overstay_count` | Overstay events (counter) |
| `avg_duration_s` | Average visit duration, seconds |

(`site_id` is still read as an optional identifier; online/offline status is
derived from the newest telemetry timestamp across those keys.)

## ThingsBoard prerequisites

See the ThingsBoard setup doc:
create one device per site (type `visitor-site`), copy its token into the
site backend config, and create a read-only user with the devices shared to
its customer.
