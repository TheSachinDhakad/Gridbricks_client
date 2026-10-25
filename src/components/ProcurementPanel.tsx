import type { WindowStats } from '../lib/analytics';
import { formatFullDateTime, formatMW } from '../lib/format';

/**
 * Translates forecast error into procurement language.
 * Positive error (forecast > actual) means less wind arrived than was planned for,
 * so the shortfall has to be bought elsewhere, typically at short notice.
 */
export function ProcurementPanel({ stats, windowLabel }: { stats: WindowStats; windowLabel: string }) {
  if (!stats.scoredCount) return <p className="muted">No scored intervals in the loaded window.</p>;

  const share = (stats.overForecastShare ?? 0) * 100;
  const p90 = stats.p90 ?? 0;
  const p10 = stats.p10 ?? 0;

  return (
    <div className="procurement">
      <dl className="facts">
        <div>
          <dt>Hours where wind fell short of forecast</dt>
          <dd>{share.toFixed(0)}%</dd>
          <p>
            In {share.toFixed(0)}% of scored hours, a purchase sized on the forecast would have left the position short on wind.
          </p>
        </div>
        <div>
          <dt>Median error</dt>
          <dd>{formatMW(stats.p50, { signed: true })}</dd>
          <p>The midpoint hour. Half of hours missed by more than this, half by less.</p>
        </div>
        <div>
          <dt>90th-percentile shortfall</dt>
          <dd>{p90 > 0 ? formatMW(p90) : 'None'}</dd>
          <p>
            {p90 > 0
              ? `A buffer of about ${formatMW(p90)} on top of the forecast would have covered the wind shortfall in 90% of scored hours.`
              : 'At the 90th percentile, wind still met or beat forecast.'}
          </p>
        </div>
        <div>
          <dt>10th-percentile surplus</dt>
          <dd>{p10 < 0 ? formatMW(-p10) : 'None'}</dd>
          <p>
            {p10 < 0
              ? `In the best 10% of hours, wind beat forecast by at least ${formatMW(-p10)}, a risk of over-buying.`
              : 'Wind rarely beat the forecast by a material margin.'}
          </p>
        </div>
      </dl>

      <div className="extremes">
        {stats.worstShortfall && (
          <div className="extreme extreme--over">
            <span className="extreme__label">▲ Largest shortfall</span>
            <strong>{formatMW(stats.worstShortfall.errorMW)}</strong>
            <span className="muted">
              {formatFullDateTime(stats.worstShortfall.startTime)}: forecast {formatMW(stats.worstShortfall.forecastGeneration)}, actual{' '}
              {formatMW(stats.worstShortfall.actualGeneration)}
            </span>
          </div>
        )}
        {stats.worstSurplus && (
          <div className="extreme extreme--under">
            <span className="extreme__label">▼ Largest surplus</span>
            <strong>{formatMW(-stats.worstSurplus.errorMW)}</strong>
            <span className="muted">
              {formatFullDateTime(stats.worstSurplus.startTime)}: forecast {formatMW(stats.worstSurplus.forecastGeneration)}, actual{' '}
              {formatMW(stats.worstSurplus.actualGeneration)}
            </span>
          </div>
        )}
      </div>

      <p className="footnote">
        Empirical figures from {stats.scoredCount} scored hours in the loaded window ({windowLabel}). They describe past forecast
        performance and are not a trading recommendation.
      </p>
    </div>
  );
}
