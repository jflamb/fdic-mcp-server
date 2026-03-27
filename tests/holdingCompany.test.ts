import { describe, expect, it } from "vitest";
import {
  groupByHoldingCompany,
  aggregateSubsidiaryMetrics,
  type SubsidiaryRecord,
} from "../src/tools/shared/holdingCompany.js";

function makeSub(overrides: Partial<SubsidiaryRecord> = {}): SubsidiaryRecord {
  return {
    cert: 1000,
    name: "Test Bank",
    hc_name: "Test HC",
    total_assets: 100000,
    total_deposits: 80000,
    roa: 1.0,
    equity_ratio: 10.0,
    state: "NY",
    active: true,
    ...overrides,
  };
}

describe("groupByHoldingCompany", () => {
  it("groups institutions by holding company name", () => {
    const institutions: SubsidiaryRecord[] = [
      makeSub({ cert: 1, hc_name: "HC Alpha", total_assets: 500000 }),
      makeSub({ cert: 2, hc_name: "HC Beta", total_assets: 200000 }),
      makeSub({ cert: 3, hc_name: "HC Alpha", total_assets: 300000 }),
    ];

    const groups = groupByHoldingCompany(institutions);
    expect(groups).toHaveLength(2);
    // HC Alpha has higher total assets (800k vs 200k)
    expect(groups[0].hc_name).toBe("HC Alpha");
    expect(groups[0].subsidiaries).toHaveLength(2);
    expect(groups[1].hc_name).toBe("HC Beta");
    expect(groups[1].subsidiaries).toHaveLength(1);
  });

  it("places institutions without HC into (Independent)", () => {
    const institutions: SubsidiaryRecord[] = [
      makeSub({ cert: 1, hc_name: null, total_assets: 50000 }),
      makeSub({ cert: 2, hc_name: "HC Alpha", total_assets: 100000 }),
    ];

    const groups = groupByHoldingCompany(institutions);
    expect(groups).toHaveLength(2);
    // HC Alpha (100k) > Independent (50k)
    expect(groups[0].hc_name).toBe("HC Alpha");
    expect(groups[1].hc_name).toBe("(Independent)");
    expect(groups[1].subsidiaries).toHaveLength(1);
  });

  it("sorts groups by total assets descending", () => {
    const institutions: SubsidiaryRecord[] = [
      makeSub({ cert: 1, hc_name: "Small HC", total_assets: 10000 }),
      makeSub({ cert: 2, hc_name: "Big HC", total_assets: 500000 }),
      makeSub({ cert: 3, hc_name: "Medium HC", total_assets: 100000 }),
    ];

    const groups = groupByHoldingCompany(institutions);
    expect(groups.map((g) => g.hc_name)).toEqual([
      "Big HC",
      "Medium HC",
      "Small HC",
    ]);
  });

  it("handles single institution", () => {
    const groups = groupByHoldingCompany([
      makeSub({ cert: 1, hc_name: "Solo HC" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].hc_name).toBe("Solo HC");
    expect(groups[0].subsidiaries).toHaveLength(1);
  });

  it("handles empty input", () => {
    const groups = groupByHoldingCompany([]);
    expect(groups).toHaveLength(0);
  });
});

describe("aggregateSubsidiaryMetrics", () => {
  it("sums assets, deposits, and collects unique sorted states", () => {
    const subs: SubsidiaryRecord[] = [
      makeSub({ total_assets: 300000, total_deposits: 250000, state: "NY" }),
      makeSub({ total_assets: 200000, total_deposits: 150000, state: "CA" }),
      makeSub({ total_assets: 100000, total_deposits: 80000, state: "NY" }),
    ];

    const agg = aggregateSubsidiaryMetrics(subs);
    expect(agg.total_assets).toBe(600000);
    expect(agg.total_deposits).toBe(480000);
    expect(agg.subsidiary_count).toBe(3);
    expect(agg.states).toEqual(["CA", "NY"]);
  });

  it("computes asset-weighted ROA", () => {
    const subs: SubsidiaryRecord[] = [
      makeSub({ total_assets: 300000, roa: 1.5 }),
      makeSub({ total_assets: 100000, roa: 0.5 }),
    ];

    const agg = aggregateSubsidiaryMetrics(subs);
    // Weighted ROA = (1.5 * 300000 + 0.5 * 100000) / (300000 + 100000)
    // = (450000 + 50000) / 400000 = 500000 / 400000 = 1.25
    expect(agg.weighted_roa).toBeCloseTo(1.25, 4);
  });

  it("computes asset-weighted equity ratio", () => {
    const subs: SubsidiaryRecord[] = [
      makeSub({ total_assets: 200000, equity_ratio: 12.0 }),
      makeSub({ total_assets: 200000, equity_ratio: 8.0 }),
    ];

    const agg = aggregateSubsidiaryMetrics(subs);
    // Equal weights → simple average = 10.0
    expect(agg.weighted_equity_ratio).toBeCloseTo(10.0, 4);
  });

  it("skips null ROA values in weighted average", () => {
    const subs: SubsidiaryRecord[] = [
      makeSub({ total_assets: 300000, roa: 1.5 }),
      makeSub({ total_assets: 100000, roa: null }),
    ];

    const agg = aggregateSubsidiaryMetrics(subs);
    // Only the first sub contributes: 1.5 * 300000 / 300000 = 1.5
    expect(agg.weighted_roa).toBeCloseTo(1.5, 4);
  });

  it("returns null weighted metrics when all values are null", () => {
    const subs: SubsidiaryRecord[] = [
      makeSub({ roa: null, equity_ratio: null }),
      makeSub({ roa: null, equity_ratio: null }),
    ];

    const agg = aggregateSubsidiaryMetrics(subs);
    expect(agg.weighted_roa).toBeNull();
    expect(agg.weighted_equity_ratio).toBeNull();
  });

  it("handles single subsidiary", () => {
    const subs: SubsidiaryRecord[] = [
      makeSub({
        total_assets: 500000,
        total_deposits: 400000,
        roa: 1.2,
        equity_ratio: 9.5,
        state: "TX",
      }),
    ];

    const agg = aggregateSubsidiaryMetrics(subs);
    expect(agg.total_assets).toBe(500000);
    expect(agg.total_deposits).toBe(400000);
    expect(agg.subsidiary_count).toBe(1);
    expect(agg.states).toEqual(["TX"]);
    expect(agg.weighted_roa).toBeCloseTo(1.2, 4);
    expect(agg.weighted_equity_ratio).toBeCloseTo(9.5, 4);
  });
});
