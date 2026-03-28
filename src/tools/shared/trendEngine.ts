import { SCORING_RULES } from "./camelsScoring.js";

export interface TrendDataQuality {
  sufficient_data: boolean;
  stale_period: boolean;
  history_event_in_window: boolean;
  history_event_note?: string;
}

export interface EnhancedTrendResult {
  metric: string;
  label: string;
  direction: "improving" | "stable" | "deteriorating";
  magnitude: "minimal" | "moderate" | "significant";
  quarters_analyzed: number;
  values: { repdte: string; value: number }[];

  consecutive_worsening: number;
  reversal: boolean;
  prior_quarter_change: number | null;
  yoy_change: number | null;
  slope: number;
  volatility_spike: boolean;
  data_quality: TrendDataQuality;
}

/**
 * Parse a REPDTE string (YYYYMMDD) into a numeric quarter index
 * for gap detection. Returns year * 4 + quarterIndex (0-3).
 */
function repdteToQuarterIndex(repdte: string): number {
  const year = Number.parseInt(repdte.slice(0, 4), 10);
  const month = Number.parseInt(repdte.slice(4, 6), 10);
  // Q1=03, Q2=06, Q3=09, Q4=12
  const q = Math.ceil(month / 3) - 1; // 0-based quarter
  return year * 4 + q;
}

/**
 * Compute linear regression slope for a series of values indexed 0..n-1.
 * Returns { slope, relSlope }.
 */
function linearRegression(values: number[]): { slope: number; relSlope: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, relSlope: 0 };

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const relSlope = yMean !== 0 ? slope / Math.abs(yMean) : 0;
  return { slope, relSlope };
}

function computeDirection(
  relSlope: number,
  higherIsBetter: boolean,
): "improving" | "stable" | "deteriorating" {
  if ((higherIsBetter && relSlope > 0.02) || (!higherIsBetter && relSlope < -0.02)) {
    return "improving";
  }
  if ((higherIsBetter && relSlope < -0.02) || (!higherIsBetter && relSlope > 0.02)) {
    return "deteriorating";
  }
  return "stable";
}

function computeMagnitude(relSlope: number): "minimal" | "moderate" | "significant" {
  const absMag = Math.abs(relSlope);
  if (absMag > 0.10) return "significant";
  if (absMag > 0.03) return "moderate";
  return "minimal";
}

export function analyzeTrendEnhanced(
  metricName: string,
  timeseries: { repdte: string; value: number | null }[],
  higherIsBetter: boolean,
  options?: {
    historyEvents?: { repdte: string; event_type: string; description: string }[];
  },
): EnhancedTrendResult {
  const label = SCORING_RULES[metricName]?.label ?? metricName;
  const valid = timeseries.filter(
    (t): t is { repdte: string; value: number } => t.value !== null,
  );

  const dataQuality = computeDataQuality(timeseries, valid, options?.historyEvents);

  if (valid.length < 2) {
    return {
      metric: metricName,
      label,
      direction: "stable",
      magnitude: "minimal",
      quarters_analyzed: valid.length,
      values: valid,
      consecutive_worsening: 0,
      reversal: false,
      prior_quarter_change: null,
      yoy_change: null,
      slope: 0,
      volatility_spike: false,
      data_quality: dataQuality,
    };
  }

  const vals = valid.map((v) => v.value);
  const { slope, relSlope } = linearRegression(vals);
  const direction = computeDirection(relSlope, higherIsBetter);
  const magnitude = computeMagnitude(relSlope);

  // consecutive_worsening: count from end where metric moved in bad direction
  const consecutiveWorsening = computeConsecutiveWorsening(vals, higherIsBetter);

  // reversal: compare full direction vs first-half direction
  const reversal = detectReversal(vals, higherIsBetter);

  // prior_quarter_change
  const priorQuarterChange = vals[vals.length - 1] - vals[vals.length - 2];

  // yoy_change: find value 4 quarters ago by matching REPDTE quarter
  const yoyChange = computeYoyChange(valid);

  // volatility_spike: true when quarter-over-quarter changes have a coefficient
  // of variation > 1.5, indicating erratic movement rather than a steady trend.
  const volatilitySpike = detectVolatilitySpike(vals);

  return {
    metric: metricName,
    label,
    direction,
    magnitude,
    quarters_analyzed: valid.length,
    values: valid,
    consecutive_worsening: consecutiveWorsening,
    reversal,
    prior_quarter_change: priorQuarterChange,
    yoy_change: yoyChange,
    slope,
    volatility_spike: volatilitySpike,
    data_quality: dataQuality,
  };
}

