import { describe, expect, it } from "vitest";
import { classifyRiskSignalsV2 } from "../src/tools/shared/riskSignalEngine.js";

describe("classifyRiskSignalsV2", () => {
  const baseMetrics = {
    totalAssets: 500000, totalDeposits: 400000, domesticDeposits: 380000,
    equityCapital: 50000, netIncome: 5000,
    tier1LeveragePct: 9.5, cet1RatioPct: 8.0, tier1RiskBasedPct: 14.2,
    totalRiskBasedPct: 15.0, equityCapitalRatioPct: 10.0,
    roaPct: 1.0, roePct: 10.0, netInterestMarginPct: 3.5,
    efficiencyRatioPct: 60.0, pretaxRoaPct: 1.2,
    loanToDepositPct: 80.0, domesticDepositsToAssetsPct: 76.0,
    coreDepositsToAssetsPct: 70.0, coreDepositsToDepositsPct: 87.5,
    brokeredDepositsSharePct: 5.0, cashAndDueToAssetsPct: 8.0,
    noncurrentLoansPct: 1.0, netChargeOffsPct: 0.3,
    reserveCoveragePct: 120.0, noncurrentAssetsPct: 0.5, provisionToLoansPct: 0.4,
    securitiesToAssetsPct: 20.0, longTermAssetsPct: null,
    volatileLiabilitiesToAssetsPct: null,
  };
  const wellCapitalized = {
    category: "well_capitalized" as const, label: "Well Capitalized",
    ratios_used: { totalRiskBased: 15.0, tier1RiskBased: 14.2, cet1: 8.0, leverage: 9.5 },
    dataGaps: [],
  };

  it("returns no signals for healthy bank", () => {
    const signals = classifyRiskSignalsV2({
      metrics: baseMetrics,
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: new Date().toISOString().replace(/-/g, "").slice(0, 8),
    });
    const nonInfo = signals.filter(s => s.severity !== "info");
    expect(nonInfo).toHaveLength(0);
  });

  it("flags critical earnings_loss for negative ROA", () => {
    const signals = classifyRiskSignalsV2({
      metrics: { ...baseMetrics, roaPct: -0.5 },
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "earnings_loss", severity: "critical", category: "earnings",
    }));
  });

  it("flags critical capital_undercapitalized", () => {
    const signals = classifyRiskSignalsV2({
      metrics: baseMetrics,
      capitalClassification: { ...wellCapitalized, category: "undercapitalized" as any, label: "Undercapitalized" },
      trends: [],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "capital_undercapitalized", severity: "critical",
    }));
  });

  it("flags funding_stress for high brokered deposits", () => {
    const signals = classifyRiskSignalsV2({
      metrics: { ...baseMetrics, brokeredDepositsSharePct: 20.0 },
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "funding_stress", severity: "warning", category: "liquidity",
    }));
  });

  it("flags margin_compression for NIM decline", () => {
    const signals = classifyRiskSignalsV2({
      metrics: baseMetrics,
      capitalClassification: wellCapitalized,
      trends: [{ metric: "nim", direction: "deteriorating", magnitude: "significant", consecutive_worsening: 3, yoy_change: -0.50 }],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "margin_compression", severity: "warning",
    }));
  });

  it("flags merger_distorted_trend for history events", () => {
    const signals = classifyRiskSignalsV2({
      metrics: baseMetrics,
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20241231",
      historyEvents: [{ repdte: "20240630", event_type: "merger" }],
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "merger_distorted_trend", severity: "info", category: "data_quality",
    }));
  });

  it("flags stale_reporting_period", () => {
    const signals = classifyRiskSignalsV2({
      metrics: baseMetrics,
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20230101", // very old
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "stale_reporting_period", severity: "info",
    }));
  });

  it("flags reserve_coverage_low", () => {
    const signals = classifyRiskSignalsV2({
      metrics: { ...baseMetrics, reserveCoveragePct: 40.0 },
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "reserve_coverage_low", severity: "critical",
    }));
  });

  it("flags credit_deterioration for high noncurrent loans", () => {
    const signals = classifyRiskSignalsV2({
      metrics: { ...baseMetrics, noncurrentLoansPct: 4.0 },
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "credit_deterioration", severity: "warning",
    }));
  });

  it("flags credit_deterioration_trending using proxy trend key 'noncurrent_loans'", () => {
    const signals = classifyRiskSignalsV2({
      metrics: { ...baseMetrics, noncurrentLoansPct: 3.0 },
      capitalClassification: wellCapitalized,
      trends: [{ metric: "noncurrent_loans", direction: "deteriorating", magnitude: "moderate", consecutive_worsening: 3, yoy_change: 0.8 }],
      repdte: "20241231",
    });
    expect(signals).toContainEqual(expect.objectContaining({
      code: "credit_deterioration_trending", severity: "warning", category: "asset_quality",
    }));
  });

  it("uses neutral supervisory-safe language in messages", () => {
    const signals = classifyRiskSignalsV2({
      metrics: { ...baseMetrics, roaPct: -0.5 },
      capitalClassification: wellCapitalized,
      trends: [],
      repdte: "20241231",
    });
    const lossSignal = signals.find(s => s.code === "earnings_loss");
    expect(lossSignal?.message).not.toContain("CAMELS rating");
    expect(lossSignal?.message.toLowerCase()).toContain("reported");
  });
});
