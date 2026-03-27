import { describe, expect, it } from "vitest";
import {
  formatMarketShareText,
  type MarketShareSummary,
} from "../src/tools/marketShareAnalysis.js";

describe("formatMarketShareText", () => {
  it("formats a market share summary with header, overview, and top institutions", () => {
    const summary: MarketShareSummary = {
      market: { name: "Dallas-Fort Worth-Arlington", year: 2024 },
      concentration: {
        hhi: 1800,
        classification: "moderately_concentrated",
        total_deposits: 50000000,
        institution_count: 25,
      },
      participants: [
        { cert: 1, name: "Big National Bank", total_deposits: 12345678, branch_count: 47, market_share: 24.7, rank: 1 },
        { cert: 2, name: "Regional Trust Co", total_deposits: 8901234, branch_count: 32, market_share: 17.8, rank: 2 },
      ],
    };

    const text = formatMarketShareText(summary);
    expect(text).toContain("Deposit Market Share Analysis");
    expect(text).toContain("Dallas-Fort Worth-Arlington");
    expect(text).toContain("2024 SOD Data");
    expect(text).toContain("$50,000,000K");
    expect(text).toContain("25");
    expect(text).toContain("1,800");
    expect(text).toContain("moderately concentrated");
    expect(text).toContain("Big National Bank");
    expect(text).toContain("Regional Trust Co");
    expect(text).toContain("24.7%");
    expect(text).not.toContain("\u2605"); // no star when no highlighted institution
  });

  it("includes highlighted institution when provided", () => {
    const summary: MarketShareSummary = {
      market: { name: "Travis County, TX", year: 2023 },
      concentration: {
        hhi: 900,
        classification: "unconcentrated",
        total_deposits: 10000000,
        institution_count: 40,
      },
      highlighted_institution: {
        cert: 99,
        name: "Community Bank of TX",
        rank: 15,
        market_share: 2.3,
        total_deposits: 230000,
        branch_count: 3,
      },
      participants: [],
    };

    const text = formatMarketShareText(summary);
    expect(text).toContain("\u2605 Community Bank of TX (CERT 99)");
    expect(text).toContain("Rank #15");
    expect(text).toContain("2.3% share");
  });

  it("truncates long institution names", () => {
    const summary: MarketShareSummary = {
      market: { name: "Test Market", year: 2024 },
      concentration: {
        hhi: 500,
        classification: "unconcentrated",
        total_deposits: 1000,
        institution_count: 1,
      },
      participants: [
        {
          cert: 1,
          name: "A Very Long Institution Name That Exceeds Limits",
          total_deposits: 1000,
          branch_count: 5,
          market_share: 100,
          rank: 1,
        },
      ],
    };

    const text = formatMarketShareText(summary);
    expect(text).toContain("A Very Long Institution Na...");
  });
});
