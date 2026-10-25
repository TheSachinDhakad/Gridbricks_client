import type { DashboardRow, ScoredRow } from '../api/types';
import { leadHours, ukDayKey, ukHour } from './format';

export function isScored(row: DashboardRow): row is ScoredRow {
  return row.forecastGeneration != null && row.actualGeneration != null && row.errorMW != null;
}

/** Linear-interpolated quantile of a pre-sorted array. */
export function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface WindowStats {
  scoredCount: number;
  meanError: number | null;
  mae: number | null;
  rmse: number | null;
  overForecastShare: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  worstShortfall: ScoredRow | null;
  worstSurplus: ScoredRow | null;
  meanActual: number | null;
  minLead: number | null;
  maxLead: number | null;
}

/** Statistics over the rows actually returned by the API (the "loaded window"). */
export function computeWindowStats(rows: DashboardRow[]): WindowStats {
  const scored = rows.filter(isScored);
  const errors = scored.map((r) => r.errorMW).sort((a, b) => a - b);
  const leads = scored
    .filter((r) => r.forecastPublishTime)
    .map((r) => leadHours(r.startTime, r.forecastPublishTime as string));

  let worstShortfall: ScoredRow | null = null;
  let worstSurplus: ScoredRow | null = null;
  for (const r of scored) {
    if (r.errorMW > 0 && (!worstShortfall || r.errorMW > worstShortfall.errorMW)) worstShortfall = r;
    if (r.errorMW < 0 && (!worstSurplus || r.errorMW < worstSurplus.errorMW)) worstSurplus = r;
  }

  return {
    scoredCount: scored.length,
    meanError: mean(errors),
    mae: mean(scored.map((r) => r.absoluteErrorMW)),
    rmse: errors.length ? Math.sqrt(mean(errors.map((e) => e * e)) as number) : null,
    overForecastShare: scored.length ? scored.filter((r) => r.errorMW > 0).length / scored.length : null,
    p10: quantile(errors, 0.1),
    p50: quantile(errors, 0.5),
    p90: quantile(errors, 0.9),
    worstShortfall,
    worstSurplus,
    meanActual: mean(rows.filter((r) => r.actualGeneration != null).map((r) => r.actualGeneration as number)),
    minLead: leads.length ? Math.min(...leads) : null,
    maxLead: leads.length ? Math.max(...leads) : null,
  };
}

export interface DailyErrorPoint {
  day: string;
  time: number;
  meanError: number;
  mae: number;
  maxAbs: number;
  count: number;
}

export function dailyErrors(rows: DashboardRow[]): DailyErrorPoint[] {
  const byDay = new Map<string, ScoredRow[]>();
  for (const r of rows.filter(isScored)) {
    const key = ukDayKey(r.startTime);
    const list = byDay.get(key) ?? [];
    list.push(r);
    byDay.set(key, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      time: new Date(`${day}T12:00:00Z`).getTime(),
      meanError: mean(list.map((r) => r.errorMW)) as number,
      mae: mean(list.map((r) => r.absoluteErrorMW)) as number,
      maxAbs: Math.max(...list.map((r) => r.absoluteErrorMW)),
      count: list.length,
    }));
}

export interface HourProfilePoint {
  hour: number;
  label: string;
  meanError: number | null;
  mae: number | null;
  count: number;
}

export function hourOfDayProfile(rows: DashboardRow[]): HourProfilePoint[] {
  const buckets: ScoredRow[][] = Array.from({ length: 24 }, () => []);
  for (const r of rows.filter(isScored)) buckets[ukHour(r.startTime)].push(r);
  return buckets.map((list, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    meanError: mean(list.map((r) => r.errorMW)),
    mae: mean(list.map((r) => r.absoluteErrorMW)),
    count: list.length,
  }));
}

export interface HistogramBin {
  from: number;
  to: number;
  mid: number;
  count: number;
  share: number;
}

export function errorHistogram(rows: DashboardRow[], binWidth = 1000): HistogramBin[] {
  const errors = rows.filter(isScored).map((r) => r.errorMW);
  if (!errors.length) return [];
  const start = Math.floor(Math.min(...errors) / binWidth) * binWidth;
  const end = Math.ceil(Math.max(...errors) / binWidth) * binWidth || start + binWidth;
  const bins: HistogramBin[] = [];
  for (let from = start; from < end; from += binWidth) {
    bins.push({ from, to: from + binWidth, mid: from + binWidth / 2, count: 0, share: 0 });
  }
  for (const e of errors) {
    const idx = Math.min(Math.floor((e - start) / binWidth), bins.length - 1);
    bins[idx].count += 1;
  }
  bins.forEach((b) => (b.share = b.count / errors.length));
  return bins;
}

export function rowsToCsv(rows: DashboardRow[]) {
  const header = ['startTime', 'forecastPublishTime', 'forecastGenerationMW', 'actualGenerationMW', 'errorMW', 'absoluteErrorMW'];
  const lines = rows.map((r) =>
    [r.startTime, r.forecastPublishTime ?? '', r.forecastGeneration ?? '', r.actualGeneration ?? '', r.errorMW ?? '', r.absoluteErrorMW ?? ''].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
