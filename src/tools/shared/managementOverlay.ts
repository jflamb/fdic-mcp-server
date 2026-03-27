// ---------------------------------------------------------------------------
// Management Overlay — supervisory overlay for CAMELS-style analysis
// ---------------------------------------------------------------------------

export type ManagementOverlayLevel = "normal" | "watch" | "elevated_concern";

export interface ManagementOverlay {
  level: ManagementOverlayLevel;
  reason_codes: string[];
  caps_band: boolean; // true = overall band should be capped down one level
}

export function assessManagementOverlay(params: {
  component_ratings: Record<string, number>; // { C: 2, A: 3, E: 4, L: 3, S: 3 }
  trends: Array<{
    direction: string;
    magnitude: string;
    consecutive_worsening: number;
  }>;
  capital_category?: string; // from capitalClassification
  asset_growth_pct?: number | null; // YoY asset growth
}): ManagementOverlay {
  const reason_codes: string[] = [];

  // ---------------------------------------------------------------------------
  // Derived counts
  // ---------------------------------------------------------------------------
  const ratings = Object.values(params.component_ratings);
  const weakComponentCount = ratings.filter((r) => r >= 3).length;
  const severeComponentCount = ratings.filter((r) => r >= 4).length;
  const hasAnyWeakComponent = weakComponentCount > 0;

  const consecutiveWorseningTrends = params.trends.filter(
    (t) => t.consecutive_worsening >= 2,
  );
  const severeWorseningTrends = params.trends.filter(
    (t) => t.consecutive_worsening >= 3,
  );

  const undercapitalizedCategories = [
    "undercapitalized",
    "significantly_undercapitalized",
    "critically_undercapitalized",
  ];
  const isUndercapitalized =
    params.capital_category !== undefined &&
    undercapitalizedCategories.includes(params.capital_category);

  // ---------------------------------------------------------------------------
  // Elevated concern checks (any 1 triggers)
  // ---------------------------------------------------------------------------
  let elevated = false;

  // 3+ component ratings >= 3 AND at least 1 trend with consecutive_worsening >= 3
  if (weakComponentCount >= 3 && severeWorseningTrends.length >= 1) {
    elevated = true;
    reason_codes.push(
      `${weakComponentCount} components rated Fair or worse with persistent worsening trends`,
    );
  }

  // Any component rated >= 4 AND capital_category is undercapitalized or worse
  if (severeComponentCount >= 1 && isUndercapitalized) {
    elevated = true;
    reason_codes.push(
      `component rated Marginal or worse combined with ${params.capital_category} capital category`,
    );
  }

  // 3+ trends with consecutive_worsening >= 3
  if (severeWorseningTrends.length >= 3) {
    elevated = true;
    reason_codes.push(
      `${severeWorseningTrends.length} trends with 3+ consecutive quarters of worsening`,
    );
  }

  if (elevated) {
    return { level: "elevated_concern", reason_codes, caps_band: true };
  }

  // ---------------------------------------------------------------------------
  // Watch checks (any 1 triggers)
  // ---------------------------------------------------------------------------
  let watch = false;

  // 2+ component ratings >= 3
  if (weakComponentCount >= 2) {
    watch = true;
    reason_codes.push(
      `${weakComponentCount} components rated Fair or worse`,
    );
  }

  // 2+ trends with consecutive_worsening >= 2
  if (consecutiveWorseningTrends.length >= 2) {
    watch = true;
    reason_codes.push(
      `${consecutiveWorseningTrends.length} trends with 2+ consecutive quarters of worsening`,
    );
  }

  // Asset growth > 20% YoY combined with any component >= 3
  if (
    params.asset_growth_pct !== undefined &&
    params.asset_growth_pct !== null &&
    params.asset_growth_pct > 20 &&
    hasAnyWeakComponent
  ) {
    watch = true;
    reason_codes.push(
      `rapid asset growth (${params.asset_growth_pct.toFixed(1)}% YoY) combined with component weakness`,
    );
  }

  if (watch) {
    return { level: "watch", reason_codes, caps_band: false };
  }

  // ---------------------------------------------------------------------------
  // Normal
  // ---------------------------------------------------------------------------
  return { level: "normal", reason_codes: [], caps_band: false };
}
