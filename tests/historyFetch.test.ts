import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchHistoryEvents } from "../src/tools/shared/historyFetch.js";

// Mock the fdicClient module
vi.mock("../src/services/fdicClient.js", () => ({
  queryEndpoint: vi.fn(),
  extractRecords: vi.fn(),
}));

import { queryEndpoint, extractRecords } from "../src/services/fdicClient.js";
const mockQueryEndpoint = vi.mocked(queryEndpoint);
const mockExtractRecords = vi.mocked(extractRecords);

describe("fetchHistoryEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped history events for a cert", async () => {
    mockQueryEndpoint.mockResolvedValue({ data: [], meta: { total: 2, parameters: {} } });
    mockExtractRecords.mockReturnValue([
      { CERT: 3511, PROCDATE: "2024-06-15", TYPE: "merger", CHANGECODE: "MA", CHANGECODE_DESC: "Merger/Acquisition" },
      { CERT: 3511, PROCDATE: "2023-01-10", TYPE: "insurance", CHANGECODE: "CO", CHANGECODE_DESC: "Name Change" },
    ]);

    const events = await fetchHistoryEvents(3511);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      repdte: "20240615",
      event_type: "merger",
      description: "Merger/Acquisition",
    });
    expect(events[1]).toEqual({
      repdte: "20230110",
      event_type: "insurance",
      description: "Name Change",
    });

    // Verify the query used the correct endpoint and cert filter
    expect(mockQueryEndpoint).toHaveBeenCalledOnce();
    const callArgs = mockQueryEndpoint.mock.calls[0];
    expect(callArgs[1]?.filters).toContain("CERT:3511");
  });

  it("returns empty array on API error", async () => {
    mockQueryEndpoint.mockRejectedValue(new Error("Network error"));

    const events = await fetchHistoryEvents(9999);
    expect(events).toEqual([]);
  });

  it("returns empty array when no history exists", async () => {
    mockQueryEndpoint.mockResolvedValue({ data: [], meta: { total: 0, parameters: {} } });
    mockExtractRecords.mockReturnValue([]);

    const events = await fetchHistoryEvents(3511);
    expect(events).toEqual([]);
  });

  it("anchors lookback to repdte, not current date", async () => {
    mockQueryEndpoint.mockResolvedValue({ data: [], meta: { total: 0, parameters: {} } });
    mockExtractRecords.mockReturnValue([]);

    await fetchHistoryEvents(3511, { repdte: "20221231" });

    const callArgs = mockQueryEndpoint.mock.calls[0];
    const filters = callArgs[1]?.filters as string;
    expect(filters).toContain("CERT:3511");
    const dateMatch = filters.match(/PROCDATE:\[(\d{4}-\d{2}-\d{2})/);
    expect(dateMatch).not.toBeNull();
    const cutoffYear = Number.parseInt(dateMatch![1].slice(0, 4), 10);
    expect(cutoffYear).toBeLessThanOrEqual(2020);
    expect(cutoffYear).toBeGreaterThanOrEqual(2019);
  });

  it("defaults to current date when repdte not provided", async () => {
    mockQueryEndpoint.mockResolvedValue({ data: [], meta: { total: 0, parameters: {} } });
    mockExtractRecords.mockReturnValue([]);

    await fetchHistoryEvents(3511);

    const callArgs = mockQueryEndpoint.mock.calls[0];
    const filters = callArgs[1]?.filters as string;
    const dateMatch = filters.match(/PROCDATE:\[(\d{4}-\d{2}-\d{2})/);
    expect(dateMatch).not.toBeNull();
    const cutoffYear = Number.parseInt(dateMatch![1].slice(0, 4), 10);
    const currentYear = new Date().getFullYear();
    expect(cutoffYear).toBeGreaterThanOrEqual(currentYear - 4);
  });
});
