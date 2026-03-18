import { describe, expect, it } from "vitest";

import {
  computeCompetitionRank,
  formatRepdteHuman,
  PeerGroupInputSchema,
} from "../src/tools/peerGroup.js";
import {
  computeMedian,
  deriveMetrics,
} from "../src/tools/shared/financialMetrics.js";

describe("deriveMetrics", () => {
  it("computes all derived metrics from raw financial fields", () => {
    const result = deriveMetrics({
      ASSET: 1000,
      DEP: 800,
      ROA: 1.5,
      ROE: 12.0,
      NETNIM: 3.5,
      EQTOT: 100,
      LNLSNET: 600,
      INTINC: 50,
      EINTEXP: 15,
      NONII: 10,
      NONIX: 25,
    });

    expect(result.asset).toBe(1000);
    expect(result.dep).toBe(800);
    expect(result.roa).toBe(1.5);
    expect(result.roe).toBe(12.0);
    expect(result.netnim).toBe(3.5);
    expect(result.equity_ratio).toBeCloseTo(10.0);
    // efficiency_ratio = 25 / (35 + 10) * 100 = 55.556
    expect(result.efficiency_ratio).toBeCloseTo(55.556, 2);
    expect(result.loan_to_deposit).toBeCloseTo(0.75);
    expect(result.deposits_to_assets).toBeCloseTo(0.8);
    // noninterest_income_share = 10 / (35 + 10) = 0.2222
    expect(result.noninterest_income_share).toBeCloseTo(0.2222, 3);
  });

  it("returns null for equity_ratio and deposits_to_assets when ASSET is zero", () => {
    const result = deriveMetrics({
      ASSET: 0, DEP: 800, ROA: 1, ROE: 8, NETNIM: 3,
      EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25,
    });
    expect(result.equity_ratio).toBeNull();
    expect(result.deposits_to_assets).toBeNull();
  });

  it("returns null for efficiency_ratio when denominator is zero or negative", () => {
    const result = deriveMetrics({
      ASSET: 1000, DEP: 800, ROA: 1, ROE: 8, NETNIM: 3,
      EQTOT: 100, LNLSNET: 600, INTINC: 10, EINTEXP: 15, NONII: 5, NONIX: 25,
    });
    // net_interest_income = 10 - 15 = -5, denominator = -5 + 5 = 0
    expect(result.efficiency_ratio).toBeNull();
    expect(result.noninterest_income_share).toBeNull();
  });

  it("returns null for loan_to_deposit when DEP is zero", () => {
    const result = deriveMetrics({
      ASSET: 1000, DEP: 0, ROA: 1, ROE: 8, NETNIM: 3,
      EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25,
    });
    expect(result.loan_to_deposit).toBeNull();
  });

  it("handles null input fields gracefully", () => {
    const result = deriveMetrics({
      ASSET: null, DEP: null, ROA: null, ROE: null, NETNIM: null,
      EQTOT: null, LNLSNET: null, INTINC: null, EINTEXP: null, NONII: null, NONIX: null,
    });
    expect(result.asset).toBeNull();
    expect(result.dep).toBeNull();
    expect(result.roa).toBeNull();
    expect(result.equity_ratio).toBeNull();
    expect(result.efficiency_ratio).toBeNull();
    expect(result.loan_to_deposit).toBeNull();
    expect(result.deposits_to_assets).toBeNull();
    expect(result.noninterest_income_share).toBeNull();
  });
});

describe("computeMedian", () => {
  it("returns the middle value for an odd-length array", () => {
    expect(computeMedian([1, 3, 5])).toBe(3);
  });

  it("returns the average of middle values for an even-length array", () => {
    expect(computeMedian([1, 3, 5, 7])).toBe(4);
  });

  it("returns the single value for a one-element array", () => {
    expect(computeMedian([42])).toBe(42);
  });

  it("returns null for an empty array", () => {
    expect(computeMedian([])).toBeNull();
  });

  it("does not modify the input array", () => {
    const input = [5, 1, 3];
    computeMedian(input);
    expect(input).toEqual([5, 1, 3]);
  });
});

