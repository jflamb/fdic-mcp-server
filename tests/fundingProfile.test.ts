import { describe, expect, it } from "vitest";
import {
  computeFundingMetrics,
  scoreFundingRisks,
  type FundingMetrics,
} from "../src/tools/shared/fundingProfile.js";

describe("computeFundingMetrics", () => {
  it("computes funding metrics from raw FDIC fields", () => {
    const raw: Record<string, unknown> = {
      CERT: 12345,
      REPDTE: "03/31/2024",
      ASSET: 500000,
      DEP: 400000,
      DEPDOM: 380000,
      DEPFOR: 20000,
      COREDEP: 300000,
      BROR: 12.5,
      FREPP: 30000,
      EFREPP: 25000,
      EINTEXP: 15000,
      DEPDASTR: 75.0,
      CHBALR: 8.5,
      LNLSDEPR: 65.0,
    };
    const m = computeFundingMetrics(raw);
    expect(m.core_deposit_ratio).toBeCloseTo(75.0, 1);
    expect(m.brokered_deposit_ratio).toBe(12.5);
    expect(m.wholesale_funding_ratio).toBeCloseTo(26.0, 1); // (400000-300000+30000)/500000*100
    expect(m.fhlb_to_assets).toBeCloseTo(6.0, 1); // 30000/500000*100
    expect(m.foreign_deposit_share).toBeCloseTo(5.0, 1); // 20000/400000*100
    expect(m.deposits_to_assets).toBeCloseTo(80.0, 1); // 400000/500000*100
    expect(m.cost_of_funds).toBeNull();
    expect(m.cash_ratio).toBe(8.5);
  });

  it("returns null for ratios when denominators are zero or missing", () => {
    const m = computeFundingMetrics({ DEP: 0, ASSET: 0 });
    expect(m.core_deposit_ratio).toBeNull();
    expect(m.wholesale_funding_ratio).toBeNull();
    expect(m.foreign_deposit_share).toBeNull();
    expect(m.deposits_to_assets).toBeNull();
  });

  it("returns null for all metrics when inputs are missing", () => {
    const m = computeFundingMetrics({});
    expect(m.core_deposit_ratio).toBeNull();
    expect(m.brokered_deposit_ratio).toBeNull();
    expect(m.wholesale_funding_ratio).toBeNull();
    expect(m.fhlb_to_assets).toBeNull();
    expect(m.foreign_deposit_share).toBeNull();
    expect(m.deposits_to_assets).toBeNull();
    expect(m.cost_of_funds).toBeNull();
    expect(m.cash_ratio).toBeNull();
  });
});

describe("scoreFundingRisks", () => {
  it("flags brokered deposits > 15%", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: 70.0,
      brokered_deposit_ratio: 20.0,
      wholesale_funding_ratio: 20.0,
      fhlb_to_assets: 5.0,
      foreign_deposit_share: 2.0,
      deposits_to_assets: 80.0,
      cost_of_funds: null,
      cash_ratio: 8.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "funding_risk",
        message: expect.stringContaining("Brokered"),
      }),
    );
  });

  it("flags wholesale funding > 25% of assets", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: 70.0,
      brokered_deposit_ratio: 10.0,
      wholesale_funding_ratio: 30.0,
      fhlb_to_assets: 5.0,
      foreign_deposit_share: 2.0,
      deposits_to_assets: 80.0,
      cost_of_funds: null,
      cash_ratio: 8.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "funding_risk",
        message: expect.stringContaining("Wholesale"),
      }),
    );
  });

  it("flags core deposits < 60%", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: 50.0,
      brokered_deposit_ratio: 10.0,
      wholesale_funding_ratio: 20.0,
      fhlb_to_assets: 5.0,
      foreign_deposit_share: 2.0,
      deposits_to_assets: 80.0,
      cost_of_funds: null,
      cash_ratio: 8.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "funding_risk",
        message: expect.stringContaining("Core deposit"),
      }),
    );
  });

  it("flags FHLB > 15% of assets", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: 70.0,
      brokered_deposit_ratio: 10.0,
      wholesale_funding_ratio: 20.0,
      fhlb_to_assets: 18.0,
      foreign_deposit_share: 2.0,
      deposits_to_assets: 80.0,
      cost_of_funds: null,
      cash_ratio: 8.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "info",
        category: "funding_risk",
        message: expect.stringContaining("FHLB"),
      }),
    );
  });

  it("returns empty array when all metrics are null", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: null,
      brokered_deposit_ratio: null,
      wholesale_funding_ratio: null,
      fhlb_to_assets: null,
      foreign_deposit_share: null,
      deposits_to_assets: null,
      cost_of_funds: null,
      cash_ratio: null,
    });
    expect(signals).toHaveLength(0);
  });

  it("returns empty array when no thresholds breached", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: 75.0,
      brokered_deposit_ratio: 8.0,
      wholesale_funding_ratio: 15.0,
      fhlb_to_assets: 5.0,
      foreign_deposit_share: 1.0,
      deposits_to_assets: 80.0,
      cost_of_funds: null,
      cash_ratio: 10.0,
    });
    expect(signals).toHaveLength(0);
  });
});
