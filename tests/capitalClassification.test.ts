import { describe, expect, it } from "vitest";
import {
  classifyCapital,
  PCA_THRESHOLDS,
  type CapitalClassification,
} from "../src/tools/shared/capitalClassification.js";

describe("classifyCapital", () => {
  it("classifies well capitalized when all ratios exceed thresholds", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 12.0, tier1RiskBasedPct: 10.0,
      cet1RatioPct: 8.0, tier1LeveragePct: 7.0,
    });
    expect(result.category).toBe("well_capitalized");
    expect(result.label).toBe("Well Capitalized");
    expect(result.dataGaps).toHaveLength(0);
  });

  it("classifies adequately capitalized when one ratio below well-cap", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 9.5, tier1RiskBasedPct: 7.5,
      cet1RatioPct: 6.0, tier1LeveragePct: 4.8,
    });
    expect(result.category).toBe("adequately_capitalized");
    expect(result.binding_constraint).toBeDefined();
  });

  it("classifies undercapitalized when any ratio below adequate thresholds", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 7.5, tier1RiskBasedPct: 5.5,
      cet1RatioPct: 4.0, tier1LeveragePct: 3.8,
    });
    expect(result.category).toBe("undercapitalized");
  });

  it("classifies significantly undercapitalized", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 5.5, tier1RiskBasedPct: 3.5,
      cet1RatioPct: 2.5, tier1LeveragePct: 2.5,
    });
    expect(result.category).toBe("significantly_undercapitalized");
  });

  it("classifies critically undercapitalized by tangible equity", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 5.0, tier1RiskBasedPct: 3.0,
      cet1RatioPct: 2.0, tier1LeveragePct: 2.0,
      tangibleEquityToAssetsPct: 1.5,
    });
    expect(result.category).toBe("critically_undercapitalized");
  });

  it("returns indeterminate when no ratios available", () => {
    const result = classifyCapital({
      totalRiskBasedPct: null, tier1RiskBasedPct: null,
      cet1RatioPct: null, tier1LeveragePct: null,
    });
    expect(result.category).toBe("indeterminate");
    expect(result.dataGaps.length).toBe(4);
  });

  it("classifies with partial data — leverage only", () => {
    const result = classifyCapital({
      totalRiskBasedPct: null, tier1RiskBasedPct: null,
      cet1RatioPct: null, tier1LeveragePct: 7.0,
    });
    // Only leverage available at 7.0% — above well-cap 5.0 threshold
    // But can't confirm well_capitalized without other ratios
    // Should be at least adequately_capitalized based on available data
    expect(["well_capitalized", "adequately_capitalized"]).toContain(result.category);
    expect(result.dataGaps.length).toBe(3);
  });

  it("identifies binding constraint correctly", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 12.0, tier1RiskBasedPct: 10.0,
      cet1RatioPct: 8.0, tier1LeveragePct: 4.5,
    });
    expect(result.category).toBe("adequately_capitalized");
    expect(result.binding_constraint).toContain("leverage");
  });

  it("exports PCA_THRESHOLDS with correct well-capitalized values", () => {
    expect(PCA_THRESHOLDS.well_capitalized.totalRiskBased).toBe(10.0);
    expect(PCA_THRESHOLDS.well_capitalized.leverage).toBe(5.0);
    expect(PCA_THRESHOLDS.well_capitalized.cet1).toBe(6.5);
  });
});
