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
