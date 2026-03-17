import { describe, it, expect } from "vitest";
import { resolveState, formatStateError } from "../src/tools/shared/stateUtils.js";

describe("resolveState", () => {
  it("resolves a full state name", () => {
    expect(resolveState("North Carolina")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("resolves a two-letter abbreviation", () => {
    expect(resolveState("NC")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("is case-insensitive for full names", () => {
    expect(resolveState("north carolina")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("is case-insensitive for abbreviations", () => {
    expect(resolveState("nc")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("resolves District of Columbia", () => {
    expect(resolveState("DC")).toEqual({ name: "District of Columbia", code: "DC" });
  });

  it("resolves a territory", () => {
    expect(resolveState("Puerto Rico")).toEqual({ name: "Puerto Rico", code: "PR" });
    expect(resolveState("PR")).toEqual({ name: "Puerto Rico", code: "PR" });
  });

  it("returns null for invalid input", () => {
    expect(resolveState("Narnia")).toBeNull();
    expect(resolveState("")).toBeNull();
    expect(resolveState("N")).toBeNull();
    expect(resolveState("ZZ")).toBeNull();
  });
});

describe("formatStateError", () => {
  it("returns a message listing both accepted formats", () => {
    const msg = formatStateError("Narnia");
    expect(msg).toContain("Narnia");
    expect(msg).toMatch(/abbreviation|full name/i);
  });
});
