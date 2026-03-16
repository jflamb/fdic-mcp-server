import { describe, expect, it } from "vitest";

import {
  getQuarterIndex,
  maxOrNull,
  yearsBetween,
} from "../src/tools/analysis.js";

describe("getQuarterIndex", () => {
  it("maps every month to its containing quarter", () => {
    expect(getQuarterIndex("20240115")).toBe(2024 * 4 + 1);
    expect(getQuarterIndex("20240215")).toBe(2024 * 4 + 1);
    expect(getQuarterIndex("20240315")).toBe(2024 * 4 + 1);
    expect(getQuarterIndex("20240415")).toBe(2024 * 4 + 2);
    expect(getQuarterIndex("20240515")).toBe(2024 * 4 + 2);
    expect(getQuarterIndex("20240615")).toBe(2024 * 4 + 2);
    expect(getQuarterIndex("20240715")).toBe(2024 * 4 + 3);
    expect(getQuarterIndex("20240815")).toBe(2024 * 4 + 3);
    expect(getQuarterIndex("20240915")).toBe(2024 * 4 + 3);
    expect(getQuarterIndex("20241015")).toBe(2024 * 4 + 4);
    expect(getQuarterIndex("20241115")).toBe(2024 * 4 + 4);
    expect(getQuarterIndex("20241215")).toBe(2024 * 4 + 4);
  });

  it("returns null for invalid months", () => {
    expect(getQuarterIndex("20240015")).toBeNull();
    expect(getQuarterIndex("20241315")).toBeNull();
  });
});

describe("yearsBetween", () => {
  it("returns exact quarter-based year spans for FDIC reporting dates", () => {
    expect(yearsBetween("20211231", "20250630")).toBe(3.5);
    expect(yearsBetween("20240331", "20240630")).toBe(0.25);
  });

  it("uses quarter math for non-quarter-end dates in the same quarter cadence", () => {
    expect(yearsBetween("20240115", "20240415")).toBe(0.25);
    expect(yearsBetween("20240115", "20250115")).toBe(1);
  });

  it("clamps reversed ranges to zero", () => {
    expect(yearsBetween("20250630", "20211231")).toBe(0);
  });
});

describe("maxOrNull", () => {
  it("returns the max when at least one value is present", () => {
    expect(maxOrNull([null, 10, 7, null, 15])).toBe(15);
  });

  it("returns null when all values are null", () => {
    expect(maxOrNull([null, null, null])).toBeNull();
  });
});
