export type Rating = 1 | 2 | 3 | 4 | 5;

export interface CamelsMetrics {
  // Capital
  equity_ratio: number | null;
  tier1_leverage: number | null;
  tier1_rbc: number | null;
  // Asset Quality
  noncurrent_assets_ratio: number | null;
  noncurrent_loans_ratio: number | null;
  net_chargeoff_ratio: number | null;
  reserve_to_loans: number | null;
  reserve_coverage: number | null;
  provision_ratio: number | null;
  // Earnings
  roa: number | null;
  roe: number | null;
  nim: number | null;
  efficiency_ratio: number | null;
  pretax_roa: number | null;
  noninterest_income_share: number | null;
  // Liquidity
  loan_to_deposit: number | null;
  deposits_to_assets: number | null;
  core_deposit_ratio: number | null;
  brokered_deposit_ratio: number | null;
  cash_ratio: number | null;
  // Sensitivity proxies
  securities_to_assets: number | null;
  nim_4q_change: number | null;
}

export interface ScoringRule {
  thresholds: [number, number, number, number];
  higher_is_better: boolean;
  weight: number;
  label: string;
  unit: string;
}

export const SCORING_RULES: Record<string, ScoringRule> = {
  // Capital
  tier1_leverage:    { thresholds: [8, 6, 5, 4], higher_is_better: true, weight: 0.35, label: "Tier 1 Leverage Ratio", unit: "%" },
  tier1_rbc:         { thresholds: [10, 8, 6, 4], higher_is_better: true, weight: 0.35, label: "Tier 1 Risk-Based Capital", unit: "%" },
  equity_ratio:      { thresholds: [10, 8, 7, 5], higher_is_better: true, weight: 0.30, label: "Equity / Assets", unit: "%" },
  // Asset Quality
  noncurrent_loans_ratio: { thresholds: [1, 2, 3, 5], higher_is_better: false, weight: 0.30, label: "Noncurrent Loans / Loans", unit: "%" },
  net_chargeoff_ratio:    { thresholds: [0.25, 0.5, 1.0, 2.0], higher_is_better: false, weight: 0.25, label: "Net Charge-Off Ratio", unit: "%" },
  reserve_coverage:       { thresholds: [150, 100, 80, 50], higher_is_better: true, weight: 0.25, label: "Reserve Coverage", unit: "%" },
  noncurrent_assets_ratio:{ thresholds: [0.5, 1.0, 2.0, 4.0], higher_is_better: false, weight: 0.20, label: "Noncurrent Assets / Assets", unit: "%" },
  // Earnings
  roa:              { thresholds: [1.0, 0.75, 0.5, 0.0], higher_is_better: true, weight: 0.30, label: "Return on Assets", unit: "%" },
  nim:              { thresholds: [3.5, 3.0, 2.5, 2.0], higher_is_better: true, weight: 0.25, label: "Net Interest Margin", unit: "%" },
  efficiency_ratio: { thresholds: [55, 60, 70, 85], higher_is_better: false, weight: 0.25, label: "Efficiency Ratio", unit: "%" },
  roe:              { thresholds: [10, 8, 5, 0], higher_is_better: true, weight: 0.20, label: "Return on Equity", unit: "%" },
  // Liquidity
  core_deposit_ratio:    { thresholds: [80, 70, 60, 45], higher_is_better: true, weight: 0.30, label: "Core Deposits / Deposits", unit: "%" },
  loan_to_deposit:       { thresholds: [80, 85, 95, 105], higher_is_better: false, weight: 0.25, label: "Loan-to-Deposit Ratio", unit: "%" },
  brokered_deposit_ratio:{ thresholds: [5, 10, 15, 25], higher_is_better: false, weight: 0.25, label: "Brokered Deposits / Deposits", unit: "%" },
  cash_ratio:            { thresholds: [8, 5, 3, 1], higher_is_better: true, weight: 0.20, label: "Cash / Assets", unit: "%" },
  // Sensitivity
  nim_4q_change:         { thresholds: [0.1, 0, -0.15, -0.30], higher_is_better: true, weight: 0.50, label: "NIM 4Q Change", unit: "pp" },
  securities_to_assets:  { thresholds: [25, 30, 40, 50], higher_is_better: false, weight: 0.50, label: "Securities / Assets", unit: "%" },
};

