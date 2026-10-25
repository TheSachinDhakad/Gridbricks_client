import { useMemo, useState } from 'react';
import type { DashboardRow } from '../api/types';
import { isScored, rowsToCsv } from '../lib/analytics';
import { formatDateTime, formatMW, leadHours } from '../lib/format';

type Filter = 'all' | 'scored' | 'missing';
type Sort = 'time' | 'absError';

const PAGE_SIZE = 25;

export function DataTable({ rows, month }: { rows: DashboardRow[]; month: string }) {
  const [filter, setFilter] = useState<Filter>('scored');
  const [sort, setSort] = useState<Sort>('time');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => (filter === 'all' ? true : filter === 'scored' ? isScored(r) : !isScored(r)));
    if (sort === 'absError') return [...list].sort((a, b) => (b.absoluteErrorMW ?? -1) - (a.absoluteErrorMW ?? -1));
    return list;
  }, [rows, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const downloadCsv = () => {
    const blob = new Blob([rowsToCsv(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uk-wind-forecast-${month}-${filter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter rows">
          {(['scored', 'missing', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
            >
              {f === 'scored' ? 'Scored' : f === 'missing' ? 'No forecast' : 'All'}
            </button>
          ))}
        </div>
        <label className="select">
          Sort
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPage(0);
            }}
          >
            <option value="time">By time</option>
            <option value="absError">Largest error first</option>
          </select>
        </label>
        <span className="muted toolbar__count">{filtered.length.toLocaleString('en-GB')} rows</span>
        <button type="button" className="button button--ghost" onClick={downloadCsv} disabled={!filtered.length}>
          Export CSV
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Settlement period (UK)</th>
              <th scope="col">Forecast published</th>
              <th scope="col" className="num">Lead</th>
              <th scope="col" className="num">Forecast</th>
              <th scope="col" className="num">Actual</th>
              <th scope="col" className="num">Error (F − A)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.startTime}>
                <td>{formatDateTime(r.startTime)}</td>
                <td>{r.forecastPublishTime ? formatDateTime(r.forecastPublishTime) : <span className="muted">—</span>}</td>
                <td className="num">{r.forecastPublishTime ? `${leadHours(r.startTime, r.forecastPublishTime).toFixed(1)} h` : '—'}</td>
                <td className="num">{formatMW(r.forecastGeneration)}</td>
                <td className="num">{formatMW(r.actualGeneration)}</td>
                <td className="num">
                  {r.errorMW == null ? (
                    <span className="muted">Not scored</span>
                  ) : (
                    <span className={`err ${r.errorMW > 0 ? 'err--over' : r.errorMW < 0 ? 'err--under' : ''}`}>
                      {r.errorMW > 0 ? '▲ ' : r.errorMW < 0 ? '▼ ' : ''}
                      {formatMW(r.errorMW, { signed: true })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="muted center">
                  No rows match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button type="button" className="button button--ghost" onClick={() => setPage(current - 1)} disabled={current === 0}>
          ← Previous
        </button>
        <span className="muted">
          Page {current + 1} of {pageCount}
        </span>
        <button type="button" className="button button--ghost" onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1}>
          Next →
        </button>
      </div>
    </div>
  );
}
