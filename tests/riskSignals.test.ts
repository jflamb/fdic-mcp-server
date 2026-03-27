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
