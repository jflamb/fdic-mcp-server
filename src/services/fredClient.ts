import axios from "axios";
import { VERSION } from "../constants.js";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

export interface FredObservation {
  date: string; // YYYY-MM-DD
  value: number;
}

/**
 * Builds the full URL for a FRED series observations request.
 */
export function buildFredUrl(
  seriesId: string,
  opts: { start: string; end: string; apiKey?: string },
): string {
  const params = new URLSearchParams({
    series_id: seriesId,
    observation_start: opts.start,
    observation_end: opts.end,
    file_type: "json",
  });
  if (opts.apiKey) {
    params.set("api_key", opts.apiKey);
  }
  return `${FRED_BASE_URL}/series/observations?${params.toString()}`;
}

/**
 * Parses a raw FRED API response into typed observations.
 * Filters out entries where the value is "." (FRED's missing-data sentinel).
 */
export function parseFredResponse(raw: unknown): FredObservation[] {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("observations" in raw) ||
    !Array.isArray((raw as { observations?: unknown }).observations)
  ) {
    return [];
  }

  const observations = (raw as { observations: unknown[] }).observations;
  const results: FredObservation[] = [];

  for (const obs of observations) {
    if (typeof obs !== "object" || obs === null) continue;
    const entry = obs as Record<string, unknown>;
    const date = entry.date;
    const rawValue = entry.value;
    if (typeof date !== "string" || typeof rawValue !== "string") continue;
    if (rawValue === ".") continue; // FRED missing-data sentinel
    const numValue = Number.parseFloat(rawValue);
    if (Number.isNaN(numValue)) continue;
    results.push({ date, value: numValue });
  }

  return results;
}

/**
 * Fetches a FRED time series for the given date range.
 * Uses FRED_API_KEY from environment if available.
 */
export async function fetchFredSeries(
  seriesId: string,
  start: string,
  end: string,
): Promise<FredObservation[]> {
  const apiKey = process.env.FRED_API_KEY;
  const url = buildFredUrl(seriesId, { start, end, apiKey });

  const response = await axios.get(url, {
    timeout: 15_000,
    headers: {
      Accept: "application/json",
      "User-Agent": `fdic-mcp-server/${VERSION}`,
    },
  });

  return parseFredResponse(response.data);
}

/**
 * Returns the FRED series IDs for state-level unemployment and GDP.
 * State abbreviation should be uppercase two-letter (e.g., "TX").
 */
export function stateFredSeries(state: string): {
  unemployment: string;
  gdp: string;
} {
  const s = state.toUpperCase();
  return {
    unemployment: `${s}UR`,
    gdp: `${s}NGSP`,
  };
}