export const COMPONENT_METRIC_MAP: Record<string, string[]> = {
  C: ["tier1_leverage", "tier1_rbc", "equity_ratio"],
  A: ["noncurrent_loans_ratio", "net_chargeoff_ratio", "reserve_coverage", "noncurrent_assets_ratio"],
  E: ["roa", "nim", "efficiency_ratio", "roe"],
  L: ["core_deposit_ratio", "loan_to_deposit", "brokered_deposit_ratio", "cash_ratio"],
  S: ["nim_4q_change", "securities_to_assets"],
};

const RATING_LABELS: Record<Rating, string> = {
  1: "Strong",
  2: "Satisfactory",
  3: "Fair",
  4: "Marginal",
  5: "Unsatisfactory",
};

export const CAMELS_FIELDS = [
  "CERT", "REPDTE", "ASSET",
  "EQTOT", "EQV", "IDT1CER", "IDT1RWAJR",
  "NPERFV", "NCLNLSR", "NTLNLSR", "LNATRESR", "LNRESNCR", "ELNATRY",
  "ROA", "ROAPTX", "ROE", "NIMY", "EEFFR", "NETINC",
  "INTINC", "EINTEXP", "NONII", "NONIX",
  "DEP", "COREDEP", "BROR", "LNLSDEPR", "DEPDASTR", "CHBALR",
  "SC",
].join(",");

