export interface HealthResponse {
  status: string;
  service?: string;
}

export interface DashboardMetrics {
  maeMW: number | null;
  rmseMW: number | null;
  meanBiasErrorMW: number | null;
  maePercentOfMeanActual: number | null;
}

/** One half-hourly settlement period. errorMW = forecast − actual. */
export interface DashboardRow {
  startTime: string;
  forecastPublishTime: string | null;
  forecastGeneration: number | null;
  actualGeneration: number | null;
  errorMW: number | null;
  absoluteErrorMW: number | null;
}

export interface DashboardResponse {
  month: string;
  decisionLeadHours: number;
  intervalCount: number;
  scoredIntervalCount: number;
  missingForecastCount: number;
  metrics: DashboardMetrics;
  rows: DashboardRow[];
  returnedRows: number;
}

/** A row that has both a forecast and an actual, so it can be scored. */
export type ScoredRow = DashboardRow & {
  forecastGeneration: number;
  actualGeneration: number;
  errorMW: number;
  absoluteErrorMW: number;
};
