# CAMELS Analysis Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three new MCP tools (`fdic_analyze_bank_health`, `fdic_compare_peer_health`, `fdic_detect_risk_signals`) that produce CAMELS-style analytical assessments from BankFind financial data.

**Architecture:** A shared scoring engine (`camelsScoring.ts`) contains all CAMELS metric definitions, thresholds, scoring logic, and trend analysis as pure functions. Three tool modules consume it. Each tool follows the existing pattern: Zod input schema → validate → fetch FDIC data → compute → format text + structuredContent output.

**Tech Stack:** TypeScript, Zod, MCP SDK (`server.registerTool`), vitest for tests. No new dependencies.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/tools/shared/camelsScoring.ts` | Create | CAMELS scoring engine — metrics, thresholds, scoring, trend analysis |
| `src/tools/bankHealth.ts` | Create | `fdic_analyze_bank_health` tool |
| `src/tools/peerHealth.ts` | Create | `fdic_compare_peer_health` tool |
| `src/tools/riskSignals.ts` | Create | `fdic_detect_risk_signals` tool |
| `src/index.ts` | Modify | Register 3 new tool modules |
| `tests/camelsScoring.test.ts` | Create | Unit tests for scoring engine |
| `tests/bankHealth.test.ts` | Create | Unit tests for bank health tool helpers |
| `tests/riskSignals.test.ts` | Create | Unit tests for risk signal detection |

---

## Task 1: CAMELS Scoring Engine (`src/tools/shared/camelsScoring.ts`)

The foundation. All pure functions, no FDIC API calls, fully testable in isolation.

**Files:**
- Create: `src/tools/shared/camelsScoring.ts`
- Test: `tests/camelsScoring.test.ts`

### Step 1: Write failing tests for CAMELS metric computation

```typescript
// tests/camelsScoring.test.ts
import { describe, expect, it } from "vitest";
import {
  computeCamelsMetrics,
  scoreMetric,
  scoreComponent,
  compositeScore,
  analyzeTrend,
  type CamelsMetrics,
  type Rating,
  SCORING_RULES,
} from "../src/tools/shared/camelsScoring.js";

describe("computeCamelsMetrics", () => {
  it("extracts direct FDIC fields and computes derived metrics", () => {
    const raw: Record<string, unknown> = {
      EQV: 10.5,
      IDT1CER: 9.2,
      IDT1RWAJR: 14.1,
      NPERFV: 0.8,
      NCLNLSR: 1.3,
      NTLNLSR: 0.28,
      LNATRESR: 1.5,
      LNRESNCR: 115.0,
      ELNATRY: 0.35,
      ROA: 0.95,
      ROAPTX: 1.2,
      ROE: 9.5,
      NIMY: 3.4,
      EEFFR: 62.0,
      NETINC: 5000,
      INTINC: 20000,
      EINTEXP: 8000,
      NONII: 3000,
      NONIX: 12000,
      LNLSDEPR: 82.0,
      DEPDASTR: 85.0,
      DEP: 100000,
      COREDEP: 78000,
      BROR: 4.5,
      CHBALR: 6.0,
      SC: 25000,
      ASSET: 120000,
    };
    const metrics = computeCamelsMetrics(raw);
    expect(metrics.equity_ratio).toBe(10.5);
    expect(metrics.tier1_leverage).toBe(9.2);
    expect(metrics.roa).toBe(0.95);
    expect(metrics.nim).toBe(3.4);
    expect(metrics.loan_to_deposit).toBe(82.0);
    expect(metrics.core_deposit_ratio).toBeCloseTo(78.0, 1);
    expect(metrics.securities_to_assets).toBeCloseTo(20.833, 1);
    expect(metrics.noninterest_income_share).toBeCloseTo(20.0, 1);
  });

  it("returns null for derived metrics when inputs are missing", () => {
    const metrics = computeCamelsMetrics({});
    expect(metrics.equity_ratio).toBeNull();
    expect(metrics.core_deposit_ratio).toBeNull();
    expect(metrics.securities_to_assets).toBeNull();
    expect(metrics.noninterest_income_share).toBeNull();
  });

  it("returns null for core_deposit_ratio when DEP is zero", () => {
    const metrics = computeCamelsMetrics({ COREDEP: 5000, DEP: 0 });
    expect(metrics.core_deposit_ratio).toBeNull();
  });

  it("computes nim_4q_change when prior quarters provided", () => {
    const current = { NIMY: 3.2 };
    const prior = [
      { NIMY: 3.3 }, // Q-1
      { NIMY: 3.35 }, // Q-2
      { NIMY: 3.4 }, // Q-3
      { NIMY: 3.5 }, // Q-4
    ];
    const metrics = computeCamelsMetrics(
      current,
      prior.map((p) => p as Record<string, unknown>),
    );
    expect(metrics.nim_4q_change).toBeCloseTo(-0.3, 2);
  });
});

