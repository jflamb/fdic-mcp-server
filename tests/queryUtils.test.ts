import { describe, expect, it } from "vitest";

import {
  buildFilterString,
  getDefaultReportDate,
  getReportDateOneYearPrior,
  mapWithConcurrency,
} from "../src/tools/shared/queryUtils.js";

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

describe("getDefaultReportDate", () => {
  it("returns an 8-digit YYYYMMDD string", () => {
    const result = getDefaultReportDate();
    expect(result).toMatch(/^\d{8}$/);
  });

  it("returns a valid quarter-end date", () => {
    const result = getDefaultReportDate();
    const suffix = result.slice(4);
    expect(["0331", "0630", "0930", "1231"]).toContain(suffix);
  });

  it("returns a date in the past (not a future quarter)", () => {
    const result = getDefaultReportDate();
    const year = Number.parseInt(result.slice(0, 4), 10);
    const month = Number.parseInt(result.slice(4, 6), 10);
    const day = Number.parseInt(result.slice(6, 8), 10);
    const reportDate = new Date(Date.UTC(year, month - 1, day));
    expect(reportDate.getTime()).toBeLessThan(Date.now());
  });
});

describe("getReportDateOneYearPrior", () => {
  it("subtracts one year while preserving the quarter-end suffix", () => {
    expect(getReportDateOneYearPrior("20251231")).toBe("20241231");
    expect(getReportDateOneYearPrior("20240630")).toBe("20230630");
    expect(getReportDateOneYearPrior("20230331")).toBe("20220331");
  });
});

describe("mapWithConcurrency", () => {
  it("processes each input exactly once and preserves result ordering", async () => {
    const values = [10, 20, 30, 40, 50];
    const startedIndices: number[] = [];
    const completedIndices: number[] = [];

    const results = await mapWithConcurrency(values, 3, async (value, index) => {
      startedIndices.push(index);
      await new Promise((resolve) => setTimeout(resolve, values.length - index));
      completedIndices.push(index);
      return `${index}:${value}`;
    });

    expect(startedIndices.sort((left, right) => left - right)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(completedIndices).not.toEqual([0, 1, 2, 3, 4]);
    expect(results).toEqual(["0:10", "1:20", "2:30", "3:40", "4:50"]);
  });

  it("does not exceed the configured concurrency limit", async () => {
    const values = Array.from({ length: 8 }, (_, index) => index);
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency(values, 3, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value;
    });

    expect(maxActive).toBe(3);
  });
});
