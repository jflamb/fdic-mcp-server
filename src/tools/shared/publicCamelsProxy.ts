// ---------------------------------------------------------------------------
// Public CAMELS Proxy Model Assembly (v1)
// ---------------------------------------------------------------------------
// Orchestrates all shared engine modules into a single proxy assessment.
// ---------------------------------------------------------------------------

import {
  extractCanonicalMetrics,
  toLegacyCamelsMetrics,
  type CanonicalMetrics,
  type MetricProvenance,
  type MetricExtractionResult,
} from "./metricNormalization.js";
import { classifyCapital, type CapitalClassification } from "./capitalClassification.js";
import { analyzeTrendEnhanced, type EnhancedTrendResult } from "./trendEngine.js";
import { assessManagementOverlay, type ManagementOverlay } from "./managementOverlay.js";
import { classifyRiskSignalsV2, type RiskSignalV2 } from "./riskSignalEngine.js";
import {
  scoreComponent,
  isStale,
  type ComponentScore,
} from "./camelsScoring.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentAssessment {
  score: number;           // 1-4 scale (mapped from legacy 1-5)
  label: string;           // "Strong" | "Satisfactory" | "Weak" | "High Risk"
  legacy_rating: number;   // Original 1-5 rating for backward compat
  legacy_label: string;    // Original label
  key_metrics: Record<string, { value: number | null; unit: string }>;
  flags: string[];
}

export type OverallBand = "strong" | "satisfactory" | "weak" | "high_risk";

export interface ProxyAssessment {
  model: "public_camels_proxy_v1";
  official_status: "public off-site proxy, not official CAMELS";

  overall: {
    score: number;          // 1.0 to 4.0
    band: OverallBand;
  };

  component_assessment: {
    capital: ComponentAssessment;
    asset_quality: ComponentAssessment;
    earnings: ComponentAssessment;
    liquidity_funding: ComponentAssessment;
    sensitivity_proxy: ComponentAssessment;
  };

  management_overlay: ManagementOverlay;
  capital_classification: CapitalClassification;
  key_metrics: CanonicalMetrics;
  risk_signals: RiskSignalV2[];
  trend_insights: EnhancedTrendResult[];

  data_quality: {
    report_date: string;
    staleness: string;    // "current" | "stale (>120 days old)"
    gaps_count: number;
    gaps: string[];       // first 5 gap reasons
  };