/**
 * Detect a volatility spike: true when the coefficient of variation of
 * quarter-over-quarter changes exceeds 1.5. Requires at least 3 values
 * (2 changes) to compute.
 */
function detectVolatilitySpike(vals: number[]): boolean {
  if (vals.length < 3) return false;
  const changes: number[] = [];
  for (let i = 1; i < vals.length; i++) {
    changes.push(vals[i] - vals[i - 1]);
  }
  const mean = changes.reduce((s, c) => s + c, 0) / changes.length;
  if (mean === 0) return false;
  const variance = changes.reduce((s, c) => s + (c - mean) ** 2, 0) / changes.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return cv > 1.5;
}

function computeConsecutiveWorsening(vals: number[], higherIsBetter: boolean): number {
  let count = 0;
  for (let i = vals.length - 1; i > 0; i--) {
    const diff = vals[i] - vals[i - 1];
    const isWorsening = higherIsBetter ? diff < 0 : diff > 0;
    if (isWorsening) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function detectReversal(vals: number[], higherIsBetter: boolean): boolean {
  if (vals.length < 4) return false;

  const midpoint = Math.floor(vals.length / 2);
  const firstHalf = vals.slice(0, midpoint);
  const secondHalf = vals.slice(midpoint);

  const { relSlope: firstRelSlope } = linearRegression(firstHalf);
  const firstDirection = computeDirection(firstRelSlope, higherIsBetter);

  const { relSlope: secondRelSlope } = linearRegression(secondHalf);
  const secondDirection = computeDirection(secondRelSlope, higherIsBetter);

  return firstDirection !== "stable" && secondDirection !== "stable" && firstDirection !== secondDirection;
}

function computeYoyChange(
  valid: { repdte: string; value: number }[],
): number | null {
  if (valid.length < 2) return null;

  const current = valid[valid.length - 1];
  const currentMonth = current.repdte.slice(4, 6);
  const currentYear = Number.parseInt(current.repdte.slice(0, 4), 10);
  const targetRepdte = `${currentYear - 1}${currentMonth}${current.repdte.slice(6, 8)}`;

  const yearAgo = valid.find((v) => v.repdte === targetRepdte);
  if (!yearAgo) return null;

  return current.value - yearAgo.value;
}

function computeDataQuality(
  _allEntries: { repdte: string; value: number | null }[],
  valid: { repdte: string; value: number }[],
  historyEvents?: { repdte: string; event_type: string; description: string }[],
): TrendDataQuality {
  const sufficientData = valid.length >= 2;

  // stale_period: check gaps between consecutive valid observations
  let stalePeriod = false;
  for (let i = 1; i < valid.length; i++) {
    const prevQ = repdteToQuarterIndex(valid[i - 1].repdte);
    const currQ = repdteToQuarterIndex(valid[i].repdte);
    if (currQ - prevQ > 1) {
      stalePeriod = true;
      break;
    }
  }

  // history_event_in_window
  let historyEventInWindow = false;
  let historyEventNote: string | undefined;

  if (historyEvents && valid.length >= 1) {
    const firstDate = valid[0].repdte;
    const lastDate = valid[valid.length - 1].repdte;

    for (const event of historyEvents) {
      if (event.repdte >= firstDate && event.repdte <= lastDate) {
        historyEventInWindow = true;
        historyEventNote = `${event.event_type} event on ${event.repdte}: ${event.description}`;
        break;
      }
    }
  }

  const result: TrendDataQuality = {
    sufficient_data: sufficientData,
    stale_period: stalePeriod,
    history_event_in_window: historyEventInWindow,
  };

  if (historyEventNote) {
    result.history_event_note = historyEventNote;
  }

  return result;
}
