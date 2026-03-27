import { describe, expect, it } from "vitest";
import {
  buildFredUrl,
  parseFredResponse,
  stateFredSeries,
} from "../src/services/fredClient.js";

describe("buildFredUrl", () => {
  it("builds URL with required parameters", () => {
    const url = buildFredUrl("TXUR", {
      start: "2023-01-01",
      end: "2025-01-01",
    });
    expect(url).toContain("series_id=TXUR");
    expect(url).toContain("observation_start=2023-01-01");
    expect(url).toContain("observation_end=2025-01-01");
    expect(url).toContain("file_type=json");
    expect(url).toContain("api.stlouisfed.org/fred/series/observations");
    expect(url).not.toContain("api_key");
  });

  it("includes api_key when provided", () => {
    const url = buildFredUrl("UNRATE", {
      start: "2023-01-01",
      end: "2025-01-01",
      apiKey: "abc123",
    });
    expect(url).toContain("api_key=abc123");
    expect(url).toContain("series_id=UNRATE");
  });
});

describe("parseFredResponse", () => {
  it("parses normal observation data", () => {
    const raw = {
      observations: [
        { date: "2024-01-01", value: "3.7" },
        { date: "2024-02-01", value: "3.9" },
        { date: "2024-03-01", value: "4.1" },
      ],
    };
    const result = parseFredResponse(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ date: "2024-01-01", value: 3.7 });
    expect(result[1]).toEqual({ date: "2024-02-01", value: 3.9 });
    expect(result[2]).toEqual({ date: "2024-03-01", value: 4.1 });
  });

  it("filters out missing values (FRED '.' sentinel)", () => {
    const raw = {
      observations: [
        { date: "2024-01-01", value: "3.7" },
        { date: "2024-02-01", value: "." },
        { date: "2024-03-01", value: "4.1" },
      ],
    };
    const result = parseFredResponse(raw);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2024-01-01");
    expect(result[1].date).toBe("2024-03-01");
  });

  it("returns empty array for empty observations", () => {
    expect(parseFredResponse({ observations: [] })).toEqual([]);
  });

  it("returns empty array for missing observations key", () => {
    expect(parseFredResponse({})).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(parseFredResponse(null)).toEqual([]);
    expect(parseFredResponse("string")).toEqual([]);
    expect(parseFredResponse(42)).toEqual([]);
  });

  it("skips entries with non-string date or value", () => {
    const raw = {
      observations: [
        { date: "2024-01-01", value: "3.7" },
        { date: 123, value: "3.9" },
        { date: "2024-03-01", value: 4.1 },
        { date: "2024-04-01", value: "NaN-text" },
      ],
    };
    const result = parseFredResponse(raw);
    // Only the first entry has valid string date + parseable string value
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: "2024-01-01", value: 3.7 });
  });
});

describe("stateFredSeries", () => {
  it("returns correct series IDs for a state", () => {
    const result = stateFredSeries("TX");
    expect(result).toEqual({
      unemployment: "TXUR",
      gdp: "TXNGSP",
    });
  });

  it("uppercases lowercase input", () => {
    const result = stateFredSeries("ca");
    expect(result).toEqual({
      unemployment: "CAUR",
      gdp: "CANGSP",
    });
  });

  it("handles mixed case input", () => {
    const result = stateFredSeries("Ny");
    expect(result).toEqual({
      unemployment: "NYUR",
      gdp: "NYNGSP",
    });
  });
});
