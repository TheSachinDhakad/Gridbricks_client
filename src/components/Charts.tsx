import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { DashboardRow } from '../api/types';
import { dailyErrors, errorHistogram, hourOfDayProfile, isScored } from '../lib/analytics';
import { formatDateTime, formatDay, formatFullDateTime, formatGWTick, formatMW, formatNumber, leadHours } from '../lib/format';

const C = {
  actual: 'var(--series-actual)',
  forecast: 'var(--series-forecast)',
  over: 'var(--div-over)',
  under: 'var(--div-under)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  muted: 'var(--text-muted)',
  secondary: 'var(--text-secondary)',
};

const axisProps = {
  stroke: C.axis,
  tick: { fill: C.muted, fontSize: 12 },
  tickLine: false,
} as const;

const signColor = (v: number | null | undefined) => ((v ?? 0) > 0 ? C.over : C.under);

function TooltipShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-tooltip" role="status">
      <div className="chart-tooltip__title">{title}</div>
      {children}
    </div>
  );
}

function TooltipRow({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
  return (
    <div className="chart-tooltip__row">
      <span className="chart-tooltip__label">
        {swatch && <span className="swatch" style={{ background: swatch }} />}
        {label}
      </span>
      <span className="chart-tooltip__value">{value}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Forecast vs actual time series                                    */
/* ---------------------------------------------------------------- */

interface SeriesPoint {
  t: number;
  actual: number | null;
  forecast?: number | null;
  row: DashboardRow;
}

function ForecastTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const { row } = payload[0].payload as SeriesPoint;
  return (
    <TooltipShell title={formatFullDateTime(row.startTime)}>
      <TooltipRow swatch={C.actual} label="Actual" value={formatMW(row.actualGeneration)} />
      <TooltipRow swatch={C.forecast} label="Forecast" value={row.forecastGeneration == null ? 'No forecast' : formatMW(row.forecastGeneration)} />
      {row.errorMW != null && <TooltipRow label="Error (F − A)" value={formatMW(row.errorMW, { signed: true })} />}
      {row.forecastPublishTime && (
        <div className="chart-tooltip__note">
          Published {formatDateTime(row.forecastPublishTime)} · {leadHours(row.startTime, row.forecastPublishTime).toFixed(1)} h ahead
        </div>
      )}
    </TooltipShell>
  );
}

export function ForecastActualChart({ rows }: { rows: DashboardRow[] }) {
  const { all, forecastOnly } = useMemo(() => {
    const all: SeriesPoint[] = rows.map((row) => ({ t: new Date(row.startTime).getTime(), actual: row.actualGeneration, row }));
    // Forecasts are hourly; plot them on their own data so the line joins hour to hour.
    const forecastOnly: SeriesPoint[] = rows
      .filter((r) => r.forecastGeneration != null)
      .map((row) => ({ t: new Date(row.startTime).getTime(), actual: row.actualGeneration, forecast: row.forecastGeneration, row }));
    return { all, forecastOnly };
  }, [rows]);

  if (!rows.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={all} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(t) => formatDay(t)}
          minTickGap={32}
          {...axisProps}
        />
        <YAxis tickFormatter={formatGWTick} width={56} axisLine={false} {...axisProps} />
        <Tooltip content={<ForecastTooltip />} cursor={{ stroke: C.axis, strokeWidth: 1 }} />
        <Legend verticalAlign="top" align="right" height={32} iconType="plainline" wrapperStyle={{ fontSize: 13, color: C.secondary }} />
        <Line
          name="Actual generation"
          dataKey="actual"
          stroke={C.actual}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
          isAnimationActive={false}
        />
        <Line
          name="Forecast at decision time"
          data={forecastOnly}
          dataKey="forecast"
          stroke={C.forecast}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
          isAnimationActive={false}
        />
        <Brush
          dataKey="t"
          height={28}
          stroke={C.axis}
          fill="var(--surface-2)"
          travellerWidth={10}
          tickFormatter={(t) => formatDay(t)}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------- */
/* Daily mean error                                                  */
/* ---------------------------------------------------------------- */

export function DailyErrorChart({ rows }: { rows: DashboardRow[] }) {
  const data = useMemo(() => dailyErrors(rows), [rows]);
  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="day" tickFormatter={(d) => formatDay(`${d}T12:00:00Z`)} minTickGap={16} {...axisProps} />
        <YAxis tickFormatter={formatGWTick} width={56} axisLine={false} {...axisProps} />
        <ReferenceLine y={0} stroke={C.axis} />
        <Tooltip
          cursor={{ fill: 'var(--hover-fill)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof data)[number];
            return (
              <TooltipShell title={formatDay(`${p.day}T12:00:00Z`)}>
                <TooltipRow swatch={signColor(p.meanError)} label="Mean error" value={formatMW(p.meanError, { signed: true })} />
                <TooltipRow label="MAE" value={formatMW(p.mae)} />
                <TooltipRow label="Largest miss" value={formatMW(p.maxAbs)} />
                <div className="chart-tooltip__note">{p.count} scored hours</div>
              </TooltipShell>
            );
          }}
        />
        <Bar dataKey="meanError" name="Mean daily error" radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.day} fill={signColor(d.meanError)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------- */
/* Error distribution                                                */
/* ---------------------------------------------------------------- */

export function ErrorHistogramChart({ rows }: { rows: DashboardRow[] }) {
  const data = useMemo(() => errorHistogram(rows, 1000), [rows]);
  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="mid" tickFormatter={(v) => formatGWTick(v - 500)} interval="preserveStartEnd" minTickGap={12} {...axisProps} />
        <YAxis allowDecimals={false} width={40} axisLine={false} {...axisProps} />
        <Tooltip
          cursor={{ fill: 'var(--hover-fill)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const b = payload[0].payload as (typeof data)[number];
            return (
              <TooltipShell title={`${formatMW(b.from, { signed: true })} to ${formatMW(b.to, { signed: true })}`}>
                <TooltipRow swatch={signColor(b.mid)} label="Hours" value={`${b.count} (${(b.share * 100).toFixed(1)}%)`} />
              </TooltipShell>
            );
          }}
        />
        <Bar dataKey="count" name="Scored hours" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((b) => (
            <Cell key={b.from} fill={signColor(b.mid)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------- */
/* Hour-of-day profile                                               */
/* ---------------------------------------------------------------- */

export function HourProfileChart({ rows }: { rows: DashboardRow[] }) {
  const data = useMemo(() => hourOfDayProfile(rows).filter((p) => p.count > 0), [rows]);
  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={20} {...axisProps} />
        <YAxis tickFormatter={formatGWTick} width={56} axisLine={false} {...axisProps} />
        <ReferenceLine y={0} stroke={C.axis} />
        <Legend
          verticalAlign="top"
          align="right"
          height={32}
          wrapperStyle={{ fontSize: 13, color: C.secondary }}
          payload={[
            { value: 'Mean error (bias)', type: 'square', color: C.over },
            { value: 'Mean absolute error', type: 'plainline', color: C.secondary, payload: { strokeDasharray: '0' } },
          ]}
        />
        <Tooltip
          cursor={{ fill: 'var(--hover-fill)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof data)[number];
            return (
              <TooltipShell title={`${p.label} UK time`}>
                <TooltipRow swatch={signColor(p.meanError)} label="Mean error" value={formatMW(p.meanError, { signed: true })} />
                <TooltipRow swatch={C.secondary} label="MAE" value={formatMW(p.mae)} />
                <div className="chart-tooltip__note">{p.count} scored hours</div>
              </TooltipShell>
            );
          }}
        />
        <Bar dataKey="meanError" radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {data.map((p) => (
            <Cell key={p.hour} fill={signColor(p.meanError)} />
          ))}
        </Bar>
        <Line dataKey="mae" stroke={C.secondary} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------- */
/* Actual vs forecast scatter-like summary: share of hours           */
/* ---------------------------------------------------------------- */

export function DirectionSplit({ rows }: { rows: DashboardRow[] }) {
  const scored = rows.filter(isScored);
  const over = scored.filter((r) => r.errorMW > 0).length;
  const under = scored.filter((r) => r.errorMW < 0).length;
  const exact = scored.length - over - under;
  if (!scored.length) return null;
  const pct = (n: number) => (n / scored.length) * 100;
  return (
    <div className="split" aria-label="Share of scored hours by error direction">
      <div className="split__bar">
        <span style={{ width: `${pct(over)}%`, background: C.over }} />
        {exact > 0 && <span style={{ width: `${pct(exact)}%`, background: 'var(--div-mid)' }} />}
        <span style={{ width: `${pct(under)}%`, background: C.under }} />
      </div>
      <div className="split__legend">
        <span>
          <span className="swatch" style={{ background: C.over }} /> Over-forecast {pct(over).toFixed(0)}% ({formatNumber(over)} h)
        </span>
        <span>
          <span className="swatch" style={{ background: C.under }} /> Under-forecast {pct(under).toFixed(0)}% ({formatNumber(under)} h)
        </span>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="empty-chart">No scored intervals in this window.</div>;
}
