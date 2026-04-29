import { describe, expect, it } from "vitest";

import {
  aggregateFinancialRecords,
  buildCommunityComparison,
  buildExecutiveSnapshot,
  buildLoanAndDepositSeries,
  buildPortfolioPerformance,
  buildTruncationWarning,
} from "../src/tools/qbpLite.js";

describe("aggregateFinancialRecords", () => {
  it("sums dollar fields and computes weighted ratio metrics", () => {
    const metrics = aggregateFinancialRecords([
      {
        ASSET: 1000,
        LNLSNET: 600,
        DEPDOM: 700,
        DEP: 750,
        SC: 100,
        EQTOT: 100,
        NETINC: 10,
        ROA: 1,
        ROE: 10,
        NIMY: 3,
        ERNAST: 800,
        NCLNLSR: 1,
        NTLNLSR: 0.2,
        RBC1AAJ: 8,
        RBCT1C: 60,
        RBCT1: 70,
        RBC: 80,
        RWAJ: 500,
        RWAJT: 500,
        // These fields are intentionally misleading for this aggregation:
        // IDT1CER is not leverage in current FDIC metadata, and RBCT1J is a
        // dollar amount rather than a CET1 ratio.
        IDT1CER: 99,
        RBCT1J: 999999,
      },
      {
        ASSET: 3000,
        LNLSNET: 1800,
        DEPDOM: 2100,
        DEP: 2200,
        SC: 300,
        EQTOT: 300,
        NETINC: 30,
        ROA: 2,
        ROE: 20,
        NIMY: 4,
        ERNAST: 2400,
        NCLNLSR: 2,
        NTLNLSR: 0.4,
        RBC1AAJ: 10,
        RBCT1C: 180,
        RBCT1: 210,
        RBC: 240,
        RWAJ: 1500,
        RWAJT: 1500,
        IDT1CER: 99,
        RBCT1J: 999999,
      },
    ]);

    expect(metrics.institution_count).toBe(2);
    expect(metrics.total_assets).toBe(4000);
    expect(metrics.total_loans_and_leases).toBe(2400);
    expect(metrics.domestic_deposits).toBe(2800);
    expect(metrics.total_deposits).toBe(2950);
    expect(metrics.securities).toBe(400);
    expect(metrics.equity_capital).toBe(400);
    expect(metrics.net_income).toBe(40);
    expect(metrics.roa_pct).toBeCloseTo(1.75, 2);
    expect(metrics.roe_pct).toBeCloseTo(17.5, 2);
    expect(metrics.net_interest_margin_pct).toBeCloseTo(3.75, 2);
    expect(metrics.noncurrent_loans_pct).toBeCloseTo(1.75, 2);
    expect(metrics.net_chargeoffs_pct).toBeCloseTo(0.35, 2);
    expect(metrics.leverage_ratio_pct).toBeCloseTo(9.5, 2);
    expect(metrics.common_equity_tier1_ratio_pct).toBeCloseTo(12, 2);
    expect(metrics.tier1_risk_based_ratio_pct).toBeCloseTo(14, 2);
    expect(metrics.total_risk_based_ratio_pct).toBeCloseTo(16, 2);
  });

  it("returns null for absent numeric inputs while preserving institution count", () => {
    const metrics = aggregateFinancialRecords([{ CERT: 1 }, { CERT: 2 }]);

    expect(metrics.institution_count).toBe(2);
    expect(metrics.total_assets).toBeNull();
    expect(metrics.roa_pct).toBeNull();
    expect(metrics.net_chargeoffs_pct).toBeNull();
  });
});

describe("buildExecutiveSnapshot", () => {
  it("compares current metrics with prior quarter and year ago values", () => {
    const current = aggregateFinancialRecords([
      { ASSET: 1200, LNLSNET: 800, DEPDOM: 900, NETINC: 12, ROA: 1.2 },
    ]);
    const priorQuarter = aggregateFinancialRecords([
      { ASSET: 1000, LNLSNET: 700, DEPDOM: 850, NETINC: 10, ROA: 1.0 },
    ]);
    const yearAgo = aggregateFinancialRecords([
      { ASSET: 800, LNLSNET: 650, DEPDOM: 800, NETINC: 8, ROA: 0.8 },
    ]);

    const snapshot = buildExecutiveSnapshot(current, priorQuarter, yearAgo);
    const assets = snapshot.find((row) => row.id === "total_assets");
    const roa = snapshot.find((row) => row.id === "roa_pct");

    expect(assets).toEqual(
      expect.objectContaining({
        current: 1200,
        prior_quarter_change: 200,
        prior_quarter_change_pct: 20,
        year_over_year_change: 400,
        year_over_year_change_pct: 50,
      }),
    );
    expect(roa).toEqual(
      expect.objectContaining({
        current: 1.2,
        prior_quarter_change: 0.19999999999999996,
        prior_quarter_change_pct: null,
        year_over_year_change: 0.3999999999999999,
        year_over_year_change_pct: null,
        change_unit: "percentage_points",
      }),
    );
  });
});

describe("buildLoanAndDepositSeries", () => {
  it("computes quarterly changes and leaves YoY null when year-ago data is missing", () => {
    const rows = buildLoanAndDepositSeries([
      {
        repdte: "20240930",
        total_loans_and_leases: 100,
        domestic_deposits: 200,
      } as ReturnType<typeof aggregateFinancialRecords> & { repdte: string },
      {
        repdte: "20241231",
        total_loans_and_leases: 125,
        domestic_deposits: 190,
      } as ReturnType<typeof aggregateFinancialRecords> & { repdte: string },
    ]);

    expect(rows[1]).toMatchObject({
      quarterly_loan_change: 25,
      loan_growth_12_month_pct: null,
      quarterly_domestic_deposit_change: -10,
      domestic_deposit_growth_12_month_pct: null,
    });
  });
});

describe("buildPortfolioPerformance", () => {
  it("builds weighted portfolio credit-quality rows", () => {
    const rows = buildPortfolioPerformance([
      {
        LNLSNET: 1000,
        LNRE: 400,
        P3RER: 1.5,
        NTRER: 0.2,
        LNCI: 200,
        P3CIR: 2,
        NTCIR: 0.4,
      },
    ]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "real_estate",
          balance: 400,
          balance_share_of_total_loans_pct: 40,
          noncurrent_rate_pct: 1.5,
          net_chargeoff_rate_pct: 0.2,
        }),
      ]),
    );
  });
});

describe("buildCommunityComparison", () => {
  it("compares industry and community-bank slices using the public CB flag", () => {
    const rows = buildCommunityComparison(
      new Map([
        [
          "20241231",
          [
            { CB: "1", ASSET: 100, NETINC: 1, ROA: 1 },
            { CB: 0, ASSET: 300, NETINC: 6, ROA: 2 },
          ],
        ],
      ]),
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: "Industry",
          institution_count: 2,
          total_assets: 400,
          net_income: 7,
        }),
        expect.objectContaining({
          group: "Community Banks",
          institution_count: 1,
          total_assets: 100,
          net_income: 1,
        }),
      ]),
    );
  });
});

describe("buildTruncationWarning", () => {
  it("warns when a single-quarter fetch hits the 10k cap", () => {
    expect(buildTruncationWarning("19991231", 10_000, 10_500)).toBe(
      "REPDTE 19991231: results truncated at 10,000 of 10,500 institutions.",
    );
  });

  it("does not warn when total records fit in one fetch", () => {
    expect(buildTruncationWarning("20251231", 4_408, 4_408)).toBeNull();
  });
});
