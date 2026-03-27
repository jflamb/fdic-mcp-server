import { describe, expect, it } from "vitest";
import {
  formatRegionalContextText,
  type RegionalContextSummary,
} from "../src/tools/regionalContext.js";

describe("formatRegionalContextText", () => {
  it("formats degraded output when FRED is unavailable", () => {
    const summary: RegionalContextSummary = {
      state: "TX",
      date_range: { start: "2023-01-01", end: "2025-01-01" },
      context: {
        unemployment_trend: "stable",
        state_vs_national_unemployment: "at_parity",
        rate_environment: "moderate",
        latest_state_unemployment: null,
        latest_national_unemployment: null,
        latest_fed_funds: null,
        narrative: "Economic data is unavailable.",
      },
      fred_available: false,
    };
    const text = formatRegionalContextText(summary);
    expect(text).toContain("Regional Economic Context: TX");
    expect(text).toContain("FRED API data unavailable");
    expect(text).toContain("State unemployment trends");
    expect(text).toContain("Federal funds rate environment");
    expect(text).not.toContain("Economic Indicators");
  });

  it("formats full output when FRED data is available", () => {
    const summary: RegionalContextSummary = {
      state: "TX",
      institution: { cert: 12345, name: "First State Bank" },
      date_range: { start: "2023-06-30", end: "2025-06-30" },
      context: {
        unemployment_trend: "rising",
        state_vs_national_unemployment: "above",
        rate_environment: "elevated",
        latest_state_unemployment: 5.1,
        latest_national_unemployment: 4.0,
        latest_fed_funds: 5.25,
        narrative:
          "The state unemployment rate is 5.1%, above the national rate of 4.0% and rising over the past three quarters.",
      },
      fred_available: true,
    };
    const text = formatRegionalContextText(summary);
    expect(text).toContain("Regional Economic Context: TX");
    expect(text).toContain("First State Bank");
    expect(text).toContain("2023-06-30");
    expect(text).toContain("2025-06-30");
    expect(text).toContain("Economic Indicators");
    expect(text).toContain("5.10%");
    expect(text).toContain("4.00%");
    expect(text).toContain("5.25%");
    expect(text).toContain("rising");
    expect(text).toContain("above national");
    expect(text).toContain("elevated");
    expect(text).toContain("Assessment");
    expect(text).toContain("FRED (Federal Reserve Economic Data)");
  });

  it("formats output without institution when state-only", () => {
    const summary: RegionalContextSummary = {
      state: "CA",
      date_range: { start: "2023-01-01", end: "2025-01-01" },
      context: {
        unemployment_trend: "falling",
        state_vs_national_unemployment: "below",
        rate_environment: "low",
        latest_state_unemployment: 3.2,
        latest_national_unemployment: 3.8,
        latest_fed_funds: 1.5,
        narrative: "The state unemployment rate is 3.2%.",
      },
      fred_available: true,
    };
    const text = formatRegionalContextText(summary);
    expect(text).toContain("Regional Economic Context: CA");
    expect(text).not.toContain("First State Bank");
    expect(text).toContain("3.20%");
    expect(text).toContain("below national");
    expect(text).toContain("low");
  });

  it("displays n/a for null values", () => {
    const summary: RegionalContextSummary = {
      state: "NY",
      date_range: { start: "2023-01-01", end: "2025-01-01" },
      context: {
        unemployment_trend: "stable",
        state_vs_national_unemployment: "at_parity",
        rate_environment: "moderate",
        latest_state_unemployment: null,
        latest_national_unemployment: null,
        latest_fed_funds: null,
        narrative: "Economic data is unavailable.",
      },
      fred_available: true,
    };
    const text = formatRegionalContextText(summary);
    expect(text).toContain("n/a");
    expect(text).toContain("Economic Indicators");
  });
});
