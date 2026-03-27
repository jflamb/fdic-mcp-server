import { describe, expect, it } from "vitest";
import {
  computeSecuritiesMetrics,
  scoreSecuritiesRisks,
  type SecuritiesMetrics,
} from "../src/tools/shared/securitiesPortfolio.js";

describe("computeSecuritiesMetrics", () => {
  it("computes securities metrics from raw FDIC fields", () => {
    const raw: Record<string, unknown> = {
      CERT: 12345,
      REPDTE: "03/31/2024",
      ASSET: 500000,
      EQTOT: 50000,
      SC: 150000,
      SCRES: 60000,
    };
    const m = computeSecuritiesMetrics(raw);
    expect(m.securities_to_assets).toBeCloseTo(30.0, 1); // 150000/500000*100
    expect(m.securities_to_capital).toBeCloseTo(300.0, 1); // 150000/50000*100
    expect(m.mbs_share).toBeCloseTo(40.0, 1); // 60000/150000*100
    expect(m.afs_share).toBeNull(); // SCAFS not available in FDIC API
    expect(m.htm_share).toBeNull(); // SCHTML not available in FDIC API
  });

  it("returns null for ratios when denominators are zero or missing", () => {
    const m = computeSecuritiesMetrics({ SC: 0, ASSET: 0, EQTOT: 0 });
    expect(m.securities_to_assets).toBeNull();
    expect(m.securities_to_capital).toBeNull();
    expect(m.mbs_share).toBeNull();
  });

  it("returns null for all metrics when inputs are missing", () => {
    const m = computeSecuritiesMetrics({});
    expect(m.securities_to_assets).toBeNull();
    expect(m.securities_to_capital).toBeNull();
    expect(m.mbs_share).toBeNull();
    expect(m.afs_share).toBeNull();
    expect(m.htm_share).toBeNull();
  });
});

describe("scoreSecuritiesRisks", () => {
  it("flags securities > 40% of assets", () => {
    const signals = scoreSecuritiesRisks({
      securities_to_assets: 45.0,
      securities_to_capital: 200.0,
      mbs_share: 30.0,
      afs_share: null,
      htm_share: null,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "info",
        category: "securities_risk",
        message: expect.stringContaining("Securities"),
      }),
    );
  });

  it("flags securities > 300% of capital", () => {
    const signals = scoreSecuritiesRisks({
      securities_to_assets: 30.0,
      securities_to_capital: 350.0,
      mbs_share: 30.0,
      afs_share: null,
      htm_share: null,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "securities_risk",
        message: expect.stringContaining("capital"),
      }),
    );
  });

  it("flags MBS > 60% of securities", () => {
    const signals = scoreSecuritiesRisks({
      securities_to_assets: 25.0,
      securities_to_capital: 200.0,
      mbs_share: 70.0,
      afs_share: null,
      htm_share: null,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "info",
        category: "securities_risk",
        message: expect.stringContaining("MBS"),
      }),
    );
  });

  it("returns empty array when all metrics are null", () => {
    const signals = scoreSecuritiesRisks({
      securities_to_assets: null,
      securities_to_capital: null,
      mbs_share: null,
      afs_share: null,
      htm_share: null,
    });
    expect(signals).toHaveLength(0);
  });

  it("returns empty array when no thresholds breached", () => {
    const signals = scoreSecuritiesRisks({
      securities_to_assets: 20.0,
      securities_to_capital: 150.0,
      mbs_share: 40.0,
      afs_share: null,
      htm_share: null,
    });
    expect(signals).toHaveLength(0);
  });
});