function safe(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function safeDivide(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return num / den;
}

export function computeCamelsMetrics(
  current: Record<string, unknown>,
  prior?: Record<string, unknown>[],
): CamelsMetrics {
  const dep = safe(current.DEP);
  const asset = safe(current.ASSET);
  const coredep = safe(current.COREDEP);
  const sc = safe(current.SC);
  const intinc = safe(current.INTINC);
  const eintexp = safe(current.EINTEXP);
  const nonii = safe(current.NONII);

  const nii = intinc !== null && eintexp !== null ? intinc - eintexp : null;
  const totalRevenue = nii !== null && nonii !== null ? nii + nonii : null;

  const nimNow = safe(current.NIMY);
  const nim4qAgo = prior && prior.length >= 4 ? safe(prior[3].NIMY) : null;
  const nim4qChange = nimNow !== null && nim4qAgo !== null ? nimNow - nim4qAgo : null;

  const coreDepRatio = safeDivide(coredep, dep);
  const secToAssets = safeDivide(sc, asset);
  const niiShare = totalRevenue !== null && totalRevenue > 0 && nonii !== null
    ? (nonii / totalRevenue) * 100
    : null;

  return {
    equity_ratio: safe(current.EQV),
    tier1_leverage: safe(current.IDT1CER),
    tier1_rbc: safe(current.IDT1RWAJR),
    noncurrent_assets_ratio: safe(current.NPERFV),
    noncurrent_loans_ratio: safe(current.NCLNLSR),
    net_chargeoff_ratio: safe(current.NTLNLSR),
    reserve_to_loans: safe(current.LNATRESR),
    reserve_coverage: safe(current.LNRESNCR),
    provision_ratio: safe(current.ELNATRY),
    roa: safe(current.ROA),
    roe: safe(current.ROE),
    nim: nimNow,
    efficiency_ratio: safe(current.EEFFR),
    pretax_roa: safe(current.ROAPTX),
    noninterest_income_share: niiShare,
    loan_to_deposit: safe(current.LNLSDEPR),
    deposits_to_assets: safe(current.DEPDASTR),
    core_deposit_ratio: coreDepRatio !== null ? coreDepRatio * 100 : null,
    brokered_deposit_ratio: safe(current.BROR),
    cash_ratio: safe(current.CHBALR),
    securities_to_assets: secToAssets !== null ? secToAssets * 100 : null,
    nim_4q_change: nim4qChange,
  };
}

export function scoreMetric(value: number | null, rule: ScoringRule): Rating {
  if (value === null) return 3;
  const [t1, t2, t3, t4] = rule.thresholds;
  if (rule.higher_is_better) {
    if (value >= t1) return 1;
    if (value >= t2) return 2;
    if (value >= t3) return 3;
    if (value >= t4) return 4;
    return 5;
  }
  if (value <= t1) return 1;
  if (value <= t2) return 2;
  if (value <= t3) return 3;
  if (value <= t4) return 4;
  return 5;
}

export interface MetricScore {
  name: string;
  label: string;
  value: number | null;
  rating: Rating;
  rating_label: string;
  unit: string;
  peer_percentile?: number;
}

export interface ComponentScore {
  component: "C" | "A" | "E" | "L" | "S";
  rating: Rating;
  label: string;
  metrics: MetricScore[];
  flags: string[];
}

export function scoreComponent(
  component: "C" | "A" | "E" | "L" | "S",
  metrics: CamelsMetrics,
): ComponentScore {
  const metricNames = COMPONENT_METRIC_MAP[component];
  let weightedSum = 0;
  let totalWeight = 0;
  const scored: MetricScore[] = [];
  const flags: string[] = [];

  for (const metricName of metricNames) {
    const rule = SCORING_RULES[metricName];
    const value = metrics[metricName as keyof CamelsMetrics] as number | null;
    const rating = scoreMetric(value, rule);

    scored.push({
      name: metricName,
      label: rule.label,
      value,
      rating,
      rating_label: RATING_LABELS[rating],
      unit: rule.unit,
    });

    if (value !== null) {
      weightedSum += rating * rule.weight;
      totalWeight += rule.weight;
    }

    if (rating >= 4 && value !== null) {
      flags.push(`${rule.label} at ${value.toFixed(2)}${rule.unit} rated ${RATING_LABELS[rating]}`);
    }
  }

  const raw = totalWeight > 0 ? weightedSum / totalWeight : 3;
  const rating = Math.round(raw) as Rating;

  return { component, rating, label: RATING_LABELS[rating], metrics: scored, flags };
}

const COMPONENT_WEIGHTS: Record<string, number> = {
  C: 0.25, A: 0.25, E: 0.20, L: 0.15, S: 0.15,
};

export interface CompositeResult {
  rating: Rating;
  label: string;
  components: ComponentScore[];
  flags: string[];
}

export function compositeScore(components: ComponentScore[]): CompositeResult {
  let sum = 0;
  const allFlags: string[] = [];

  for (const c of components) {
    sum += c.rating * (COMPONENT_WEIGHTS[c.component] ?? 0);
    allFlags.push(...c.flags);
  }

  const rating = Math.round(sum) as Rating;
  return { rating, label: RATING_LABELS[rating], components, flags: allFlags };
}

export interface TrendAnalysis {
  metric: string;
  label: string;
  values: { repdte: string; value: number }[];
  direction: "improving" | "stable" | "deteriorating";
  magnitude: "minimal" | "moderate" | "significant";
  quarters_analyzed: number;
}

export function analyzeTrend(
  metricName: string,
  timeseries: { repdte: string; value: number | null }[],
  higherIsBetter: boolean,
): TrendAnalysis {
  const label = SCORING_RULES[metricName]?.label ?? metricName;
  const valid = timeseries.filter(
    (t): t is { repdte: string; value: number } => t.value !== null,
  );

  if (valid.length < 2) {
    return {
      metric: metricName,
      label,
      values: valid,
      direction: "stable",
      magnitude: "minimal",
      quarters_analyzed: valid.length,
    };
  }

  const n = valid.length;
  const xMean = (n - 1) / 2;
  const yMean = valid.reduce((s, v) => s + v.value, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (valid[i].value - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const relSlope = yMean !== 0 ? slope / Math.abs(yMean) : 0;

  const direction: TrendAnalysis["direction"] =
    (higherIsBetter && relSlope > 0.02) || (!higherIsBetter && relSlope < -0.02)
      ? "improving"
      : (higherIsBetter && relSlope < -0.02) || (!higherIsBetter && relSlope > 0.02)
        ? "deteriorating"
        : "stable";

  const absMag = Math.abs(relSlope);
  const magnitude: TrendAnalysis["magnitude"] =
    absMag > 0.10 ? "significant" : absMag > 0.03 ? "moderate" : "minimal";

  return {
    metric: metricName,
    label,
    values: valid,
    direction,
    magnitude,
    quarters_analyzed: n,
  };
}

export function isStale(repdte: string): boolean {
  const year = Number.parseInt(repdte.slice(0, 4), 10);
  const month = Number.parseInt(repdte.slice(4, 6), 10);
  const day = Number.parseInt(repdte.slice(6, 8), 10);
  const reportDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(reportDate.getTime())) return true;
  const daysSince = (Date.now() - reportDate.getTime()) / 86_400_000;
  return daysSince > 120;
}

export function formatRating(rating: Rating): string {
  return `${rating} - ${RATING_LABELS[rating]}`;
}
