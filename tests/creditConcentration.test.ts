import { describe, expect, it } from "vitest";
import {
  computeCreditMetrics,
  scoreCreditConcentration,
  type CreditMetrics,
} from "../src/tools/shared/creditConcentration.js";

describe("computeCreditMetrics", () => {
  it("computes loan-type shares from raw FDIC fields", () => {
    const raw: Record<string, unknown> = {
      LNLSNET: 80000,
      LNRE: 45000,
      LNRERES: 20000,
      LNRECONS: 5000,
      LNREMULT: 8000,
      LNRENRES: 10000,
      LNREAG: 2000,
      LNCI: 18000,
      LNCON: 10000,
      LNAG: 3000,
      LNOTH: 4000,
      ASSET: 120000,
      EQV: 10.5,
      EQTOT: 12600,
    };
    const m = computeCreditMetrics(raw);
    expect(m.total_loans).toBe(80000);
    expect(m.cre_to_total_loans).toBeCloseTo(28.75, 1);
    expect(m.cre_to_capital).toBeCloseTo(182.54, 0);
    expect(m.ci_share).toBeCloseTo(22.5, 1);
    expect(m.consumer_share).toBeCloseTo(12.5, 1);
    expect(m.residential_re_share).toBeCloseTo(25.0, 1);
    expect(m.ag_share).toBeCloseTo(3.75, 1);
    expect(m.loans_to_assets).toBeCloseTo(66.67, 1);
  });

  it("returns null for shares when total loans is zero or missing", () => {
    const m = computeCreditMetrics({ LNLSNET: 0, LNRE: 0 });
    expect(m.cre_to_total_loans).toBeNull();
    expect(m.ci_share).toBeNull();
  });

  it("returns null for derived metrics when inputs are missing", () => {
    const m = computeCreditMetrics({});
    expect(m.total_loans).toBeNull();
    expect(m.cre_to_capital).toBeNull();
  });
});

describe("scoreCreditConcentration", () => {
  it("flags CRE concentration exceeding 300% of capital", () => {
    const signals = scoreCreditConcentration({
      total_loans: 80000,
      cre_to_total_loans: 45.0,
      cre_to_capital: 350.0,
      construction_to_capital: 120.0,
      ci_share: 20.0,
      consumer_share: 10.0,
      residential_re_share: 20.0,
      ag_share: 5.0,
      loans_to_assets: 70.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "credit_concentration",
        message: expect.stringContaining("CRE"),
      }),
    );
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "credit_concentration",
        message: expect.stringContaining("construction"),
      }),
    );
  });

  it("flags high loan-to-asset ratio", () => {
    const signals = scoreCreditConcentration({
      total_loans: 90000,
      cre_to_total_loans: 20.0,
      cre_to_capital: 150.0,
      construction_to_capital: 30.0,
      ci_share: 20.0,
      consumer_share: 10.0,
      residential_re_share: 20.0,
      ag_share: 5.0,
      loans_to_assets: 85.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "info",
        message: expect.stringContaining("loan-to-asset"),
      }),
    );
  });

  it("returns empty array when all metrics are null", () => {
    const signals = scoreCreditConcentration({
      total_loans: null,
      cre_to_total_loans: null,
      cre_to_capital: null,
      construction_to_capital: null,
      ci_share: null,
      consumer_share: null,
      residential_re_share: null,
      ag_share: null,
      loans_to_assets: null,
    });
    expect(signals).toHaveLength(0);
  });

  it("returns empty array when no thresholds breached", () => {
    const signals = scoreCreditConcentration({
      total_loans: 50000,
      cre_to_total_loans: 20.0,
      cre_to_capital: 100.0,
      construction_to_capital: 30.0,
      ci_share: 25.0,
      consumer_share: 15.0,
      residential_re_share: 25.0,
      ag_share: 5.0,
      loans_to_assets: 60.0,
    });
    expect(signals).toHaveLength(0);
  });
});
