import { describe, expect, it } from "vitest";
import {
  assessMacroContext,
  type MacroInputs,
} from "../src/tools/shared/regionalContext.js";

function makeObs(values: number[], startDate = "2023-01-01"): { date: string; value: number }[] {
  return values.map((v, i) => ({
    date: `2023-${String(i + 1).padStart(2, "0")}-01`,
    value: v,
  }));
}

describe("assessMacroContext", () => {
  describe("unemployment_trend", () => {
    it("detects rising unemployment (>0.3pp increase)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5, 3.7, 4.0]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.unemployment_trend).toBe("rising");
    });

    it("detects falling unemployment (>0.3pp decrease)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([4.5, 4.2, 4.0]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.unemployment_trend).toBe("falling");
    });

    it("detects stable unemployment (within 0.3pp)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5, 3.6, 3.7]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.unemployment_trend).toBe("stable");
    });

    it("returns stable with only one observation", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.unemployment_trend).toBe("stable");
    });

    it("uses last 3 observations when more are available", () => {
      // First values are decreasing, but last 3 are rising
      const inputs: MacroInputs = {
        state_unemployment: makeObs([5.0, 4.5, 3.5, 3.7, 4.0]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.unemployment_trend).toBe("rising");
    });
  });

  describe("state_vs_national_unemployment", () => {
    it("detects state above national (>0.3pp higher)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([5.1]),
        national_unemployment: makeObs([4.0]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.state_vs_national_unemployment).toBe("above");
    });

    it("detects state below national (>0.3pp lower)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.0]),
        national_unemployment: makeObs([4.0]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.state_vs_national_unemployment).toBe("below");
    });

    it("detects at parity (within 0.3pp)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([4.1]),
        national_unemployment: makeObs([4.0]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.state_vs_national_unemployment).toBe("at_parity");
    });
  });

  describe("rate_environment", () => {
    it("classifies low rate environment (<2%)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([1.5]),
      };
      const result = assessMacroContext(inputs);
      expect(result.rate_environment).toBe("low");
    });

    it("classifies moderate rate environment (2-4%)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([3.0]),
      };
      const result = assessMacroContext(inputs);
      expect(result.rate_environment).toBe("moderate");
    });

    it("classifies elevated rate environment (>4%)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.rate_environment).toBe("elevated");
    });

    it("treats exactly 2% as moderate", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([2.0]),
      };
      const result = assessMacroContext(inputs);
      expect(result.rate_environment).toBe("moderate");
    });

    it("treats exactly 4% as moderate", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5]),
        national_unemployment: makeObs([3.8]),
        fed_funds: makeObs([4.0]),
      };
      const result = assessMacroContext(inputs);
      expect(result.rate_environment).toBe("moderate");
    });
  });

  describe("latest values", () => {
    it("returns latest values from observation arrays", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5, 3.7, 4.0]),
        national_unemployment: makeObs([3.6, 3.8]),
        fed_funds: makeObs([5.0, 5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.latest_state_unemployment).toBe(4.0);
      expect(result.latest_national_unemployment).toBe(3.8);
      expect(result.latest_fed_funds).toBe(5.25);
    });
  });

  describe("narrative", () => {
    it("generates narrative with all data available", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5, 3.7, 5.1]),
        national_unemployment: makeObs([4.0]),
        fed_funds: makeObs([5.25]),
      };
      const result = assessMacroContext(inputs);
      expect(result.narrative).toContain("5.1%");
      expect(result.narrative).toContain("4.0%");
      expect(result.narrative).toContain("5.25%");
      expect(result.narrative).toContain("above");
      expect(result.narrative).toContain("rising");
      expect(result.narrative).toContain("elevated");
    });

    it("generates narrative mentioning data unavailability when all empty", () => {
      const inputs: MacroInputs = {
        state_unemployment: [],
        national_unemployment: [],
        fed_funds: [],
      };
      const result = assessMacroContext(inputs);
      expect(result.narrative).toContain("unavailable");
    });
  });

  describe("empty input handling", () => {
    it("returns sensible defaults with all empty arrays", () => {
      const inputs: MacroInputs = {
        state_unemployment: [],
        national_unemployment: [],
        fed_funds: [],
      };
      const result = assessMacroContext(inputs);
      expect(result.unemployment_trend).toBe("stable");
      expect(result.state_vs_national_unemployment).toBe("at_parity");
      expect(result.rate_environment).toBe("moderate");
      expect(result.latest_state_unemployment).toBeNull();
      expect(result.latest_national_unemployment).toBeNull();
      expect(result.latest_fed_funds).toBeNull();
    });

    it("handles partial data (only state unemployment)", () => {
      const inputs: MacroInputs = {
        state_unemployment: makeObs([3.5, 3.7, 4.0]),
        national_unemployment: [],
        fed_funds: [],
      };
      const result = assessMacroContext(inputs);
      expect(result.latest_state_unemployment).toBe(4.0);
      expect(result.latest_national_unemployment).toBeNull();
      expect(result.latest_fed_funds).toBeNull();
      expect(result.unemployment_trend).toBe("rising");
      expect(result.state_vs_national_unemployment).toBe("at_parity"); // no national data to compare
    });
  });
});
