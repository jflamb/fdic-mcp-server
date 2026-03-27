import { describe, expect, it } from "vitest";
import {
  computeMarketShare,
  computeHHI,
  classifyConcentration,
  buildMarketConcentration,
  type BranchRecord,
} from "../src/tools/shared/marketShare.js";

describe("computeMarketShare", () => {
  it("aggregates multiple branches per institution", () => {
    const branches: BranchRecord[] = [
      { cert: 1, name: "Bank A", deposits: 500 },
      { cert: 1, name: "Bank A", deposits: 300 },
      { cert: 2, name: "Bank B", deposits: 200 },
    ];
    const result = computeMarketShare(branches);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      cert: 1,
      name: "Bank A",
      total_deposits: 800,
      branch_count: 2,
      rank: 1,
    });
    expect(result[1]).toMatchObject({
      cert: 2,
      name: "Bank B",
      total_deposits: 200,
      branch_count: 1,
      rank: 2,
    });
  });

  it("computes correct market share percentages", () => {
    const branches: BranchRecord[] = [
      { cert: 1, name: "Bank A", deposits: 750 },
      { cert: 2, name: "Bank B", deposits: 250 },
    ];
    const result = computeMarketShare(branches);
    expect(result[0].market_share).toBeCloseTo(75, 1);
    expect(result[1].market_share).toBeCloseTo(25, 1);
  });

  it("sorts descending by deposits and assigns rank", () => {
    const branches: BranchRecord[] = [
      { cert: 3, name: "Small Bank", deposits: 100 },
      { cert: 1, name: "Big Bank", deposits: 500 },
      { cert: 2, name: "Medium Bank", deposits: 300 },
    ];
    const result = computeMarketShare(branches);
    expect(result[0].cert).toBe(1);
    expect(result[0].rank).toBe(1);
    expect(result[1].cert).toBe(2);
    expect(result[1].rank).toBe(2);
    expect(result[2].cert).toBe(3);
    expect(result[2].rank).toBe(3);
  });

  it("handles single institution", () => {
    const branches: BranchRecord[] = [
      { cert: 1, name: "Only Bank", deposits: 1000 },
    ];
    const result = computeMarketShare(branches);
    expect(result).toHaveLength(1);
    expect(result[0].market_share).toBeCloseTo(100, 1);
    expect(result[0].rank).toBe(1);
  });

  it("returns empty array for empty input", () => {
    expect(computeMarketShare([])).toEqual([]);
  });
});

describe("computeHHI", () => {
  it("returns 10000 for a single firm with 100% share", () => {
    expect(computeHHI([100])).toBe(10000);
  });

  it("returns 5000 for two equal firms", () => {
    // 50^2 + 50^2 = 2500 + 2500 = 5000
    expect(computeHHI([50, 50])).toBe(5000);
  });

  it("returns 2500 for four equal firms", () => {
    // 25^2 * 4 = 625 * 4 = 2500
    expect(computeHHI([25, 25, 25, 25])).toBe(2500);
  });

  it("computes correctly for a dominant player scenario", () => {
    // 80^2 + 10^2 + 10^2 = 6400 + 100 + 100 = 6600
    expect(computeHHI([80, 10, 10])).toBe(6600);
  });

  it("returns 0 for empty array", () => {
    expect(computeHHI([])).toBe(0);
  });

  it("returns 1000 for ten equal firms", () => {
    // 10^2 * 10 = 100 * 10 = 1000
    expect(computeHHI(Array(10).fill(10))).toBe(1000);
  });
});

describe("classifyConcentration", () => {
  it("classifies HHI < 1500 as unconcentrated", () => {
    expect(classifyConcentration(1000)).toBe("unconcentrated");
    expect(classifyConcentration(0)).toBe("unconcentrated");
    expect(classifyConcentration(1499)).toBe("unconcentrated");
  });

  it("classifies HHI 1500-2500 as moderately concentrated", () => {
    expect(classifyConcentration(1500)).toBe("moderately_concentrated");
    expect(classifyConcentration(2000)).toBe("moderately_concentrated");
    expect(classifyConcentration(2500)).toBe("moderately_concentrated");
  });

  it("classifies HHI > 2500 as highly concentrated", () => {
    expect(classifyConcentration(2501)).toBe("highly_concentrated");
    expect(classifyConcentration(5000)).toBe("highly_concentrated");
    expect(classifyConcentration(10000)).toBe("highly_concentrated");
  });
});

describe("buildMarketConcentration", () => {
  it("computes concentration from participants", () => {
    const participants = computeMarketShare([
      { cert: 1, name: "Bank A", deposits: 500 },
      { cert: 2, name: "Bank B", deposits: 300 },
      { cert: 3, name: "Bank C", deposits: 200 },
    ]);
    const concentration = buildMarketConcentration(participants);
    // shares: 50%, 30%, 20% → HHI = 2500 + 900 + 400 = 3800
    expect(concentration.hhi).toBeCloseTo(3800, 0);
    expect(concentration.classification).toBe("highly_concentrated");
    expect(concentration.total_deposits).toBe(1000);
    expect(concentration.institution_count).toBe(3);
  });

  it("handles empty participants", () => {
    const concentration = buildMarketConcentration([]);
    expect(concentration.hhi).toBe(0);
    expect(concentration.classification).toBe("unconcentrated");
    expect(concentration.total_deposits).toBe(0);
    expect(concentration.institution_count).toBe(0);
  });
});
