import type { DashboardResponse } from '../api/types';
import { formatMW, formatNumber, formatPercent } from '../lib/format';

interface TileProps {
  label: string;
  value: string;
  caption: React.ReactNode;
  tone?: 'over' | 'under';
}

function Tile({ label, value, caption, tone }: TileProps) {
  return (
    <div className="tile">
      <div className="tile__label">{label}</div>
      <div className="tile__value">{value}</div>
      <div className="tile__caption">
        {tone && <span className={`tag tag--${tone}`}>{tone === 'over' ? '▲ Over-forecast' : '▼ Under-forecast'}</span>}
        {caption}
      </div>
    </div>
  );
}

export function KpiGrid({ data }: { data: DashboardResponse }) {
  const { metrics } = data;
  const bias = metrics.meanBiasErrorMW;
  const coverage = data.intervalCount ? (data.scoredIntervalCount / data.intervalCount) * 100 : null;

  return (
    <section className="kpi-grid" aria-label="Headline accuracy metrics">
      <Tile label="Mean absolute error" value={formatMW(metrics.maeMW)} caption="Typical size of a miss, either direction." />
      <Tile label="Root mean square error" value={formatMW(metrics.rmseMW)} caption="Weights large misses more heavily than MAE." />
      <Tile
        label="Mean bias error"
        value={formatMW(bias, { signed: true })}
        tone={bias == null || bias === 0 ? undefined : bias > 0 ? 'over' : 'under'}
        caption={bias != null && bias > 0 ? 'Forecasts ran above actual on average.' : 'Forecast − actual, averaged.'}
      />
      <Tile label="MAE vs mean actual" value={formatPercent(metrics.maePercentOfMeanActual)} caption="MAE as a share of average wind output." />
      <Tile
        label="Scored intervals"
        value={`${formatNumber(data.scoredIntervalCount)} / ${formatNumber(data.intervalCount)}`}
        caption={
          <>
            {formatPercent(coverage, 0)} coverage · {formatNumber(data.missingForecastCount)} without a qualifying forecast
          </>
        }
      />
    </section>
  );
}
