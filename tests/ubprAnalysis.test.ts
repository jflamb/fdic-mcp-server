import { describe, expect, it } from "vitest";
import { formatUbprSummaryText } from "../src/tools/ubprAnalysis.js";

describe("formatUbprSummaryText", () => {
  it("formats a complete UBPR analysis summary", () => {
    const text = formatUbprSummaryText({
      institution: {
        cert: 3850,
        name: "FIRST NATIONAL BANK",
        city: "Springfield",
        state: "IL",
        total_assets: 500000,
        report_date: "20251231",
        prior_report_date: "20241231",
      },
      ratios: {
        summary: {
          roa: 1.15,
          roe: 11.5,
          nim: 3.65,
          efficiency_ratio: 58.2,
          pretax_roa: 1.45,
        },
        loan_mix: {
          re_share: 60.0,
          ci_share: 20.0,
          consumer_share: 10.0,
          ag_share: 5.0,
        },
        capital: {
          tier1_leverage: 9.8,
          tier1_rbc: 12.5,
          equity_ratio: 10.0,
        },
        liquidity: {
          loan_to_deposit: 75.0,
          core_deposit_ratio: 80.0,
          brokered_ratio: 5.5,
          cash_ratio: 8.2,
        },
      },
      growth: {
        asset_growth: 10.0,
        loan_growth: 10.0,
        deposit_growth: 10.0,
      },
      disclaimer: "Ratios computed from FDIC Call Report data. UBPR-equivalent, not official FFIEC output.",
    });

    expect(text).toContain("UBPR-Equivalent Ratio Analysis: FIRST NATIONAL BANK");
    expect(text).toContain("Springfield, IL | CERT 3850");
    expect(text).toContain("20251231 (vs. year-ago: 20241231)");

    // Summary ratios
    expect(text).toContain("1.15%");
    expect(text).toContain("11.50%");
    expect(text).toContain("3.65%");
    expect(text).toContain("58.20%");
    expect(text).toContain("1.45%");

    // Loan mix
    expect(text).toContain("60.00%");
    expect(text).toContain("20.00%");
    expect(text).toContain("10.00%");
    expect(text).toContain("5.00%");

    // Capital
    expect(text).toContain("9.80%");
    expect(text).toContain("12.50%");

    // Liquidity
    expect(text).toContain("75.00%");
    expect(text).toContain("80.00%");
    expect(text).toContain("5.50%");
    expect(text).toContain("8.20%");

    // Growth
    expect(text).toContain("Asset Growth");
    expect(text).toContain("Loan Growth");
    expect(text).toContain("Deposit Growth");

    // Disclaimer
    expect(text).toContain("UBPR-equivalent calculations, not official FFIEC UBPR output");
  });

  it("displays n/a for null values", () => {
    const text = formatUbprSummaryText({
      institution: {
        cert: 1,
        name: "TEST BANK",
        city: "X",
        state: "TX",
        total_assets: 100000,
        report_date: "20251231",
        prior_report_date: "20241231",
      },
      ratios: {
        summary: {
          roa: null,
          roe: null,
          nim: null,
          efficiency_ratio: null,
          pretax_roa: null,
        },
        loan_mix: {
          re_share: null,
          ci_share: null,
          consumer_share: null,
          ag_share: null,
        },
        capital: {
          tier1_leverage: null,
          tier1_rbc: null,
          equity_ratio: null,
        },
        liquidity: {
          loan_to_deposit: null,
          core_deposit_ratio: null,
          brokered_ratio: null,
          cash_ratio: null,
        },
      },
      growth: {
        asset_growth: null,
        loan_growth: null,
        deposit_growth: null,
      },
      disclaimer: "Ratios computed from FDIC Call Report data. UBPR-equivalent, not official FFIEC output.",
    });

    // Count n/a occurrences — should be present for all null values
    const naCount = (text.match(/n\/a/g) ?? []).length;
    expect(naCount).toBeGreaterThanOrEqual(15);
  });

  it("includes section headers", () => {
    const text = formatUbprSummaryText({
      institution: {
        cert: 1,
        name: "TEST BANK",
        city: "X",
        state: "TX",
        total_assets: 100000,
        report_date: "20251231",
        prior_report_date: "20241231",
      },
      ratios: {
        summary: { roa: 1.0, roe: 10.0, nim: 3.0, efficiency_ratio: 60.0, pretax_roa: 1.2 },
        loan_mix: { re_share: 50.0, ci_share: 20.0, consumer_share: 15.0, ag_share: 5.0 },
        capital: { tier1_leverage: 9.0, tier1_rbc: 12.0, equity_ratio: 10.0 },
        liquidity: { loan_to_deposit: 70.0, core_deposit_ratio: 80.0, brokered_ratio: 5.0, cash_ratio: 8.0 },
      },
      growth: { asset_growth: 5.0, loan_growth: 3.0, deposit_growth: 4.0 },
      disclaimer: "Ratios computed from FDIC Call Report data. UBPR-equivalent, not official FFIEC output.",
    });

    expect(text).toContain("Summary Ratios");
    expect(text).toContain("Loan Mix");
    expect(text).toContain("Capital Adequacy");
    expect(text).toContain("Liquidity");
    expect(text).toContain("Year-over-Year Growth");
  });
});
