import { describe, expect, it } from "vitest";
import { analyzeTrendEnhanced } from "../src/tools/shared/trendEngine.js";

describe("analyzeTrendEnhanced", () => {
  it("detects improving trend with consecutive improvement", () => {
    const ts = [
      { repdte: "20240331", value: 3.0 },
      { repdte: "20240630", value: 3.2 },
      { repdte: "20240930", value: 3.5 },
      { repdte: "20241231", value: 3.8 },
    ];
    const result = analyzeTrendEnhanced("nim", ts, true);
    expect(result.direction).toBe("improving");
    expect(result.consecutive_worsening).toBe(0);
    expect(result.prior_quarter_change).toBeCloseTo(0.3, 1);
  });

  it("detects deteriorating trend with consecutive worsening", () => {
    const ts = [
      { repdte: "20240331", value: 1.2 },
      { repdte: "20240630", value: 1.0 },
      { repdte: "20240930", value: 0.8 },
      { repdte: "20241231", value: 0.5 },
    ];
    const result = analyzeTrendEnhanced("roa", ts, true);
    expect(result.direction).toBe("deteriorating");
    expect(result.consecutive_worsening).toBe(3);
  });

  it("computes year-over-year change", () => {
    const ts = [
      { repdte: "20231231", value: 3.5 },
      { repdte: "20240331", value: 3.4 },
      { repdte: "20240630", value: 3.3 },
      { repdte: "20240930", value: 3.2 },
      { repdte: "20241231", value: 3.0 },
    ];
    const result = analyzeTrendEnhanced("nim", ts, true);
    expect(result.yoy_change).toBeCloseTo(-0.5, 1); // 3.0 - 3.5
  });

  it("detects reversal when trend changes direction", () => {
    // First half improving, second half deteriorating
    const ts = [
      { repdte: "20230630", value: 3.0 },
      { repdte: "20230930", value: 3.3 },
      { repdte: "20231231", value: 3.5 },
      { repdte: "20240331", value: 3.4 },
      { repdte: "20240630", value: 3.1 },
      { repdte: "20240930", value: 2.8 },
    ];
    const result = analyzeTrendEnhanced("nim", ts, true);
    expect(result.reversal).toBe(true);
  });

  it("handles insufficient data gracefully", () => {
    const result = analyzeTrendEnhanced("roa", [{ repdte: "20241231", value: 1.0 }], true);
    expect(result.direction).toBe("stable");
    expect(result.magnitude).toBe("minimal");
    expect(result.consecutive_worsening).toBe(0);
    expect(result.data_quality.sufficient_data).toBe(false);
  });

  it("skips null values in timeseries", () => {
    const ts = [
      { repdte: "20240331", value: 3.0 },
      { repdte: "20240630", value: null },
      { repdte: "20240930", value: 3.2 },
      { repdte: "20241231", value: 3.4 },
    ];
    const result = analyzeTrendEnhanced("nim", ts, true);
    expect(result.quarters_analyzed).toBe(3);
    expect(result.direction).toBe("improving");
  });

  it("flags history events in window", () => {
    const ts = [
      { repdte: "20240331", value: 3.0 },
      { repdte: "20240630", value: 4.5 },
      { repdte: "20240930", value: 4.3 },
    ];
    const result = analyzeTrendEnhanced("nim", ts, true, {
      historyEvents: [{ repdte: "20240630", event_type: "merger", description: "Acquired XYZ Bank" }],
    });
    expect(result.data_quality.history_event_in_window).toBe(true);
    expect(result.data_quality.history_event_note).toContain("merger");
  });

  it("detects stale periods (gaps > 1 quarter)", () => {
    const ts = [
      { repdte: "20230630", value: 3.0 },
      // Missing 20230930, 20231231
      { repdte: "20240331", value: 3.2 },
      { repdte: "20240630", value: 3.3 },
    ];
    const result = analyzeTrendEnhanced("nim", ts, true);
    expect(result.data_quality.stale_period).toBe(true);
  });

  it("handles lower-is-better metrics correctly for worsening", () => {
    // For efficiency_ratio, lower is better, so increases are worsening
    const ts = [
      { repdte: "20240331", value: 60.0 },
      { repdte: "20240630", value: 62.0 },
      { repdte: "20240930", value: 65.0 },
      { repdte: "20241231", value: 68.0 },
    ];
    const result = analyzeTrendEnhanced("efficiency_ratio", ts, false);
    expect(result.direction).toBe("deteriorating");
    expect(result.consecutive_worsening).toBe(3);
  });
});
