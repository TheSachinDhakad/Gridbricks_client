# UK Wind Forecast Accuracy — Frontend

React + TypeScript (Vite) dashboard for the GridBricks wind forecast API. It shows how accurately the day-ahead national
UK wind forecast (Elexon) predicted actual generation, and what the errors mean for procurement.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

## Configuration

| Variable            | Default                                   |
| ------------------- | ----------------------------------------- |
| `VITE_API_BASE_URL` | `https://gridbricks-sc0p.onrender.com/api` |

Copy `.env.example` to `.env` to override. All requests go through [src/api/client.ts](src/api/client.ts).

## API contract used

- `GET /health/` → `{ "status": "ok" }`. Drives the status pill.
- `GET /dashboard/?month=YYYY-MM&limit=N` returns the summary metrics, counts, and `rows[]` of half-hourly intervals.
  `errorMW = forecast − actual` (positive = over-forecast = wind shortfall).

### Known backend constraints

- `limit` must be 1–1000 (HTTP 400 otherwise), and there is no offset or paging. A 31-day month has 1,488 half-hourly
  intervals, so the time series covers only the first 1,000 (to 21 Jan 19:30 for January). The headline metrics are
  still computed by the backend over the full month, and the UI labels this clearly. To chart the full month, raise the
  backend cap to ≥ 1,488 or add an `offset` parameter.
- The backend runs on Render's free tier. The first request after it sleeps can take 30–60 s. The client allows 90 s
  and shows a "waking backend" message.

## Structure

```
src/
  api/          client.ts (fetch, timeout, errors) · types.ts
  hooks/        useApi.ts (health + dashboard state machines)
  lib/          analytics.ts (window stats, daily/hourly/histogram aggregation, CSV) · format.ts (UK time, MW)
  components/   Charts · Kpis · ProcurementPanel · DataTable · StatusPill
```

## Deploy

It is a static SPA. Build with `npm run build` and serve `dist/` from Vercel, Netlify or Render Static Sites. Set
`VITE_API_BASE_URL` in the host's build environment. The backend already returns `Access-Control-Allow-Origin: *`.