describe("computeCompetitionRank", () => {
  it("ranks a value among peers (higher-is-better, descending sort)", () => {
    const result = computeCompetitionRank(7, [10, 8, 6, 4, 2], true);
    expect(result).toEqual({ rank: 3, of: 6, percentile: 67 });
  });

  it("ranks a value among peers (lower-is-better, ascending sort)", () => {
    const result = computeCompetitionRank(3, [10, 8, 6, 4, 2], false);
    expect(result).toEqual({ rank: 2, of: 6, percentile: 83 });
  });

  it("handles ties — subject gets same rank as equal peers", () => {
    // Peers: [10, 8, 8, 4], subject: 8
    // All values desc: 10, 8, 8, 8, 4
    // Competition ranks: 10→1, 8→2, 4→5
    // Subject value 8 → rank 2
    const result = computeCompetitionRank(8, [10, 8, 8, 4], true);
    expect(result).toEqual({ rank: 2, of: 5, percentile: 80 });
  });

  it("gives rank 1 and 100th percentile when subject is best", () => {
    const result = computeCompetitionRank(99, [10, 20, 30], true);
    expect(result).toEqual({ rank: 1, of: 4, percentile: 100 });
  });

  it("gives last rank within the full comparison set when subject is worst", () => {
    const result = computeCompetitionRank(1, [10, 20, 30], true);
    // All desc: 30, 20, 10, 1 → subject rank 4
    expect(result).toEqual({ rank: 4, of: 4, percentile: 25 });
  });

  it("handles null-direction metrics (descending sort by default)", () => {
    const result = computeCompetitionRank(5, [10, 8, 3, 1], null);
    // All desc: 10, 8, 5, 3, 1 → subject rank 3
    expect(result).toEqual({ rank: 3, of: 5, percentile: 60 });
  });

  it("returns null when peer list is empty", () => {
    expect(computeCompetitionRank(5, [], true)).toBeNull();
  });
});

describe("formatRepdteHuman", () => {
  it("formats YYYYMMDD as a human-readable date", () => {
    expect(formatRepdteHuman("20241231")).toBe("December 31, 2024");
  });

  it("formats March date correctly", () => {
    expect(formatRepdteHuman("20230331")).toBe("March 31, 2023");
  });

  it("returns the raw string for invalid dates", () => {
    expect(formatRepdteHuman("bad")).toBe("bad");
  });

  it("returns the raw string for impossible calendar dates", () => {
    expect(formatRepdteHuman("20240230")).toBe("20240230");
  });
});

describe("PeerGroupInputSchema", () => {
  it("accepts subject-driven mode with cert and repdte", () => {
    const result = PeerGroupInputSchema.safeParse({
      cert: 29846,
      repdte: "20241231",
    });
    expect(result.success).toBe(true);
  });

  it("accepts explicit-criteria mode without cert", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      asset_min: 5000000,
      asset_max: 20000000,
      charter_classes: ["N"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts when repdte is missing (defaults to most recent quarter)", () => {
    const result = PeerGroupInputSchema.safeParse({ cert: 29846 });
    expect(result.success).toBe(true);
  });

  it("accepts schema-level parsing when no peer-group constructor is provided", () => {
    const result = PeerGroupInputSchema.safeParse({ repdte: "20241231" });
    expect(result.success).toBe(true);
  });

  it("accepts schema-level parsing when asset_min > asset_max", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      asset_min: 20000000,
      asset_max: 5000000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid state codes", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      state: "North Carolina",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid two-letter state code", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      state: "NC",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for active_only and limit", () => {
    const result = PeerGroupInputSchema.parse({
      cert: 29846,
      repdte: "20241231",
    });
    expect(result.active_only).toBe(true);
    expect(result.limit).toBe(50);
  });
});
