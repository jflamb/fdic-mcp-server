import { describe, expect, it } from "vitest";

import { buildFilterString } from "../src/tools/shared/queryUtils.js";

describe("buildFilterString", () => {
  it("returns undefined when no filters are provided", () => {
    expect(buildFilterString({})).toBeUndefined();
  });

  it("builds a cert-only filter", () => {
    expect(buildFilterString({ cert: 3511 })).toBe("CERT:3511");
  });

  it("builds a date-only filter", () => {
    expect(
      buildFilterString({ dateField: "REPDTE", dateValue: "20241231" }),
    ).toBe("REPDTE:20241231");
  });

  it("builds a raw-filters-only clause", () => {
    expect(buildFilterString({ rawFilters: 'CITY:"Austin"' })).toBe(
      '(CITY:"Austin")',
    );
  });

  it("builds all filter parts with raw filters first by default", () => {
    expect(
      buildFilterString({
        cert: 3511,
        dateField: "REPDTE",
        dateValue: "20241231",
        rawFilters: 'CITY:"Austin"',
      }),
    ).toBe('(CITY:"Austin") AND CERT:3511 AND REPDTE:20241231');
  });

  it("can place raw filters after cert/date clauses to preserve existing tool behavior", () => {
    expect(
      buildFilterString({
        cert: 3511,
        rawFilters: 'CITY:"Austin"',
        rawFiltersPosition: "last",
      }),
    ).toBe('CERT:3511 AND (CITY:"Austin")');
  });
});
