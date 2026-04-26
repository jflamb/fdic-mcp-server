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
  capStructuredContent,
  clearQueryCache,
  extractRecords,
  formatToolError,
  getQueryCacheSize,
  queryEndpoint,
  resolveFdicMaxResponseBytes,
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

  it("uses the default FDIC response-size limit when no env override is set", () => {
    expect(resolveFdicMaxResponseBytes(undefined)).toBe(5 * 1024 * 1024);
  });

  it("rejects invalid FDIC_MAX_RESPONSE_BYTES values", () => {
    expect(() => resolveFdicMaxResponseBytes("0")).toThrow(
      "Invalid FDIC_MAX_RESPONSE_BYTES value: 0. Expected a positive integer.",
    );
  });

  it("passes default query parameters through to the FDIC API", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    const response = await queryEndpoint("institutions", {});

    expect(getMock).toHaveBeenCalledWith(
      "/institutions",
      expect.objectContaining({
        params: {
          limit: 20,
          offset: 0,
          output: "json",
        },
      }),
    );
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

    expect(getMock).toHaveBeenCalledWith(
      "/financials",
      expect.objectContaining({
        params: {
          filters: "CERT:3511",
          fields: "CERT,REPDTE",
          limit: 5,
          offset: 10,
          output: "json",
          sort_by: "REPDTE",
          sort_order: "DESC",
        },
      }),
    );
  });

  it("rejects invalid fields locally before calling the FDIC API", async () => {
    await expect(
      queryEndpoint("institutions", {
        fields: "CERT,FAILDATE",
      }),
    ).rejects.toThrow(
      "Invalid field 'FAILDATE' for endpoint institutions. Use the endpoint-specific field catalog for institutions.",
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it("rejects invalid sort_by values locally before calling the FDIC API", async () => {
    await expect(
      queryEndpoint("financials", {
        sort_by: "FAILDATE",
      }),
    ).rejects.toThrow(
      "Invalid sort_by field 'FAILDATE' for endpoint financials. Use a sortable field defined for financials.",
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it("allows a field on the endpoint where it is defined and rejects it elsewhere", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0 } },
    });

    await queryEndpoint("failures", {
      fields: "CERT,FAILDATE",
      sort_by: "FAILDATE",
    });

    expect(getMock).toHaveBeenCalledTimes(1);

    await expect(
      queryEndpoint("institutions", {
        fields: "CERT,FAILDATE",
      }),
    ).rejects.toThrow(
      "Invalid field 'FAILDATE' for endpoint institutions. Use the endpoint-specific field catalog for institutions.",
    );
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

  it("prunes expired cache entries without relying on insertion order", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    getMock.mockResolvedValue({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    nowSpy.mockReturnValue(1_000);
    await queryEndpoint("institutions", { filters: "CERT:1" });

    nowSpy.mockReturnValue(1_500);
    await queryEndpoint("institutions", { filters: "CERT:2" });

    nowSpy.mockReturnValue(61_250);
    await queryEndpoint("institutions", { filters: "CERT:1" });

    nowSpy.mockReturnValue(62_000);
    await queryEndpoint("institutions", { filters: "CERT:3" });

    expect(getQueryCacheSize()).toBe(2);
    nowSpy.mockRestore();
  });

  it("evicts the oldest live cache entry when the cache exceeds its size cap", async () => {
    getMock.mockResolvedValue({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    for (let cert = 1; cert <= 501; cert += 1) {
      await queryEndpoint("institutions", { filters: `CERT:${cert}` });
    }

    expect(getQueryCacheSize()).toBe(500);
    await queryEndpoint("institutions", { filters: "CERT:1" });

    expect(getMock).toHaveBeenCalledTimes(502);
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

  it("maps oversized upstream responses to a clear narrowing error", async () => {
    getMock.mockRejectedValueOnce(
      new AxiosError("maxContentLength size of 5242880 exceeded"),
    );

    await expect(queryEndpoint("institutions", {})).rejects.toThrow(
      "FDIC API response exceeded the configured response-size limit before parsing. Narrow your filters, request fewer fields, or lower the result size and try again.",
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

  it("extracts records from a validated FDIC response", () => {
    const response = validateFdicResponseShape("institutions", {
      data: [{ data: { CERT: 1 } }, { data: { CERT: 2 } }],
      meta: { total: 2 },
    });

    expect(extractRecords(response)).toEqual([{ CERT: 1 }, { CERT: 2 }]);
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
    expect(truncateIfNeeded("abcdef", 3)).toContain(
      "Request fewer fields, narrow your filters, or paginate with limit/offset.",
    );
  });

  it("allows context-specific truncation guidance", () => {
    expect(
      truncateIfNeeded("abcdef", 3, "Shorten the date range or reduce the cert list."),
    ).toContain("Shorten the date range or reduce the cert list.");
  });

  it("formats tool errors with MCP-compatible shape and structured error code", () => {
    const result = formatToolError(new Error("bad"));
    expect(result.content).toEqual([{ type: "text", text: "Error: bad" }]);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "FDIC_UNKNOWN",
      message: "bad",
      retryable: false,
    });
  });

  it("returns the original payload when capStructuredContent is under the limit", () => {
    const payload = {
      total: 3,
      offset: 0,
      count: 3,
      has_more: false,
      institutions: [{ CERT: 1 }, { CERT: 2 }, { CERT: 3 }],
    };
    expect(capStructuredContent(payload, "institutions", 10_000)).toBe(payload);
  });

  it("re-derives pagination metadata when capStructuredContent truncates a page", () => {
    // Pad each record so the byte cap forces a partial page.
    const records = Array.from({ length: 20 }, (_, idx) => ({
      CERT: idx,
      NAME: "X".repeat(200),
    }));
    const payload = {
      total: 100,
      offset: 0,
      count: 20,
      has_more: true,
      next_offset: 20,
      institutions: records,
    };

    const capped = capStructuredContent(payload, "institutions", 1_500) as {
      total: number;
      offset: number;
      count: number;
      has_more: boolean;
      next_offset: number;
      truncated: boolean;
      upstream: { count: number; next_offset: number };
      institutions: Array<{ CERT: number }>;
    };

    expect(capped.truncated).toBe(true);
    expect(capped.has_more).toBe(true);
    expect(capped.institutions.length).toBeLessThan(records.length);
    // count and next_offset must reflect what was actually returned, not the
    // FDIC page size — otherwise a client following next_offset would skip
    // the records the byte cap dropped.
    expect(capped.count).toBe(capped.institutions.length);
    expect(capped.next_offset).toBe(capped.offset + capped.institutions.length);
    // Original upstream pagination is preserved for transparency.
    expect(capped.upstream).toEqual({ count: 20, next_offset: 20 });
  });

  it("throws FDIC_RESPONSE_TOO_LARGE when capStructuredContent cannot fit a single record", () => {
    const oversize = "X".repeat(2_000);
    const payload = {
      total: 5,
      offset: 0,
      count: 5,
      has_more: false,
      institutions: [{ CERT: 1, NAME: oversize }],
    };

    expect(() => capStructuredContent(payload, "institutions", 500)).toThrow(
      /response-size limit/,
    );

    const error = (() => {
      try {
        capStructuredContent(payload, "institutions", 500);
        return null;
      } catch (err) {
        return err as Error;
      }
    })();

    expect(error).not.toBeNull();
    expect(formatToolError(error!).structuredContent).toMatchObject({
      code: "FDIC_RESPONSE_TOO_LARGE",
      retryable: false,
    });
  });

  it("infers stable error codes from upstream messages", () => {
    expect(
      formatToolError(new Error("FDIC API rate limit exceeded.")).structuredContent,
    ).toMatchObject({ code: "FDIC_RATE_LIMIT", retryable: true });
    expect(
      formatToolError(new Error("Bad request to FDIC API: bad query"))
        .structuredContent,
    ).toMatchObject({ code: "FDIC_BAD_FILTER", retryable: false });
    expect(
      formatToolError(new Error("No institution found with CERT 99")).structuredContent,
    ).toMatchObject({ code: "FDIC_NOT_FOUND", retryable: false });
  });
});
