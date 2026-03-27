import { describe, expect, it } from "vitest";
import {
  computeUbprRatios,
  computeGrowthRates,
} from "../src/tools/shared/ubprRatios.js";

describe("computeUbprRatios", () => {
  it("computes all ratio groups from raw FDIC fields", () => {
    const raw: Record<string, unknown> = {
      CERT: 3850,
      REPDTE: "20251231",
      ASSET: 500000,
      ROA: 1.15,
      ROE: 11.5,
      ROAPTX: 1.45,
      NIMY: 3.65,
      EEFFR: 58.2,
      LNLSNET: 300000,
      LNRE: 180000,
      LNCI: 60000,
      LNCON: 30000,
      LNAG: 15000,
      DEP: 400000,
      COREDEP: 320000,
      BROR: 5.5,
      CHBALR: 8.2,
      IDT1CER: 9.8,
      IDT1RWAJR: 12.5,
      EQTOT: 50000,
    };
    const result = computeUbprRatios(raw);

    // Summary
    expect(result.summary.roa).toBe(1.15);
    expect(result.summary.roe).toBe(11.5);
    expect(result.summary.nim).toBe(3.65);
    expect(result.summary.efficiency_ratio).toBe(58.2);
    expect(result.summary.pretax_roa).toBe(1.45);

    // Loan mix
    expect(result.loan_mix.re_share).toBeCloseTo(60.0, 1);
    expect(result.loan_mix.ci_share).toBeCloseTo(20.0, 1);
    expect(result.loan_mix.consumer_share).toBeCloseTo(10.0, 1);
    expect(result.loan_mix.ag_share).toBeCloseTo(5.0, 1);

    // Capital
    expect(result.capital.tier1_leverage).toBe(9.8);
    expect(result.capital.tier1_rbc).toBe(12.5);
    expect(result.capital.equity_ratio).toBeCloseTo(10.0, 1);

    // Liquidity
    expect(result.liquidity.loan_to_deposit).toBeCloseTo(75.0, 1);
    expect(result.liquidity.core_deposit_ratio).toBeCloseTo(80.0, 1);
    expect(result.liquidity.brokered_ratio).toBe(5.5);
    expect(result.liquidity.cash_ratio).toBe(8.2);
  });

  it("returns null for computed ratios when denominators are zero", () => {
    const raw: Record<string, unknown> = {
      LNLSNET: 0,
      DEP: 0,
      ASSET: 0,
      EQTOT: 0,
      LNRE: 100,
      LNCI: 50,
      COREDEP: 100,
    };
    const result = computeUbprRatios(raw);

    expect(result.loan_mix.re_share).toBeNull();
    expect(result.loan_mix.ci_share).toBeNull();
    expect(result.liquidity.loan_to_deposit).toBeNull();
    expect(result.liquidity.core_deposit_ratio).toBeNull();
    expect(result.capital.equity_ratio).toBeNull();
  });

  it("returns null for all metrics when inputs are missing", () => {
    const result = computeUbprRatios({});

    expect(result.summary.roa).toBeNull();
    expect(result.summary.roe).toBeNull();
    expect(result.summary.nim).toBeNull();
    expect(result.summary.efficiency_ratio).toBeNull();
    expect(result.summary.pretax_roa).toBeNull();

    expect(result.loan_mix.re_share).toBeNull();
    expect(result.loan_mix.ci_share).toBeNull();
    expect(result.loan_mix.consumer_share).toBeNull();
    expect(result.loan_mix.ag_share).toBeNull();

    expect(result.capital.tier1_leverage).toBeNull();
    expect(result.capital.tier1_rbc).toBeNull();
    expect(result.capital.equity_ratio).toBeNull();

    expect(result.liquidity.loan_to_deposit).toBeNull();
    expect(result.liquidity.core_deposit_ratio).toBeNull();
    expect(result.liquidity.brokered_ratio).toBeNull();
    expect(result.liquidity.cash_ratio).toBeNull();
  });

  it("handles partial data gracefully", () => {
    const raw: Record<string, unknown> = {
      ROA: 1.2,
      LNLSNET: 100000,
      LNRE: 60000,
      // DEP missing, ASSET missing
    };
    const result = computeUbprRatios(raw);

    expect(result.summary.roa).toBe(1.2);
    expect(result.loan_mix.re_share).toBeCloseTo(60.0, 1);
    expect(result.liquidity.loan_to_deposit).toBeNull();
    expect(result.capital.equity_ratio).toBeNull();
  });
});

describe("computeGrowthRates", () => {
  it("computes year-over-year growth rates", () => {
    const current: Record<string, unknown> = {
      ASSET: 550000,
      LNLSNET: 330000,
      DEP: 440000,
    };
    const prior: Record<string, unknown> = {
      ASSET: 500000,
      LNLSNET: 300000,
      DEP: 400000,
    };
    const growth = computeGrowthRates(current, prior);

    expect(growth.asset_growth).toBeCloseTo(10.0, 1);
    expect(growth.loan_growth).toBeCloseTo(10.0, 1);
    expect(growth.deposit_growth).toBeCloseTo(10.0, 1);
  });

  it("handles negative growth", () => {
    const current: Record<string, unknown> = {
      ASSET: 450000,
      LNLSNET: 270000,
      DEP: 360000,
    };
    const prior: Record<string, unknown> = {
      ASSET: 500000,
      LNLSNET: 300000,
      DEP: 400000,
    };
    const growth = computeGrowthRates(current, prior);

    expect(growth.asset_growth).toBeCloseTo(-10.0, 1);
    expect(growth.loan_growth).toBeCloseTo(-10.0, 1);
    expect(growth.deposit_growth).toBeCloseTo(-10.0, 1);
  });

  it("returns null when prior values are zero", () => {
    const current: Record<string, unknown> = {
      ASSET: 500000,
      LNLSNET: 300000,
      DEP: 400000,
    };
    const prior: Record<string, unknown> = {
      ASSET: 0,
      LNLSNET: 0,
      DEP: 0,
    };
    const growth = computeGrowthRates(current, prior);

    expect(growth.asset_growth).toBeNull();
    expect(growth.loan_growth).toBeNull();
    expect(growth.deposit_growth).toBeNull();
  });

  it("returns null when prior values are missing", () => {
    const current: Record<string, unknown> = {
      ASSET: 500000,
      LNLSNET: 300000,
      DEP: 400000,
    };
    const growth = computeGrowthRates(current, {});

    expect(growth.asset_growth).toBeNull();
    expect(growth.loan_growth).toBeNull();
    expect(growth.deposit_growth).toBeNull();
  });

  it("returns null when current values are missing", () => {
    const prior: Record<string, unknown> = {
      ASSET: 500000,
      LNLSNET: 300000,
      DEP: 400000,
    };
    const growth = computeGrowthRates({}, prior);

    expect(growth.asset_growth).toBeNull();
    expect(growth.loan_growth).toBeNull();
    expect(growth.deposit_growth).toBeNull();
  });
});
