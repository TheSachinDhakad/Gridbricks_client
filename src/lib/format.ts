export const UK_TZ = 'Europe/London';

const mwFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const gwFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatMW(value: number | null | undefined, { signed = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const text = mwFormat.format(Math.abs(value));
  if (!signed) return `${value < 0 ? '−' : ''}${text} MW`;
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text} MW`;
}

export function formatNumber(value: number | null | undefined) {
  return value == null ? '—' : mwFormat.format(value);
}

/** Compact axis tick: 12000 → "12 GW". */
export function formatGWTick(value: number) {
  if (value === 0) return '0';
  return `${gwFormat.format(value / 1000).replace(/\.0$/, '')} GW`;
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const fullDateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK_TZ, day: 'numeric', month: 'short' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK_TZ, hour: '2-digit', hour12: false });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: UK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatDateTime = (iso: string | number) => dateTimeFmt.format(new Date(iso));
export const formatFullDateTime = (iso: string | number) => fullDateTimeFmt.format(new Date(iso));
export const formatDay = (iso: string | number) => dayFmt.format(new Date(iso));
/** Hour of day (0–23) in UK local time. */
export const ukHour = (iso: string) => Number(hourFmt.format(new Date(iso))) % 24;
/** YYYY-MM-DD in UK local time. */
export const ukDayKey = (iso: string) => dayKeyFmt.format(new Date(iso));

export function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
}

export function leadHours(startTime: string, publishTime: string) {
  return (new Date(startTime).getTime() - new Date(publishTime).getTime()) / 3_600_000;
}
