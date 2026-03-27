import { describe, expect, it } from "vitest";
import {
  formatHoldingCompanyProfileText,
  type HoldingCompanyProfileResult,
} from "../src/tools/holdingCompanyProfile.js";

function makeProfile(
  overrides: Partial<HoldingCompanyProfileResult> = {},
): HoldingCompanyProfileResult {
  return {
    holding_company: {
      name: "TEST HOLDING CO",
      subsidiary_count: 2,
      states: ["CA", "NY"],
    },
    aggregate: {
      total_assets: 600000,
      total_deposits: 480000,
      subsidiary_count: 2,
      states: ["CA", "NY"],
      weighted_roa: 1.25,
      weighted_equity_ratio: 10.0,
    },
    subsidiaries: [
      {
        cert: 1001,
        name: "First Test Bank",
        state: "NY",
        total_assets: 400000,
        total_deposits: 320000,
        roa: 1.5,
        equity_ratio: 11.0,
        active: true,
      },
      {
        cert: 1002,
        name: "Second Test Bank",
        state: "CA",
        total_assets: 200000,
        total_deposits: 160000,
        roa: 0.75,
        equity_ratio: 8.0,
        active: true,
      },
    ],
    ...overrides,
  };
}

describe("formatHoldingCompanyProfileText", () => {
  it("includes holding company name in header", () => {
    const text = formatHoldingCompanyProfileText(makeProfile());
    expect(text).toContain("TEST HOLDING CO");
  });

  it("includes subsidiary count and states", () => {
    const text = formatHoldingCompanyProfileText(makeProfile());
    expect(text).toContain("Subsidiaries: 2");
    expect(text).toContain("CA, NY");
  });

  it("includes consolidated summary metrics", () => {
    const text = formatHoldingCompanyProfileText(makeProfile());
    expect(text).toContain("Total Assets:");
    expect(text).toContain("Total Deposits:");
    expect(text).toContain("Weighted ROA:");
    expect(text).toContain("1.25%");
    expect(text).toContain("Weighted Equity Ratio:");
    expect(text).toContain("10.00%");
  });

  it("lists subsidiaries sorted by assets descending", () => {
    const text = formatHoldingCompanyProfileText(makeProfile());
    const firstIdx = text.indexOf("First Test Bank");
    const secondIdx = text.indexOf("Second Test Bank");
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("shows n/a for null ROA and equity", () => {
    const profile = makeProfile({
      subsidiaries: [
        {
          cert: 1001,
          name: "Null Metrics Bank",
          state: "TX",
          total_assets: 100000,
          total_deposits: 80000,
          roa: null,
          equity_ratio: null,
          active: true,
        },
      ],
    });
    const text = formatHoldingCompanyProfileText(profile);
    expect(text).toContain("n/a");
  });

  it("shows n/a for null weighted metrics in summary", () => {
    const profile = makeProfile({
      aggregate: {
        total_assets: 100000,
        total_deposits: 80000,
        subsidiary_count: 1,
        states: ["TX"],
        weighted_roa: null,
        weighted_equity_ratio: null,
      },
    });
    const text = formatHoldingCompanyProfileText(profile);
    expect(text).toContain("Weighted ROA:            n/a");
    expect(text).toContain("Weighted Equity Ratio:   n/a");
  });

  it("includes section headers", () => {
    const text = formatHoldingCompanyProfileText(makeProfile());
    expect(text).toContain("Consolidated Summary");
    expect(text).toContain("Subsidiaries");
    expect(text).toContain("CERT");
    expect(text).toContain("Assets ($K)");
  });
});