describe("scoreMetric", () => {
  it("scores a strong capital metric as 1", () => {
    expect(scoreMetric(9.5, SCORING_RULES.tier1_leverage)).toBe(1);
  });

  it("scores a satisfactory capital metric as 2", () => {
    expect(scoreMetric(7.0, SCORING_RULES.tier1_leverage)).toBe(2);
  });

  it("scores a weak capital metric as 4", () => {
    expect(scoreMetric(4.5, SCORING_RULES.tier1_leverage)).toBe(4);
  });

  it("scores critically deficient capital as 5", () => {
    expect(scoreMetric(3.0, SCORING_RULES.tier1_leverage)).toBe(5);
  });

  it("handles lower-is-better metrics (efficiency ratio)", () => {
    expect(scoreMetric(50.0, SCORING_RULES.efficiency_ratio)).toBe(1);
    expect(scoreMetric(75.0, SCORING_RULES.efficiency_ratio)).toBe(4);
  });

  it("returns 3 (Fair) for null values", () => {
    expect(scoreMetric(null, SCORING_RULES.tier1_leverage)).toBe(3);
  });
});

describe("scoreComponent", () => {
  it("scores Capital component from metrics", () => {
    const metrics: CamelsMetrics = {
      equity_ratio: 10.5, tier1_leverage: 9.2, tier1_rbc: 14.1,
      noncurrent_assets_ratio: null, noncurrent_loans_ratio: null,
      net_chargeoff_ratio: null, reserve_to_loans: null,
      reserve_coverage: null, provision_ratio: null,
      roa: null, roe: null, nim: null, efficiency_ratio: null,
      pretax_roa: null, noninterest_income_share: null,
      loan_to_deposit: null, deposits_to_assets: null,
      core_deposit_ratio: null, brokered_deposit_ratio: null,
      cash_ratio: null, securities_to_assets: null, nim_4q_change: null,
    };
    const result = scoreComponent("C", metrics);
    expect(result.rating).toBe(1);
    expect(result.label).toBe("Strong");
    expect(result.metrics).toHaveLength(3);
  });

  it("generates flags for marginal/unsatisfactory metrics", () => {
    const metrics: CamelsMetrics = {
      equity_ratio: 5.0, tier1_leverage: 4.0, tier1_rbc: 5.0,
      noncurrent_assets_ratio: null, noncurrent_loans_ratio: null,
      net_chargeoff_ratio: null, reserve_to_loans: null,
      reserve_coverage: null, provision_ratio: null,
      roa: null, roe: null, nim: null, efficiency_ratio: null,
      pretax_roa: null, noninterest_income_share: null,
      loan_to_deposit: null, deposits_to_assets: null,
      core_deposit_ratio: null, brokered_deposit_ratio: null,
      cash_ratio: null, securities_to_assets: null, nim_4q_change: null,
    };
    const result = scoreComponent("C", metrics);
    expect(result.rating).toBeGreaterThanOrEqual(4);
    expect(result.flags.length).toBeGreaterThan(0);
  });
});

describe("compositeScore", () => {
  it("computes weighted composite from component scores", () => {
    const components = [
      { component: "C" as const, rating: 1 as Rating, label: "Strong", metrics: [], flags: [] },
      { component: "A" as const, rating: 2 as Rating, label: "Satisfactory", metrics: [], flags: [] },
      { component: "E" as const, rating: 2 as Rating, label: "Satisfactory", metrics: [], flags: [] },
      { component: "L" as const, rating: 1 as Rating, label: "Strong", metrics: [], flags: [] },
      { component: "S" as const, rating: 2 as Rating, label: "Satisfactory", metrics: [], flags: [] },
    ];
    const result = compositeScore(components);
    // Weighted: C=0.25*1 + A=0.25*2 + E=0.20*2 + L=0.15*1 + S=0.15*2 = 0.25+0.50+0.40+0.15+0.30 = 1.60 → rounds to 2
    expect(result.rating).toBe(2);
    expect(result.label).toBe("Satisfactory");
  });
});

