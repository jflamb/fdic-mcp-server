import { describe, expect, it } from "vitest";
import {
  computePeerStats,
  computePercentile,
  computeRobustZScore,
  computeWeightedAggregate,
  computeMedian,
  computeMAD,
} from "../src/tools/shared/peerEngine.js";

describe("computeMedian", () => {
  it("returns median of odd-length array", () => {
    expect(computeMedian([1, 3, 5, 7, 9])).toBe(5);
  });
  it("returns median of even-length array", () => {
    expect(computeMedian([1, 3, 5, 7])).toBe(4); // (3+5)/2
  });
  it("returns null for empty array", () => {
    expect(computeMedian([])).toBeNull();
  });
});

describe("computeMAD", () => {
  it("computes median absolute deviation", () => {
    // values: [1, 2, 3, 4, 5], median=3
    // |deviations|: [2, 1, 0, 1, 2], sorted: [0, 1, 1, 2, 2], median=1
    expect(computeMAD([1, 2, 3, 4, 5], 3)).toBe(1);
  });
  it("returns 0 when all values identical", () => {
    expect(computeMAD([5, 5, 5], 5)).toBe(0);
  });
});

describe("computePercentile", () => {
  it("computes percentile for value in distribution", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(computePercentile(5, sorted)).toBe(50); // 5 of 10 values <= 5
    expect(computePercentile(1, sorted)).toBe(10);
    expect(computePercentile(10, sorted)).toBe(100);
  });
  it("handles value below all peers", () => {
    expect(computePercentile(0, [1, 2, 3])).toBe(0);
  });
  it("returns 50 for empty distribution", () => {
    expect(computePercentile(5, [])).toBe(50);
  });
});

describe("computeRobustZScore", () => {
  it("computes MAD-based z-score", () => {
    const values = [1, 2, 3, 4, 5];
    const z = computeRobustZScore(10, values); // far outlier
    expect(Math.abs(z)).toBeGreaterThan(2.5);
  });
  it("returns 0 when MAD is 0", () => {
    expect(computeRobustZScore(5, [5, 5, 5])).toBe(0);
  });
  it("returns 0 for empty values", () => {
    expect(computeRobustZScore(5, [])).toBe(0);
  });
});

describe("computePeerStats", () => {
  it("computes full peer statistics", () => {
    const stats = computePeerStats(8, [2, 4, 6, 8, 10, 12, 14]);
    expect(stats.peer_count).toBe(7);
    expect(stats.peer_median).toBe(8);
    expect(stats.subject_value).toBe(8);
    expect(stats.subject_percentile).toBeCloseTo(57.1, 0); // 4 of 7 values <= 8
    expect(stats.is_outlier).toBe(false);
  });

  it("flags outlier for extreme value", () => {
    const stats = computePeerStats(100, [1, 2, 3, 4, 5, 6, 7]);
    expect(stats.is_outlier).toBe(true);
    expect(stats.outlier_direction).toBe("high");
  });

  it("flags low outlier", () => {
    const stats = computePeerStats(-50, [1, 2, 3, 4, 5, 6, 7]);
    expect(stats.is_outlier).toBe(true);
    expect(stats.outlier_direction).toBe("low");
  });

  it("handles empty peer array", () => {
    const stats = computePeerStats(5, []);
    expect(stats.peer_count).toBe(0);
    expect(stats.subject_percentile).toBe(50);
    expect(stats.is_outlier).toBe(false);
  });

  it("inverts percentile for lower-is-better metrics", () => {
    // Efficiency ratio: lower is better. Subject at 55% with peers at [50, 60, 70, 80, 90]
    // Raw percentile: 1 of 5 values <= 55 = 20th percentile
    // Inverted: 100 - 20 = 80th percentile (being low is good)
    const stats = computePeerStats(55, [50, 60, 70, 80, 90], { higherIsBetter: false });
    expect(stats.subject_percentile).toBe(80);
  });

  it("does not invert percentile for higher-is-better metrics", () => {
    const stats = computePeerStats(8, [2, 4, 6, 8, 10], { higherIsBetter: true });
    // 4 of 5 values <= 8 = 80th percentile (being high is good)
    expect(stats.subject_percentile).toBe(80);
  });

  it("defaults to higher-is-better when no options provided", () => {
    // Backward compatible: existing callers without options should behave as before
    const stats = computePeerStats(8, [2, 4, 6, 8, 10]);
    expect(stats.subject_percentile).toBe(80);
  });
});

describe("computeWeightedAggregate", () => {
  it("computes weighted average", () => {
    const entries = [
      { value: 1.0, weight: 100 },
      { value: 2.0, weight: 300 },
    ];
    // (1.0*100 + 2.0*300) / (100+300) = 700/400 = 1.75
    expect(computeWeightedAggregate(entries)).toBe(1.75);
  });
  it("returns null for empty entries", () => {
    expect(computeWeightedAggregate([])).toBeNull();
  });
  it("returns null when total weight is 0", () => {
    expect(computeWeightedAggregate([{ value: 1.0, weight: 0 }])).toBeNull();
  });
});
