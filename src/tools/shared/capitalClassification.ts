export type CapitalCategory =
  | "well_capitalized"
  | "adequately_capitalized"
  | "undercapitalized"
  | "significantly_undercapitalized"
  | "critically_undercapitalized"
  | "indeterminate";

export interface CapitalClassification {
  category: CapitalCategory;
  label: string;
  ratios_used: {
    totalRiskBased: number | null;
    tier1RiskBased: number | null;
    cet1: number | null;
    leverage: number | null;
  };
  binding_constraint?: string;
  dataGaps: string[];
}

export const PCA_THRESHOLDS = {
  well_capitalized: { totalRiskBased: 10.0, tier1RiskBased: 8.0, cet1: 6.5, leverage: 5.0 },
  adequately_capitalized: { totalRiskBased: 8.0, tier1RiskBased: 6.0, cet1: 4.5, leverage: 4.0 },
  significantly_undercapitalized: { totalRiskBased: 6.0, tier1RiskBased: 4.0, cet1: 3.0, leverage: 3.0 },
  critically_undercapitalized_tangible_equity_pct: 2.0,
} as const;

const CATEGORY_LABELS: Record<CapitalCategory, string> = {
  well_capitalized: "Well Capitalized",
  adequately_capitalized: "Adequately Capitalized",
  undercapitalized: "Undercapitalized",
  significantly_undercapitalized: "Significantly Undercapitalized",
  critically_undercapitalized: "Critically Undercapitalized",
  indeterminate: "Indeterminate",
};

interface RatioInput {
  totalRiskBasedPct: number | null;
  tier1RiskBasedPct: number | null;
  cet1RatioPct: number | null;
  tier1LeveragePct: number | null;
  tangibleEquityToAssetsPct?: number | null;
}

interface RatioEntry {
  name: string;
  value: number | null;
  key: "totalRiskBased" | "tier1RiskBased" | "cet1" | "leverage";
}

export function classifyCapital(ratios: RatioInput): CapitalClassification {
  const entries: RatioEntry[] = [
    { name: "totalRiskBased", value: ratios.totalRiskBasedPct, key: "totalRiskBased" },
    { name: "tier1RiskBased", value: ratios.tier1RiskBasedPct, key: "tier1RiskBased" },
    { name: "cet1", value: ratios.cet1RatioPct, key: "cet1" },
    { name: "leverage", value: ratios.tier1LeveragePct, key: "leverage" },
  ];

  const ratios_used: CapitalClassification["ratios_used"] = {
    totalRiskBased: ratios.totalRiskBasedPct,
    tier1RiskBased: ratios.tier1RiskBasedPct,
    cet1: ratios.cet1RatioPct,
    leverage: ratios.tier1LeveragePct,
  };

  const dataGaps: string[] = [];
  for (const entry of entries) {
    if (entry.value === null) {
      dataGaps.push(`${entry.name}: not available`);
    }
  }

  const available = entries.filter((e) => e.value !== null);

  // Need at least 1 ratio to classify
  if (available.length < 1) {
    return { category: "indeterminate", label: CATEGORY_LABELS.indeterminate, ratios_used, dataGaps };
  }

  // 1. Critically undercapitalized: tangible equity <= 2.0%
  const tangibleEquity = ratios.tangibleEquityToAssetsPct;
  if (tangibleEquity !== null && tangibleEquity !== undefined && tangibleEquity <= PCA_THRESHOLDS.critically_undercapitalized_tangible_equity_pct) {
    return {
      category: "critically_undercapitalized",
      label: CATEGORY_LABELS.critically_undercapitalized,
      ratios_used,
      binding_constraint: "tangibleEquityToAssets",
      dataGaps,
    };
  }

  // 2. Significantly undercapitalized: any ratio below sig-undercap thresholds
  const sigThresholds = PCA_THRESHOLDS.significantly_undercapitalized;
  for (const entry of available) {
    if (entry.value! < sigThresholds[entry.key]) {
      return {
        category: "significantly_undercapitalized",
        label: CATEGORY_LABELS.significantly_undercapitalized,
        ratios_used,
        binding_constraint: entry.name,
        dataGaps,
      };
    }
  }

  // 3. Undercapitalized: any ratio below adequately-capitalized thresholds
  const adqThresholds = PCA_THRESHOLDS.adequately_capitalized;
  for (const entry of available) {
    if (entry.value! < adqThresholds[entry.key]) {
      return {
        category: "undercapitalized",
        label: CATEGORY_LABELS.undercapitalized,
        ratios_used,
        binding_constraint: entry.name,
        dataGaps,
      };
    }
  }

  // 4. Well capitalized: ALL FOUR ratios must be present and meet well-cap thresholds
  const wellThresholds = PCA_THRESHOLDS.well_capitalized;
  const allFourPresent = available.length === 4;
  const allMeetWellCap = available.every((e) => e.value! >= wellThresholds[e.key]);

  if (allFourPresent && allMeetWellCap) {
    return {
      category: "well_capitalized",
      label: CATEGORY_LABELS.well_capitalized,
      ratios_used,
      dataGaps,
    };
  }

  // 5. Adequately capitalized: all above adequate but not all meeting well-cap
  // Find the binding constraint — the ratio furthest below well-cap threshold
  let bindingConstraint: string | undefined;
  let worstGap = Infinity;
  for (const entry of available) {
    const gap = entry.value! - wellThresholds[entry.key];
    if (gap < worstGap) {
      worstGap = gap;
      bindingConstraint = entry.name;
    }
  }

  return {
    category: "adequately_capitalized",
    label: CATEGORY_LABELS.adequately_capitalized,
    ratios_used,
    binding_constraint: bindingConstraint,
    dataGaps,
  };
}
