import { describe, expect, it } from "vitest";
import { assessManagementOverlay } from "../src/tools/shared/managementOverlay.js";

describe("assessManagementOverlay", () => {
  it("returns normal when no concerns", () => {
    const result = assessManagementOverlay({
      component_ratings: { C: 1, A: 2, E: 2, L: 1, S: 2 },
      trends: [],
    });
    expect(result.level).toBe("normal");
    expect(result.caps_band).toBe(false);
    expect(result.reason_codes).toHaveLength(0);
  });

  it("returns watch when 2+ components are Fair or worse", () => {
    const result = assessManagementOverlay({
      component_ratings: { C: 2, A: 3, E: 3, L: 2, S: 2 },
      trends: [],
    });
    expect(result.level).toBe("watch");
    expect(result.reason_codes).toContainEqual(expect.stringContaining("component"));
  });

  it("returns watch for rapid growth with weakness", () => {
    const result = assessManagementOverlay({
      component_ratings: { C: 2, A: 3, E: 2, L: 2, S: 2 },
      trends: [],
      asset_growth_pct: 25.0,
    });
    expect(result.level).toBe("watch");
    expect(result.reason_codes).toContainEqual(expect.stringContaining("growth"));
  });

  it("returns elevated_concern for multiple weak components with worsening trends", () => {
    const result = assessManagementOverlay({
      component_ratings: { C: 3, A: 3, E: 4, L: 3, S: 2 },
      trends: [
        { direction: "deteriorating", magnitude: "significant", consecutive_worsening: 3 },
        { direction: "deteriorating", magnitude: "moderate", consecutive_worsening: 2 },
      ],
    });
    expect(result.level).toBe("elevated_concern");
    expect(result.caps_band).toBe(true);
  });

  it("returns elevated_concern for component 4+ with undercapitalized", () => {
    const result = assessManagementOverlay({
      component_ratings: { C: 4, A: 3, E: 3, L: 2, S: 2 },
      trends: [],
      capital_category: "undercapitalized",
    });
    expect(result.level).toBe("elevated_concern");
    expect(result.caps_band).toBe(true);
  });

  it("returns watch for 2+ consecutive worsening trends", () => {
    const result = assessManagementOverlay({
      component_ratings: { C: 2, A: 2, E: 2, L: 2, S: 2 },
      trends: [
        { direction: "deteriorating", magnitude: "moderate", consecutive_worsening: 2 },
        { direction: "deteriorating", magnitude: "moderate", consecutive_worsening: 2 },
      ],
    });
    expect(result.level).toBe("watch");
  });
});
