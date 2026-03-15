import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, createMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("axios", () => {
  class MockAxiosError extends Error {
    response?: { status?: number; data?: { message?: string } };

    constructor(
      message: string,
      response?: { status?: number; data?: { message?: string } },
    ) {
      super(message);
      this.response = response;
    }
  }

  createMock.mockReturnValue({ get: getMock });

  return {
    default: { create: createMock },
    AxiosError: MockAxiosError,
  };
});

import { AxiosError } from "axios";
import {
  buildPaginationInfo,
  clearQueryCache,
  extractRecords,
  formatToolError,
  queryEndpoint,
  truncateIfNeeded,
  validateFdicResponseShape,
} from "../src/services/fdicClient.js";
import packageJson from "../package.json";

const expectedVersion = packageJson.version;

describe("fdicClient", () => {
  beforeEach(() => {
    getMock.mockReset();
    clearQueryCache();
  });

  it("configures the axios client with the expected base settings", () => {
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://banks.data.fdic.gov/api",
        timeout: 30_000,
        headers: expect.objectContaining({
          Accept: "application/json",
          "User-Agent": `fdic-mcp-server/${expectedVersion}`,
        }),
      }),
    );
  });

  it("passes default query parameters through to the FDIC API", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    const response = await queryEndpoint("institutions", {});

    expect(getMock).toHaveBeenCalledWith("/institutions", {
      params: {
        limit: 20,
        offset: 0,
        output: "json",
      },
    });
    expect(response.meta.total).toBe(1);
  });

  it("rejects malformed top-level FDIC response payloads", async () => {
    getMock.mockResolvedValueOnce({
      data: { records: [], meta: { total: 0 } },
    });

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "Unexpected FDIC API response shape for endpoint institutions: expected 'data' to be an array.",
    );
  });

  it("rejects malformed FDIC record wrappers", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [{ CERT: 3511 }], meta: { total: 1 } },
    });

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "Unexpected FDIC API response shape for endpoint institutions: expected data[0] to contain an object 'data' property.",
    );
  });

  it("includes optional query parameters when provided", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0 } },
    });

    await queryEndpoint("financials", {
      filters: "CERT:3511",
      fields: "CERT,REPDTE",
      limit: 5,
      offset: 10,
      sort_by: "REPDTE",
      sort_order: "DESC",
    });

    expect(getMock).toHaveBeenCalledWith("/financials", {
      params: {
        filters: "CERT:3511",
        fields: "CERT,REPDTE",
        limit: 5,
        offset: 10,
        output: "json",
        sort_by: "REPDTE",
        sort_order: "DESC",
      },
    });
  });

  it("reuses cached results for identical queries within the cache window", async () => {
    getMock.mockResolvedValue({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    const first = await queryEndpoint("institutions", { filters: "CERT:3511" });
    const second = await queryEndpoint("institutions", { filters: "CERT:3511" });

    expect(first.meta.total).toBe(1);
    expect(second.meta.total).toBe(1);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("evicts expired cache entries before issuing a fresh request", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    getMock.mockResolvedValue({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    nowSpy.mockReturnValue(1_000);
    await queryEndpoint("institutions", { filters: "CERT:3511" });

    nowSpy.mockReturnValue(62_000);
    await queryEndpoint("institutions", { filters: "CERT:9999" });
    await queryEndpoint("institutions", { filters: "CERT:3511" });

    expect(getMock).toHaveBeenCalledTimes(3);
    nowSpy.mockRestore();
  });

  it("maps 400 responses to a filter syntax error", async () => {
    getMock.mockRejectedValueOnce(
      new AxiosError("bad request", {
        status: 400,
        data: { message: "Invalid query string" },
      }),
    );

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      'Bad request to FDIC API: Invalid query string. Check your filter syntax (use ElasticSearch query string syntax, e.g. STNAME:"California" AND ACTIVE:1).',
    );
  });

  it("maps 429 responses to a rate limit error", async () => {
    getMock.mockRejectedValueOnce(
      new AxiosError("too many requests", { status: 429 }),
    );

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "FDIC API rate limit exceeded. Please wait a moment and try again.",
    );
  });

  it("maps 500 responses to a server error", async () => {
    getMock.mockRejectedValueOnce(
      new AxiosError("internal server error", { status: 500 }),
    );

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "FDIC API server error. The service may be temporarily unavailable. Try again later.",
    );
  });

  it("maps other axios errors to generic HTTP errors", async () => {
    getMock.mockRejectedValueOnce(
      new AxiosError("not found", { status: 404, data: { message: "Missing" } }),
    );

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "FDIC API error (HTTP 404): Missing",
    );
  });

  it("maps non-axios errors to unexpected errors", async () => {
    getMock.mockRejectedValueOnce(new Error("boom"));

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "Unexpected error calling FDIC API: Error: boom",
    );
  });

  it("extracts data records from the FDIC response", () => {
    expect(
      extractRecords({
        data: [{ data: { CERT: 1 } }, { data: { CERT: 2 } }],
        meta: { total: 2 },
      }),
    ).toEqual([{ CERT: 1 }, { CERT: 2 }]);
  });

  it("throws a clear error when extractRecords receives malformed entries", () => {
    expect(() =>
      extractRecords({
        data: [{ CERT: 1 } as unknown as { data: Record<string, unknown> }],
        meta: { total: 1 },
      }),
    ).toThrow(
      "Unexpected FDIC API response shape: expected data[0] to contain an object 'data' property.",
    );
  });

  it("validates a well-formed FDIC response payload", () => {
    expect(
      validateFdicResponseShape("institutions", {
        data: [{ data: { CERT: 1 } }],
        meta: { total: 1 },
      }),
    ).toEqual({
      data: [{ data: { CERT: 1 } }],
      meta: { total: 1 },
    });
  });

  it("builds pagination metadata with next_offset when more results exist", () => {
    expect(buildPaginationInfo(10, 0, 3)).toEqual({
      total: 10,
      offset: 0,
      count: 3,
      has_more: true,
      next_offset: 3,
    });
  });

  it("omits next_offset when the page is complete", () => {
    expect(buildPaginationInfo(3, 0, 3)).toEqual({
      total: 3,
      offset: 0,
      count: 3,
      has_more: false,
    });
  });

  it("truncates oversized text and appends guidance", () => {
    expect(truncateIfNeeded("abcdef", 3)).toContain(
      "[Response truncated at 3 characters.",
    );
  });

  it("formats tool errors with MCP-compatible shape", () => {
    expect(formatToolError(new Error("bad"))).toEqual({
      content: [{ type: "text", text: "Error: bad" }],
      isError: true,
    });
  });
});