describe("analyzeTrend", () => {
  it("detects improving trend for higher-is-better metric", () => {
    const timeseries = [
      { repdte: "20240331", value: 0.80 },
      { repdte: "20240630", value: 0.85 },
      { repdte: "20240930", value: 0.92 },
      { repdte: "20241231", value: 0.98 },
    ];
    const result = analyzeTrend("roa", timeseries, true);
    expect(result.direction).toBe("improving");
  });

  it("detects deteriorating trend for higher-is-better metric", () => {
    const timeseries = [
      { repdte: "20240331", value: 1.1 },
      { repdte: "20240630", value: 0.95 },
      { repdte: "20240930", value: 0.80 },
      { repdte: "20241231", value: 0.60 },
    ];
    const result = analyzeTrend("roa", timeseries, true);
    expect(result.direction).toBe("deteriorating");
  });

  it("returns stable for flat trend", () => {
    const timeseries = [
      { repdte: "20240331", value: 3.40 },
      { repdte: "20240630", value: 3.41 },
      { repdte: "20240930", value: 3.39 },
      { repdte: "20241231", value: 3.40 },
    ];
    const result = analyzeTrend("nim", timeseries, true);
    expect(result.direction).toBe("stable");
  });

  it("handles series with null values", () => {
    const timeseries = [
      { repdte: "20240331", value: 1.0 },
      { repdte: "20240630", value: null },
      { repdte: "20240930", value: 1.1 },
    ];
    const result = analyzeTrend("roa", timeseries, true);
    expect(result.quarters_analyzed).toBe(2);
  });

  it("returns stable for single-point series", () => {
    const timeseries = [{ repdte: "20240331", value: 1.0 }];
    const result = analyzeTrend("roa", timeseries, true);
    expect(result.direction).toBe("stable");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run tests/camelsScoring.test.ts`
Expected: FAIL — module not found

### Step 3: Implement the CAMELS scoring engine

```typescript
// src/tools/shared/camelsScoring.ts
import { asNumber } from "./queryUtils.js";

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
```

### Step 4: Run tests to verify they pass

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run tests/camelsScoring.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/tools/shared/camelsScoring.ts tests/camelsScoring.test.ts
git commit -m "feat: add CAMELS scoring engine with metrics, thresholds, and trend analysis"
```

---

## Task 2: Bank Health Tool (`fdic_analyze_bank_health`)

Single-bank CAMELS-style analysis with trend data and optional peer context.

**Files:**
- Create: `src/tools/bankHealth.ts`
- Modify: `src/index.ts` (add registration)
- Test: `tests/bankHealth.test.ts`

### Step 1: Write failing tests for text formatting helpers

```typescript
// tests/bankHealth.test.ts
import { describe, expect, it } from "vitest";
import { formatHealthSummaryText } from "../src/tools/bankHealth.js";

describe("formatHealthSummaryText", () => {
  it("formats a complete health summary with all components", () => {
    const text = formatHealthSummaryText({
      institution: {
        cert: 3850,
        name: "FIRST NATIONAL BANK",
        city: "Springfield",
        state: "IL",
        charter_class: "N",
        total_assets: 2450000,
        report_date: "20251231",
        data_staleness: "current",
      },
      composite: { rating: 2, label: "Satisfactory" },
      components: [
        {
          component: "C", rating: 1, label: "Strong",
          metrics: [
            { name: "tier1_leverage", label: "Tier 1 Leverage Ratio", value: 9.82, rating: 1, rating_label: "Strong", unit: "%" },
          ],
          flags: [],
        },
      ],
      trends: [],
      outliers: [],
      risk_signals: [],
    });

    expect(text).toContain("FIRST NATIONAL BANK");
    expect(text).toContain("Satisfactory");
    expect(text).toContain("Capital");
    expect(text).toContain("9.82%");
  });

  it("includes risk signals when present", () => {
    const text = formatHealthSummaryText({
      institution: {
        cert: 1, name: "TEST BANK", city: "X", state: "TX",
        charter_class: "N", total_assets: 100000,
        report_date: "20251231", data_staleness: "current",
      },
      composite: { rating: 4, label: "Marginal" },
      components: [],
      trends: [],
      outliers: [],
      risk_signals: ["NIM declining sharply"],
    });

    expect(text).toContain("NIM declining sharply");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run tests/bankHealth.test.ts`
Expected: FAIL

### Step 3: Implement the bank health tool

Create `src/tools/bankHealth.ts`:

The tool should:
1. Accept `cert`, optional `repdte`, `quarters` (default 8), `include_peer_context` (default true), `peer_asset_range_pct` (default 50)
2. Fetch institution profile from institutions endpoint
3. Fetch current + N prior quarters of financials (CAMELS_FIELDS)
4. Compute CamelsMetrics for current quarter (with prior quarters for nim_4q_change)
5. Score all 5 components → composite
6. Run trend analysis on key metrics across all fetched quarters
7. Optionally fetch peer group and compute percentiles using existing peer group logic
8. Format text summary + structured JSON output

Follow existing patterns from `peerGroup.ts`:
- Zod input schema
- `server.registerTool()` with annotations
- AbortController + timeout
- Progress notifications
- `formatToolError()` for errors
- `truncateIfNeeded()` for text output
- Both `content` (text) and `structuredContent` (JSON) in response

### Step 4: Register in `src/index.ts`

Add:
```typescript
import { registerBankHealthTools } from "./tools/bankHealth.js";
// ... in createServer():
registerBankHealthTools(server);
```

### Step 5: Run tests to verify they pass

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run tests/bankHealth.test.ts`
Expected: PASS

### Step 6: Commit

```bash
git add src/tools/bankHealth.ts src/index.ts tests/bankHealth.test.ts
git commit -m "feat: add fdic_analyze_bank_health tool with CAMELS-style scoring"
```

---

## Task 3: Peer Health Comparison Tool (`fdic_compare_peer_health`)

Compare CAMELS scores across a peer group of institutions.

**Files:**
- Create: `src/tools/peerHealth.ts`
- Modify: `src/index.ts` (add registration)

### Step 1: Implement the peer health tool

Create `src/tools/peerHealth.ts`:

The tool should:
1. Accept `cert` (optional subject), `certs` (explicit list, max 50), `state`, `asset_min`, `asset_max`, `repdte`, `quarters` (for trend), `sort_by` (composite, capital, asset_quality, earnings, liquidity, sensitivity)
2. Build peer roster (reuse pattern from `peerGroup.ts`)
3. Fetch CAMELS_FIELDS financials for all peers at the report date
4. Optionally fetch prior quarters for trend context (default: 4 quarters)
5. Score each institution with CAMELS composite
6. Rank by composite or component score
7. If subject cert provided, highlight its position

Output: ranked list with CAMELS scores, component breakdowns, and flags.

### Step 2: Register in `src/index.ts`

Add:
```typescript
import { registerPeerHealthTools } from "./tools/peerHealth.js";
// ... in createServer():
registerPeerHealthTools(server);
```

### Step 3: Run full test suite

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run`
Expected: PASS (no regressions)

### Step 4: Commit

```bash
git add src/tools/peerHealth.ts src/index.ts
git commit -m "feat: add fdic_compare_peer_health tool for CAMELS-ranked peer comparison"
```

---

## Task 4: Risk Signals Tool (`fdic_detect_risk_signals`)

Scan institutions for early warning indicators.

**Files:**
- Create: `src/tools/riskSignals.ts`
- Create: `tests/riskSignals.test.ts`
- Modify: `src/index.ts` (add registration)

### Step 1: Write failing tests for risk signal classification

```typescript
// tests/riskSignals.test.ts
import { describe, expect, it } from "vitest";
import { classifyRiskSignals, type RiskSignal } from "../src/tools/riskSignals.js";
import type { CamelsMetrics } from "../src/tools/shared/camelsScoring.js";

describe("classifyRiskSignals", () => {
  it("flags capital below well-capitalized thresholds", () => {
    const metrics: CamelsMetrics = {
      tier1_leverage: 4.5, tier1_rbc: 5.5, equity_ratio: 6.0,
      noncurrent_assets_ratio: 0.3, noncurrent_loans_ratio: 0.5,
      net_chargeoff_ratio: 0.1, reserve_to_loans: 1.5,
      reserve_coverage: 200, provision_ratio: 0.2,
      roa: 1.0, roe: 10, nim: 3.5, efficiency_ratio: 55,
      pretax_roa: 1.3, noninterest_income_share: 20,
      loan_to_deposit: 80, deposits_to_assets: 85,
      core_deposit_ratio: 80, brokered_deposit_ratio: 3,
      cash_ratio: 6, securities_to_assets: 20, nim_4q_change: 0,
    };
    const signals = classifyRiskSignals(metrics, []);
    const capitalSignals = signals.filter((s) => s.category === "capital");
    expect(capitalSignals.length).toBeGreaterThan(0);
    expect(capitalSignals.some((s) => s.severity === "critical")).toBe(true);
  });

  it("returns no signals for a healthy bank", () => {
    const metrics: CamelsMetrics = {
      tier1_leverage: 10, tier1_rbc: 15, equity_ratio: 12,
      noncurrent_assets_ratio: 0.3, noncurrent_loans_ratio: 0.5,
      net_chargeoff_ratio: 0.1, reserve_to_loans: 1.5,
      reserve_coverage: 200, provision_ratio: 0.2,
      roa: 1.2, roe: 12, nim: 3.8, efficiency_ratio: 52,
      pretax_roa: 1.5, noninterest_income_share: 25,
      loan_to_deposit: 75, deposits_to_assets: 85,
      core_deposit_ratio: 85, brokered_deposit_ratio: 2,
      cash_ratio: 8, securities_to_assets: 20, nim_4q_change: 0.1,
    };
    const signals = classifyRiskSignals(metrics, []);
    expect(signals.filter((s) => s.severity !== "info")).toHaveLength(0);
  });

  it("flags deteriorating trends", () => {
    const metrics: CamelsMetrics = {
      tier1_leverage: 10, tier1_rbc: 15, equity_ratio: 12,
      noncurrent_assets_ratio: 0.3, noncurrent_loans_ratio: 0.5,
      net_chargeoff_ratio: 0.1, reserve_to_loans: 1.5,
      reserve_coverage: 200, provision_ratio: 0.2,
      roa: 1.0, roe: 10, nim: 3.5, efficiency_ratio: 55,
      pretax_roa: 1.3, noninterest_income_share: 20,
      loan_to_deposit: 75, deposits_to_assets: 85,
      core_deposit_ratio: 80, brokered_deposit_ratio: 3,
      cash_ratio: 6, securities_to_assets: 20, nim_4q_change: -0.4,
    };
    const trends = [
      { metric: "roa", label: "ROA", direction: "deteriorating" as const, magnitude: "significant" as const, values: [], quarters_analyzed: 8 },
    ];
    const signals = classifyRiskSignals(metrics, trends);
    expect(signals.some((s) => s.category === "earnings" && s.severity === "warning")).toBe(true);
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run tests/riskSignals.test.ts`
Expected: FAIL

### Step 3: Implement the risk signals tool

Create `src/tools/riskSignals.ts`:

The tool should:
1. Accept `state` (scan all active banks), `certs` (specific list), `min_severity` (info/warning/critical, default warning), `quarters` (default 4)
2. Fetch institution roster
3. Fetch CAMELS_FIELDS for current quarter + prior quarters
4. For each institution:
   - Compute CamelsMetrics
   - Run trend analysis on key metrics
   - Classify risk signals by category and severity
5. Filter signals by min_severity
6. Sort institutions by number/severity of signals
7. Output ranked list of flagged institutions with their signals

Signal classification rules:
- **Critical**: Tier 1 leverage < 5% (undercapitalized), ROA < 0 (operating losses), reserve coverage < 50%
- **Warning**: Any CAMELS component rated 4+, any trend deteriorating with significant magnitude, brokered deposits > 15%, noncurrent loans > 3%
- **Info**: Any trend deteriorating with moderate magnitude, any metric below peer median

Export `classifyRiskSignals` as a pure function for testing.

### Step 4: Register in `src/index.ts`

Add:
```typescript
import { registerRiskSignalTools } from "./tools/riskSignals.js";
// ... in createServer():
registerRiskSignalTools(server);
```

### Step 5: Run tests to verify they pass

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run tests/riskSignals.test.ts`
Expected: PASS

### Step 6: Run full test suite

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run`
Expected: PASS

### Step 7: Commit

```bash
git add src/tools/riskSignals.ts src/index.ts tests/riskSignals.test.ts
git commit -m "feat: add fdic_detect_risk_signals tool for early warning screening"
```

---

## Task 5: Build Verification & Final Commit

### Step 1: Run TypeScript type check

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx tsc --noEmit`
Expected: No errors

### Step 2: Run full test suite

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npx vitest run`
Expected: All tests pass

### Step 3: Run build

Run: `cd /Users/jlamb/Projects/bankfind-mcp && npm run build`
Expected: Successful build in `dist/`

### Step 4: Verify tools register in MCP server

Run: `cd /Users/jlamb/Projects/bankfind-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js 2>/dev/null | head -c 2000`
Expected: Output includes `fdic_analyze_bank_health`, `fdic_compare_peer_health`, `fdic_detect_risk_signals`

---

## Notes

- All amounts from FDIC API are in $thousands — preserve this unit in outputs
- FDIC ratio fields (EQV, NCLNLSR, ROA, etc.) are pre-computed percentages — use directly, don't multiply by 100
- Management (M) component omitted from scoring — cannot be assessed from public data
- Sensitivity (S) component uses proxy metrics (NIM trend, securities concentration) — flag this limitation in output
- The scoring thresholds in `SCORING_RULES` are informed by FDIC supervisory guidance but are not official CAMELS ratings — outputs should note this is an analytical assessment, not a regulatory rating
