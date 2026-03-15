import { describe, expect, it } from "vitest";

import { yearsBetween } from "../src/tools/analysis.js";

describe("yearsBetween", () => {
  it("returns exact quarter-based year spans for FDIC reporting dates", () => {
    expect(yearsBetween("20211231", "20250630")).toBe(3.5);
    expect(yearsBetween("20240331", "20240630")).toBe(0.25);
  });

  it("clamps reversed ranges to zero", () => {
    expect(yearsBetween("20250630", "20211231")).toBe(0);
  });
});
