import { useMemo, useState } from 'react';
import { API_BASE_URL, MAX_ROW_LIMIT } from './api/client';
import type { DashboardResponse } from './api/types';
import { DailyErrorChart, DirectionSplit, ErrorHistogramChart, ForecastActualChart, HourProfileChart } from './components/Charts';
import { DataTable } from './components/DataTable';
import { KpiGrid } from './components/Kpis';
import { ProcurementPanel } from './components/ProcurementPanel';
import { StatusPill } from './components/StatusPill';
import { useDashboard, useHealth } from './hooks/useApi';
import { computeWindowStats } from './lib/analytics';
import { formatDateTime, formatMonthLabel, formatMW } from './lib/format';

const DEFAULT_MONTH = '2026-01';

function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <header className="card__header">
        <h2>{title}</h2>
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function LoadingState({ slow }: { slow: boolean }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="kpi-grid">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="tile skeleton" />
        ))}
      </div>
      <div className="card skeleton skeleton--chart" />
      <p className="loading__message">
        <span className="spinner" aria-hidden />
        {slow
          ? 'The backend is waking up from sleep (Render free tier). This usually takes 30–60 seconds the first time.'
          : 'Loading forecast and outturn data…'}
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card error-state" role="alert">
      <h2>Couldn’t load the dashboard</h2>
      <p>{message}</p>
      <button type="button" className="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function Dashboard({ data }: { data: DashboardResponse }) {
  const rows = data.rows;
  const stats = useMemo(() => computeWindowStats(rows), [rows]);
  const truncated = data.returnedRows < data.intervalCount;
  const windowLabel = rows.length ? `${formatDateTime(rows[0].startTime)} to ${formatDateTime(rows[rows.length - 1].startTime)}` : 'no rows';

  return (
    <>
      <KpiGrid data={data} />

      {truncated && (
        <div className="notice" role="note">
          <strong>Partial time series.</strong> The API returns at most {MAX_ROW_LIMIT.toLocaleString('en-GB')} rows, so the charts
          and table cover {data.returnedRows.toLocaleString('en-GB')} of {data.intervalCount.toLocaleString('en-GB')} intervals (
          {windowLabel}). The headline metrics above are computed by the backend over the full month.
        </div>
      )}

      <Card
        title="Forecast vs actual wind generation"
        subtitle={
          <>
            Half-hourly national outturn against the latest forecast published at least {data.decisionLeadHours} h before delivery. Drag
            the handles below the chart to zoom.
          </>
        }
      >
        <ForecastActualChart rows={rows} />
      </Card>

      <div className="grid-2">
        <Card title="Daily mean forecast error" subtitle="Forecast − actual, averaged per day. Red: wind under-delivered; blue: wind beat forecast.">
          <DailyErrorChart rows={rows} />
        </Card>
        <Card title="Error distribution" subtitle="Scored hours by size and direction of miss, in 1 GW bins.">
          <ErrorHistogramChart rows={rows} />
          <DirectionSplit rows={rows} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Error by hour of day" subtitle="Bias and MAE by delivery hour (UK time). Shows whether some hours are systematically harder to forecast.">
          <HourProfileChart rows={rows} />
        </Card>
        <Card
          title="Procurement exposure"
          subtitle={
            <>
              What the errors mean for buying decisions. Loaded-window bias {formatMW(stats.meanError, { signed: true })}, MAE{' '}
              {formatMW(stats.mae)}.
            </>
          }
        >
          <ProcurementPanel stats={stats} windowLabel={windowLabel} />
        </Card>
      </div>

      <Card title="Interval data" subtitle="Every settlement period returned by the API. Use it to audit any figure on this page.">
        <DataTable rows={rows} month={data.month} />
      </Card>

      <Card title="Methodology" className="methodology">
        <ul>
          <li>
            <strong>Source.</strong> Elexon BMRS national UK wind generation outturn and wind generation forecasts, served by the
            project API. No other data is used.
          </li>
          <li>
            <strong>Decision-time forecast.</strong> For each settlement period, the forecast used is the latest one published at
            least {data.decisionLeadHours} h before the period starts, matching a day-ahead purchase.
            {stats.minLead != null && stats.maxLead != null && (
              <> In the loaded data, actual lead times range from {stats.minLead.toFixed(1)} h to {stats.maxLead.toFixed(1)} h.</>
            )}
          </li>
          <li>
            <strong>Error sign.</strong> Error = forecast − actual. Positive (▲, red) means less wind arrived than forecast, so
            extra energy must be procured. Negative (▼, blue) means a surplus.
          </li>
          <li>
            <strong>Missing forecasts.</strong> Forecasts are hourly while outturn is half-hourly, and some periods have no
            forecast meeting the lead-time rule. Those intervals are shown but not scored.
          </li>
          <li>
            <strong>Metrics.</strong> MAE = mean |error|; RMSE = √mean(error²); mean bias = mean(error); MAE % = MAE ÷ mean
            actual generation. The headline tiles come from the backend for the full month. Panels labelled “loaded window” are
            computed in the browser from the returned rows.
          </li>
          <li>
            <strong>Time zone.</strong> All times are shown in UK local time (GMT in January).
          </li>
        </ul>
      </Card>
    </>
  );
}

export default function App() {
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const health = useHealth();
  const { state, reload } = useDashboard(month);

  const retryAll = () => {
    health.recheck();
    reload();
  };

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__title">
          <p className="eyebrow">UK wholesale · Day-ahead wind risk</p>
          <h1>Wind Forecast Accuracy</h1>
          <p className="masthead__lede">
            How well did the day-ahead national wind forecast predict actual generation in {formatMonthLabel(month)}, and what did the
            misses mean for procurement?
          </p>
        </div>
        <div className="masthead__controls">
          <StatusPill state={health.state} onRetry={health.recheck} />
          <label className="select">
            Month
            <input
              type="month"
              value={month}
              max="2026-12"
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button button--ghost"
            onClick={reload}
            disabled={state.status === 'loading'}
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="content">
        {state.status === 'loading' && !state.previous && <LoadingState slow={state.slow} />}
        {state.status === 'loading' && state.previous && (
          <>
            <p className="inline-loading" role="status">
              <span className="spinner" aria-hidden /> {state.slow ? 'Waking the backend…' : 'Updating…'}
            </p>
            <div className="dim">
              <Dashboard data={state.previous} />
            </div>
          </>
        )}
        {state.status === 'error' && (
          <>
            <ErrorState message={state.error} onRetry={retryAll} />
            {state.previous && (
              <div className="dim">
                <Dashboard data={state.previous} />
              </div>
            )}
          </>
        )}
        {state.status === 'success' && <Dashboard data={state.data} />}
      </main>

      <footer className="footer">
        <span>Data: Elexon BMRS via {API_BASE_URL.replace(/^https?:\/\//, '')}</span>
        {state.status === 'success' && <span>Fetched {state.fetchedAt.toLocaleTimeString('en-GB')}</span>}
      </footer>
    </div>
  );
}
