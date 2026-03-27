import { describe, expect, it } from "vitest";
import {
  formatFranchiseFootprintText,
  type FranchiseFootprintSummary,
} from "../src/tools/franchiseFootprint.js";

describe("formatFranchiseFootprintText", () => {
  it("formats a franchise footprint summary with header and market breakdown", () => {
    const summary: FranchiseFootprintSummary = {
      institution: { cert: 3511, name: "JPMorgan Chase Bank", year: 2024 },
      summary: {
        total_branches: 23,
        total_deposits: 4036034,
        market_count: 3,
      },
      markets: [
        { market_name: "Dallas-Fort Worth-Arlington", branch_count: 12, total_deposits: 2345678, pct_of_total: 58.1 },
        { market_name: "Houston-The Woodlands-Sugar Land", branch_count: 8, total_deposits: 1234567, pct_of_total: 30.6 },
        { market_name: "Non-MSA / Rural", branch_count: 3, total_deposits: 455789, pct_of_total: 11.3 },
      ],
    };

    const text = formatFranchiseFootprintText(summary);
    expect(text).toContain("Franchise Footprint: JPMorgan Chase Bank");
    expect(text).toContain("CERT 3511");
    expect(text).toContain("2024 SOD Data");
    expect(text).toContain("Total Branches: 23");
    expect(text).toContain("$4,036,034K");
    expect(text).toContain("Markets:        3");
    expect(text).toContain("Dallas-Fort Worth-Arlington");
    expect(text).toContain("Non-MSA / Rural");
    expect(text).toContain("58.1%");
    expect(text).toContain("30.6%");
  });

  it("truncates long market names", () => {
    const summary: FranchiseFootprintSummary = {
      institution: { cert: 1, name: "Test Bank", year: 2024 },
      summary: { total_branches: 1, total_deposits: 1000, market_count: 1 },
      markets: [
        {
          market_name: "A Very Long MSA Name That Definitely Exceeds The Limit",
          branch_count: 1,
          total_deposits: 1000,
          pct_of_total: 100,
        },
      ],
    };

    const text = formatFranchiseFootprintText(summary);
    expect(text).toContain("A Very Long MSA Name That De...");
  });

  it("handles empty markets array", () => {
    const summary: FranchiseFootprintSummary = {
      institution: { cert: 1, name: "Test Bank", year: 2024 },
      summary: { total_branches: 0, total_deposits: 0, market_count: 0 },
      markets: [],
    };

    const text = formatFranchiseFootprintText(summary);
    expect(text).toContain("Total Branches: 0");
    expect(text).toContain("Markets:        0");
  });
});
