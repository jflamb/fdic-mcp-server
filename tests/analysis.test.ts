import { describe, expect, it } from "vitest";

import { maxOrNull, yearsBetween } from "../src/tools/analysis.js";

describe("yearsBetween", () => {
  it("returns exact quarter-based year spans for FDIC reporting dates", () => {
    expect(yearsBetween("20211231", "20250630")).toBe(3.5);
    expect(yearsBetween("20240331", "20240630")).toBe(0.25);
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
