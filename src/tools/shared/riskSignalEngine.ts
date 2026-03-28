// ---------------------------------------------------------------------------
// Unified Risk Signal Engine (V2)
// ---------------------------------------------------------------------------

import type { CanonicalMetrics } from "./metricNormalization.js";
import type { CapitalClassification } from "./capitalClassification.js";
import { isStale } from "./camelsScoring.js";

export interface RiskSignalV2 {
  code: string; // e.g., "capital_buffer_erosion"
  severity: "critical" | "warning" | "info";
  category:
    | "capital"
    | "asset_quality"
    | "earnings"
    | "liquidity"
    | "sensitivity"
    | "data_quality";
  message: string; // neutral, supervisory-safe phrasing
  metric_name?: string;
  metric_value?: number;
}

interface TrendInput {
  metric: string;
  direction: string;
  magnitude: string;
  consecutive_worsening: number;
  yoy_change: number | null;
}

interface HistoryEvent {
  repdte: string;
  event_type: string;
}

export function classifyRiskSignalsV2(params: {
  metrics: CanonicalMetrics;
  capitalClassification: CapitalClassification;
  trends: TrendInput[];
  repdte: string;
  historyEvents?: HistoryEvent[];
  trendWindow?: { earliest: string; latest: string };
}): RiskSignalV2[] {
  const signals: RiskSignalV2[] = [];
  const { metrics, capitalClassification, trends, repdte, historyEvents } =
    params;

  // -------------------------------------------------------------------------
  // Capital signals
  // -------------------------------------------------------------------------

  // capital_undercapitalized: critical when PCA category is undercapitalized or worse
  const undercapitalizedCategories = [
    "undercapitalized",
    "significantly_undercapitalized",
    "critically_undercapitalized",
  ];
  if (undercapitalizedCategories.includes(capitalClassification.category)) {
    signals.push({
      code: "capital_undercapitalized",
      severity: "critical",
      category: "capital",
      message: `Reported capital ratios indicate a ${capitalClassification.label} classification under Prompt Corrective Action thresholds.`,
    });
  }

  // capital_buffer_erosion: warning when capital above PCA minimums but
  // tier1LeveragePct fell by >1pp over 4Q OR equityCapitalRatioPct fell by >1.5pp
  if (!undercapitalizedCategories.includes(capitalClassification.category)) {
    const leverageTrend = trends.find((t) => t.metric === "tier1_leverage");
    const equityTrend = trends.find(
      (t) =>
        t.metric === "equity_ratio" || t.metric === "equityCapitalRatioPct",
    );

    const leverageEroded =
      leverageTrend &&
      leverageTrend.yoy_change !== null &&
      leverageTrend.yoy_change < -1.0;
    const equityEroded =
      equityTrend &&
      equityTrend.yoy_change !== null &&
      equityTrend.yoy_change < -1.5;

    if (leverageEroded || equityEroded) {
      const detail = leverageEroded
        ? `Tier 1 leverage ratio declined ${Math.abs(leverageTrend!.yoy_change!).toFixed(2)}pp over the trailing four quarters`
        : `Equity capital ratio declined ${Math.abs(equityTrend!.yoy_change!).toFixed(2)}pp over the trailing four quarters`;
      signals.push({
        code: "capital_buffer_erosion",
        severity: "warning",
        category: "capital",
        message: `Reported capital remains above PCA minimums, but ${detail}.`,
        metric_name: leverageEroded ? "tier1LeveragePct" : "equityCapitalRatioPct",
        metric_value: leverageEroded
          ? (metrics.tier1LeveragePct ?? undefined)
          : (metrics.equityCapitalRatioPct ?? undefined),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Asset quality signals
  // -------------------------------------------------------------------------

  // credit_deterioration: noncurrentLoansPct > 3% OR netChargeOffsPct > 1%
  if (
    (metrics.noncurrentLoansPct !== null && metrics.noncurrentLoansPct > 3) ||
    (metrics.netChargeOffsPct !== null && metrics.netChargeOffsPct > 1)
  ) {
    const parts: string[] = [];
    if (metrics.noncurrentLoansPct !== null && metrics.noncurrentLoansPct > 3) {
      parts.push(
        `noncurrent loans at ${metrics.noncurrentLoansPct.toFixed(2)}%`,
      );
    }
    if (metrics.netChargeOffsPct !== null && metrics.netChargeOffsPct > 1) {
      parts.push(
        `net charge-offs at ${metrics.netChargeOffsPct.toFixed(2)}%`,
      );
    }
    signals.push({
      code: "credit_deterioration",
      severity: "warning",
      category: "asset_quality",
      message: `Reported ${parts.join(" and ")} suggest elevated credit risk.`,
      metric_name: "noncurrentLoansPct",
      metric_value: metrics.noncurrentLoansPct ?? undefined,
    });
  }

  // credit_deterioration_trending: noncurrentLoansPct trend consecutive_worsening >= 2
  const nclTrend = trends.find(
    (t) =>
      t.metric === "noncurrent_loans_ratio" ||
      t.metric === "noncurrentLoansPct" ||
      t.metric === "noncurrent_loans",
  );
  if (nclTrend && nclTrend.consecutive_worsening >= 2) {
    signals.push({
      code: "credit_deterioration_trending",
      severity: "warning",
      category: "asset_quality",
      message: `Reported noncurrent loan levels have worsened for ${nclTrend.consecutive_worsening} consecutive quarters.`,
      metric_name: "noncurrentLoansPct",
      metric_value: metrics.noncurrentLoansPct ?? undefined,
    });
  }

  // reserve_coverage_low: critical when reserveCoveragePct < 50%
  if (
    metrics.reserveCoveragePct !== null &&
    metrics.reserveCoveragePct < 50
  ) {
    signals.push({
      code: "reserve_coverage_low",
      severity: "critical",
      category: "asset_quality",
      message: `Reported loan loss reserve coverage of ${metrics.reserveCoveragePct.toFixed(1)}% is below the 50% threshold, indicating limited loss absorption capacity.`,
      metric_name: "reserveCoveragePct",
      metric_value: metrics.reserveCoveragePct,
    });
  }

  // -------------------------------------------------------------------------
  // Earnings signals
  // -------------------------------------------------------------------------

  // earnings_loss: critical when ROA < 0
  if (metrics.roaPct !== null && metrics.roaPct < 0) {
    signals.push({
      code: "earnings_loss",
      severity: "critical",
      category: "earnings",
      message: `Reported return on assets of ${metrics.roaPct.toFixed(2)}% indicates an operating loss for the period.`,
      metric_name: "roaPct",
      metric_value: metrics.roaPct,
    });
  }

  // earnings_pressure: warning when ROA declining for 2+ quarters
  const roaTrend = trends.find(
    (t) => t.metric === "roa" || t.metric === "roaPct",
  );
  if (
    roaTrend &&
    roaTrend.consecutive_worsening >= 2 &&
    (metrics.roaPct === null || metrics.roaPct >= 0)
  ) {
    signals.push({
      code: "earnings_pressure",
      severity: "warning",
      category: "earnings",
      message: `Reported return on assets has declined for ${roaTrend.consecutive_worsening} consecutive quarters, suggesting emerging earnings pressure.`,
      metric_name: "roaPct",
      metric_value: metrics.roaPct ?? undefined,
    });
  }

  // -------------------------------------------------------------------------
  // Sensitivity signals
  // -------------------------------------------------------------------------

  // margin_compression: warning when NIM yoy_change < -0.30
  const nimTrend = trends.find(
    (t) => t.metric === "nim" || t.metric === "netInterestMarginPct",
  );
  if (nimTrend && nimTrend.yoy_change !== null && nimTrend.yoy_change < -0.3) {
    signals.push({
      code: "margin_compression",
      severity: "warning",
      category: "sensitivity",
      message: `Reported net interest margin declined ${Math.abs(nimTrend.yoy_change).toFixed(2)}pp year-over-year, indicating potential interest rate sensitivity.`,
      metric_name: "netInterestMarginPct",
      metric_value: metrics.netInterestMarginPct ?? undefined,
    });
  }

  // -------------------------------------------------------------------------
  // Liquidity signals
  // -------------------------------------------------------------------------

  // funding_stress: warning when brokeredDepositsSharePct > 15%
  if (
    metrics.brokeredDepositsSharePct !== null &&
    metrics.brokeredDepositsSharePct > 15
  ) {
    signals.push({
      code: "funding_stress",
      severity: "warning",
      category: "liquidity",
      message: `Reported brokered deposits represent ${metrics.brokeredDepositsSharePct.toFixed(1)}% of total deposits, suggesting elevated funding concentration.`,
      metric_name: "brokeredDepositsSharePct",
      metric_value: metrics.brokeredDepositsSharePct,
    });
  }

  // funding_ltd_stretched: warning when loanToDepositPct > 100%
  if (
    metrics.loanToDepositPct !== null &&
    metrics.loanToDepositPct > 100
  ) {
    signals.push({
      code: "funding_ltd_stretched",
      severity: "warning",
      category: "liquidity",
      message: `Reported loan-to-deposit ratio of ${metrics.loanToDepositPct.toFixed(1)}% exceeds 100%, indicating loans exceed deposit funding.`,
      metric_name: "loanToDepositPct",
      metric_value: metrics.loanToDepositPct,
    });
  }

  // -------------------------------------------------------------------------
  // Data quality signals
  // -------------------------------------------------------------------------

  // merger_distorted_trend: info when historyEvents has event inside the trend window.
  // Only emit when a trend window exists — if no trends were analyzed, there is nothing to distort.
  if (historyEvents && historyEvents.length > 0 && params.trendWindow) {
    const window = params.trendWindow;
    const overlapping = historyEvents.filter((e) =>
      e.repdte >= window.earliest && e.repdte <= window.latest,
    );

    if (overlapping.length > 0) {
      signals.push({
        code: "merger_distorted_trend",
        severity: "info",
        category: "data_quality",
        message: `Public data suggest trend analysis may be distorted by a ${overlapping[0].event_type} event reported on ${overlapping[0].repdte}.`,
      });
    }
  }

  // stale_reporting_period: info when repdte is stale
  if (isStale(repdte)) {
    signals.push({
      code: "stale_reporting_period",
      severity: "info",
      category: "data_quality",
      message: `Reported data as of ${repdte} may be stale; more than 120 days have elapsed since the reporting period.`,
    });
  }

  return signals;
}
