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

  it("includes proxy model fields in formatHealthSummaryText", () => {
    const text = formatHealthSummaryText({
      institution: {
        cert: 3850,
        name: "PROXY TEST BANK",
        city: "Springfield",
        state: "IL",
        charter_class: "N",
        total_assets: 2450000,
        report_date: "20251231",
        data_staleness: "current",
      },
      composite: { rating: 2, label: "Satisfactory" },
      components: [],
      trends: [],
      outliers: [],
      risk_signals: [],
      proxy_band: "satisfactory",
      proxy_score: 3.10,
      capital_category: "well_capitalized",
    });

    expect(text).toContain("public off-site analytical proxy");
    expect(text).toContain("Overall Assessment: satisfactory (score 3.1/4.0)");
    expect(text).toContain("Capital Classification: well_capitalized");
  });

  it("omits proxy fields from text when not provided", () => {
    const text = formatHealthSummaryText({
      institution: {
        cert: 1, name: "LEGACY BANK", city: "X", state: "TX",
        charter_class: "N", total_assets: 100000,
        report_date: "20251231", data_staleness: "current",
      },
      composite: { rating: 2, label: "Satisfactory" },
      components: [],
      trends: [],
      outliers: [],
      risk_signals: [],
    });

    expect(text).not.toContain("Overall Assessment:");
    expect(text).not.toContain("Capital Classification:");
  });
});