  provenance: MetricProvenance;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

const LEGACY_TO_4: Record<number, number> = { 1: 4.0, 2: 3.0, 3: 2.5, 4: 1.5, 5: 1.0 };

function mapTo4Scale(legacyRating: number): number {
  return LEGACY_TO_4[Math.round(legacyRating)] ?? 2.5;
}

function scoreToLabel(score: number): string {
  if (score >= 3.25) return "Strong";
  if (score >= 2.50) return "Satisfactory";
  if (score >= 1.75) return "Weak";
  return "High Risk";
}

function scoreToBand(score: number, capsBand: boolean): OverallBand {
  let band: OverallBand;
  if (score >= 3.25) band = "strong";
  else if (score >= 2.50) band = "satisfactory";
  else if (score >= 1.75) band = "weak";
  else band = "high_risk";

  // Management overlay caps band by one level
  if (capsBand) {
    if (band === "strong") band = "satisfactory";
    else if (band === "satisfactory") band = "weak";
    else if (band === "weak") band = "high_risk";
  }

  return band;
}

const PROXY_WEIGHTS = {
  capital: 0.30,
  asset_quality: 0.25,
  earnings: 0.20,
  liquidity_funding: 0.15,
  sensitivity_proxy: 0.10,
} as const;

const PCA_TO_PROXY_SCORE: Record<string, number> = {
  well_capitalized: 4.0,
  adequately_capitalized: 3.0,
  undercapitalized: 2.0,
  significantly_undercapitalized: 1.0,
  critically_undercapitalized: 1.0,
  indeterminate: 2.5,
};

// Map PCA category to the legacy 1-5 scale (higher = worse) for management overlay input.
// The overlay counts ratings >= 3 as "weak" and >= 4 as "severe".
const PCA_TO_LEGACY_EQUIVALENT: Record<string, number> = {
  well_capitalized: 1,
  adequately_capitalized: 2,
  undercapitalized: 3,
  significantly_undercapitalized: 4,
  critically_undercapitalized: 5,
  indeterminate: 3,
};

const PROXY_TREND_METRICS = [
  { key: "tier1_leverage", fdicField: "IDT1CER", higherIsBetter: true },
  { key: "noncurrent_loans", fdicField: "NCLNLSR", higherIsBetter: false },
  { key: "roa", fdicField: "ROA", higherIsBetter: true },
  { key: "nim", fdicField: "NIMY", higherIsBetter: true },
  { key: "efficiency_ratio", fdicField: "EEFFR", higherIsBetter: false },
  { key: "loan_to_deposit", fdicField: "LNLSDEPR", higherIsBetter: false },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safe(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildComponentAssessment(
  comp: ComponentScore,
): ComponentAssessment {
  const newScore = mapTo4Scale(comp.rating);
  const keyMetrics: Record<string, { value: number | null; unit: string }> = {};
  for (const m of comp.metrics) {
    keyMetrics[m.name] = { value: m.value, unit: m.unit };
  }
  return {
    score: newScore,
    label: scoreToLabel(newScore),
    legacy_rating: comp.rating,
    legacy_label: comp.label,
    key_metrics: keyMetrics,
    flags: comp.flags,
  };
}

function buildCapitalAssessment(
  pcaCategory: string,
  legacyScore: ComponentScore,
): ComponentAssessment {
  const pcaProxyScore = PCA_TO_PROXY_SCORE[pcaCategory] ?? 2.5;
  const keyMetrics: Record<string, { value: number | null; unit: string }> = {};
  for (const m of legacyScore.metrics) {
    keyMetrics[m.name] = { value: m.value, unit: m.unit };
  }
  return {
    score: pcaProxyScore,
    label: scoreToLabel(pcaProxyScore),
    legacy_rating: legacyScore.rating,
    legacy_label: legacyScore.label,
    key_metrics: keyMetrics,
    flags: legacyScore.flags,
  };
}

// ---------------------------------------------------------------------------
// Main assembly function
// ---------------------------------------------------------------------------

export function assembleProxyAssessment(params: {
  rawFinancials: Record<string, unknown>;
  priorQuarters?: Record<string, unknown>[];
  repdte: string;
  historyEvents?: Array<{ repdte: string; event_type: string; description: string }>;
}): ProxyAssessment {
  const { rawFinancials, priorQuarters, repdte, historyEvents } = params;

  // 1. Extract canonical metrics
  const extractionResult: MetricExtractionResult = extractCanonicalMetrics(rawFinancials);
  const canonicalMetrics = extractionResult.metrics;

  // 2. NIM 4Q change for legacy bridge
  const nimNow = safe(rawFinancials.NIMY);
  const nim4qAgo = priorQuarters && priorQuarters.length >= 4
    ? safe(priorQuarters[3]?.NIMY)
    : null;
  const nim4qChange = nimNow !== null && nim4qAgo !== null ? nimNow - nim4qAgo : null;

  // 3. Build legacy CamelsMetrics for existing scoring
  const legacyMetrics = toLegacyCamelsMetrics(canonicalMetrics, nim4qChange);

  // 4. Score components using legacy scoring
  const capitalScore = scoreComponent("C", legacyMetrics);
  const assetQualityScore = scoreComponent("A", legacyMetrics);
  const earningsScore = scoreComponent("E", legacyMetrics);
  const liquidityScore = scoreComponent("L", legacyMetrics);
  const sensitivityScore = scoreComponent("S", legacyMetrics);

  // 5. Classify capital using PCA thresholds
  // Note: tangible equity to assets is not available from BankFind public data,
  // so critically_undercapitalized cannot be determined from this path.
  const capitalClassification = classifyCapital({
    totalRiskBasedPct: canonicalMetrics.totalRiskBasedPct,
    tier1RiskBasedPct: canonicalMetrics.tier1RiskBasedPct,
    cet1RatioPct: canonicalMetrics.cet1RatioPct,
    tier1LeveragePct: canonicalMetrics.tier1LeveragePct,
  });
  if (!capitalClassification.dataGaps.some((g) => g.includes("tangibleEquity"))) {
    capitalClassification.dataGaps.push(
      "tangibleEquityToAssets: not available from public data — critically_undercapitalized classification is not possible",
    );
  }

  // 6. Compute trends using enhanced engine
  const trendInsights: EnhancedTrendResult[] = [];
  if (priorQuarters && priorQuarters.length > 0) {
    for (const trendDef of PROXY_TREND_METRICS) {
      // Build timeseries: prior quarters (oldest first) + current
      const timeseries: { repdte: string; value: number | null }[] = [];

      // Add prior quarters in reverse order (oldest first)
      for (let i = priorQuarters.length - 1; i >= 0; i--) {
        const q = priorQuarters[i];
        const qRepdte = (q.REPDTE as string) ?? "";
        timeseries.push({ repdte: qRepdte, value: safe(q[trendDef.fdicField]) });
      }

      // Add current quarter
      timeseries.push({ repdte, value: safe(rawFinancials[trendDef.fdicField]) });

      const result = analyzeTrendEnhanced(trendDef.key, timeseries, trendDef.higherIsBetter, {
        historyEvents,
      });
      trendInsights.push(result);
    }
  }

  // 7. Compute the actual trend window from prior quarter dates
  let trendWindow: { earliest: string; latest: string } | undefined;
  if (priorQuarters && priorQuarters.length > 0) {
    const allRepdtes = [
      ...priorQuarters.map((q) => String(q.REPDTE ?? "")),
      repdte,
    ].filter(Boolean).sort();
    if (allRepdtes.length >= 2) {
      trendWindow = { earliest: allRepdtes[0], latest: allRepdtes[allRepdtes.length - 1] };
    }
  }

  // 8. Classify risk signals
  const trendInputs = trendInsights.map((t) => ({
    metric: t.metric,
    direction: t.direction,
    magnitude: t.magnitude,
    consecutive_worsening: t.consecutive_worsening,
    yoy_change: t.yoy_change,
  }));

  const riskSignals = classifyRiskSignalsV2({
    metrics: canonicalMetrics,
    capitalClassification,
    trends: trendInputs,
    repdte,
    historyEvents,
    trendWindow,
  });

  // 9. Assess management overlay
  // Use PCA-derived equivalent for capital so overlay is consistent with PCA-anchored score
  const componentRatings: Record<string, number> = {
    C: PCA_TO_LEGACY_EQUIVALENT[capitalClassification.category] ?? 3,
    A: assetQualityScore.rating,
    E: earningsScore.rating,
    L: liquidityScore.rating,
    S: sensitivityScore.rating,
  };

  const managementOverlay = assessManagementOverlay({
    component_ratings: componentRatings,
    trends: trendInsights.map((t) => ({
      direction: t.direction,
      magnitude: t.magnitude,
      consecutive_worsening: t.consecutive_worsening,
    })),
    capital_category: capitalClassification.category,
  });

  // 10. Build component assessments with new 1-4 scale
  const capitalAssessment = buildCapitalAssessment(capitalClassification.category, capitalScore);
  const assetQualityAssessment = buildComponentAssessment(assetQualityScore);
  const earningsAssessment = buildComponentAssessment(earningsScore);
  const liquidityAssessment = buildComponentAssessment(liquidityScore);
  const sensitivityAssessment = buildComponentAssessment(sensitivityScore);

  // 11. Compute overall score (weighted average on 1-4 scale)
  const rawScore =
    capitalAssessment.score * PROXY_WEIGHTS.capital +
    assetQualityAssessment.score * PROXY_WEIGHTS.asset_quality +
    earningsAssessment.score * PROXY_WEIGHTS.earnings +
    liquidityAssessment.score * PROXY_WEIGHTS.liquidity_funding +
    sensitivityAssessment.score * PROXY_WEIGHTS.sensitivity_proxy;

  // Round to 2 decimal places
  const overallScore = Math.round(rawScore * 100) / 100;
  const band = scoreToBand(overallScore, managementOverlay.caps_band);

  // 12. Data quality
  const dataQuality = {
    report_date: repdte,
    staleness: isStale(repdte) ? "stale (>120 days old)" : "current",
    gaps_count: extractionResult.dataGaps.length,
    gaps: extractionResult.dataGaps.slice(0, 5).map((g) => `${g.metric}: ${g.reason}`),
  };

  return {
    model: "public_camels_proxy_v1",
    official_status: "public off-site proxy, not official CAMELS",

    overall: {
      score: overallScore,
      band,
    },

    component_assessment: {
      capital: capitalAssessment,
      asset_quality: assetQualityAssessment,
      earnings: earningsAssessment,
      liquidity_funding: liquidityAssessment,
      sensitivity_proxy: sensitivityAssessment,
    },

    management_overlay: managementOverlay,
    capital_classification: capitalClassification,
    key_metrics: canonicalMetrics,
    risk_signals: riskSignals,
    trend_insights: trendInsights,

    data_quality: dataQuality,
    provenance: extractionResult.provenance,
  };
}
