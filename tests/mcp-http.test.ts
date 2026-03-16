import request from "supertest";
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

import { createApp, parseHttpPort } from "../src/index.js";
import { clearQueryCache } from "../src/services/fdicClient.js";
import packageJson from "../package.json";

const expectedVersion = packageJson.version;

function mcpPost(body: Record<string, unknown>) {
  return request(createApp())
    .post("/mcp")
    .set("content-type", "application/json")
    .set("accept", "application/json, text/event-stream")
    .send(body);
}

describe("HTTP MCP server", () => {
  beforeEach(() => {
    getMock.mockReset();
    clearQueryCache();
  });

  it("serves the health endpoint", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      server: "fdic-mcp-server",
      version: expectedVersion,
    });
  });

  it("parses the default HTTP port when PORT is not set", () => {
    expect(parseHttpPort(undefined)).toBe(3000);
  });

  it("throws a clear error for a non-numeric PORT", () => {
    expect(() => parseHttpPort("abc")).toThrow(
      "Invalid PORT value: abc",
    );
  });

  it("throws a clear error for an out-of-range PORT", () => {
    expect(() => parseHttpPort("70000")).toThrow(
      "PORT must be between 0 and 65535. Received: 70000",
    );
  });

  it("lists all registered tools including demographics", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(response.body.result.tools).toHaveLength(12);
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_search_demographics");
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_compare_bank_snapshots");

    const financialsTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fdic_search_financials",
    );
    expect(financialsTool.inputSchema.properties.sort_order.default).toBe(
      "DESC",
    );
    const analysisTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fdic_compare_bank_snapshots",
    );
    expect(analysisTool.title).toBe("Compare Bank Snapshot Trends");
  });

  it("handles repeated MCP requests without reusing a connected server", async () => {
    getMock
      .mockResolvedValueOnce({
        data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
      })
      .mockResolvedValueOnce({
        data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
      });

    const first = await mcpPost({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "fdic_search_institutions",
        arguments: { filters: "CERT:3511", limit: 1 },
      },
    });

    const second = await mcpPost({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "fdic_search_institutions",
        arguments: { filters: "CERT:3511", limit: 1 },
      },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.result.structuredContent.institutions[0].CERT).toBe(
      3511,
    );
  });

  it("returns structuredContent for search tools", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [{ data: { CERT: 3511, NAME: "Wells Fargo" } }],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "fdic_search_institutions",
        arguments: { filters: "CERT:3511", limit: 1 },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      institutions: [{ CERT: 3511, NAME: "Wells Fargo" }],
    });
    expect(getMock).toHaveBeenCalledWith("/institutions", {
      params: {
        filters: "CERT:3511",
        limit: 1,
        offset: 0,
        output: "json",
        sort_order: "ASC",
      },
    });
  });

  it("returns structured not-found payloads for single-record tools", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0 } },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "fdic_get_institution",
        arguments: { cert: 999999999 },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      found: false,
      cert: 999999999,
      message: "No institution found with CERT number 999999999.",
    });
  });

  it("builds combined filters for location lookups with cert and user filters", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0 } },
    });

    await mcpPost({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "fdic_search_locations",
        arguments: { cert: 3511, filters: 'CITY:"Austin"' },
      },
    });

    expect(getMock).toHaveBeenLastCalledWith("/locations", {
      params: {
        filters: 'CERT:3511 AND (CITY:"Austin")',
        limit: 20,
        offset: 0,
        output: "json",
        sort_order: "ASC",
      },
    });
  });

  it("applies the financials DESC sort default and composes financial filters", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [{ data: { CERT: 3511, REPDTE: "20251231" } }],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "fdic_search_financials",
        arguments: {
          cert: 3511,
          repdte: "20251231",
          fields: "CERT,REPDTE",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(getMock).toHaveBeenLastCalledWith("/financials", {
      params: {
        fields: "CERT,REPDTE",
        filters: "CERT:3511 AND REPDTE:20251231",
        limit: 20,
        offset: 0,
        output: "json",
        sort_order: "DESC",
      },
    });
    expect(response.body.result.structuredContent.financials[0].REPDTE).toBe(
      "20251231",
    );
  });

  it("returns failure search results with structured content", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 10001,
              NAME: "Example Failed Bank",
              CITY: "Los Angeles",
              STALP: "CA",
              FAILDATE: "2024-07-12",
              COST: 456789,
              RESTYPE: "MERGER",
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 61,
      method: "tools/call",
      params: {
        name: "fdic_search_failures",
        arguments: {
          filters: "STALP:CA",
          sort_by: "FAILDATE",
          limit: 1,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      failures: [
        {
          CERT: 10001,
          NAME: "Example Failed Bank",
          CITY: "Los Angeles",
          STALP: "CA",
          FAILDATE: "2024-07-12",
          COST: 456789,
          RESTYPE: "MERGER",
        },
      ],
    });
    expect(getMock).toHaveBeenLastCalledWith("/failures", {
      params: {
        filters: "STALP:CA",
        limit: 1,
        offset: 0,
        output: "json",
        sort_by: "FAILDATE",
        sort_order: "ASC",
      },
    });
  });

  it("returns failure lookup details for a certificate number", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 10001,
              NAME: "Example Failed Bank",
              FAILDATE: "2024-07-12",
              RESTYPE: "MERGER",
              COST: 456789,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 62,
      method: "tools/call",
      params: {
        name: "fdic_get_institution_failure",
        arguments: {
          cert: 10001,
          fields: "CERT,NAME,FAILDATE,RESTYPE,COST",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      CERT: 10001,
      NAME: "Example Failed Bank",
      FAILDATE: "2024-07-12",
      RESTYPE: "MERGER",
      COST: 456789,
    });
    expect(getMock).toHaveBeenLastCalledWith(
      "/failures",
      expect.objectContaining({
        params: {
          fields: "CERT,NAME,FAILDATE,RESTYPE,COST",
          filters: "CERT:10001",
          limit: 1,
          offset: 0,
          output: "json",
        },
      }),
    );
  });

  it("composes cert filters for history searches", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              INSTNAME: "Wells Fargo Bank, National Association",
              TYPE: "merger",
              PROCDATE: "2022-05-01",
              PCITY: "Sioux Falls",
              PSTALP: "SD",
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 63,
      method: "tools/call",
      params: {
        name: "fdic_search_history",
        arguments: {
          cert: 3511,
          filters: "TYPE:merger",
          sort_by: "PROCDATE",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      events: [
        {
          CERT: 3511,
          INSTNAME: "Wells Fargo Bank, National Association",
          TYPE: "merger",
          PROCDATE: "2022-05-01",
          PCITY: "Sioux Falls",
          PSTALP: "SD",
        },
      ],
    });
    expect(getMock).toHaveBeenLastCalledWith("/history", {
      params: {
        filters: "CERT:3511 AND (TYPE:merger)",
        limit: 20,
        offset: 0,
        output: "json",
        sort_by: "PROCDATE",
        sort_order: "ASC",
      },
    });
  });

  it("composes SOD filters from cert, year, and caller filters", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              YEAR: 2022,
              UNINAME: "Wells Fargo Bank, National Association",
              NAMEFULL: "Downtown Branch",
              CITYBR: "Austin",
              DEPSUMBR: 250000,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 64,
      method: "tools/call",
      params: {
        name: "fdic_search_sod",
        arguments: {
          cert: 3511,
          year: 2022,
          filters: 'CITYBR:"Austin"',
          sort_by: "DEPSUMBR",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      deposits: [
        {
          CERT: 3511,
          YEAR: 2022,
          UNINAME: "Wells Fargo Bank, National Association",
          NAMEFULL: "Downtown Branch",
          CITYBR: "Austin",
          DEPSUMBR: 250000,
        },
      ],
    });
    expect(getMock).toHaveBeenLastCalledWith("/sod", {
      params: {
        filters: '(CITYBR:"Austin") AND CERT:3511 AND YEAR:2022',
        limit: 20,
        offset: 0,
        output: "json",
        sort_by: "DEPSUMBR",
        sort_order: "ASC",
      },
    });
  });

  it("composes annual summary filters and returns summary records", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              YEAR: 2023,
              ASSET: 1000000,
              DEP: 800000,
              NETINC: 12000,
              ROA: 1.2,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 65,
      method: "tools/call",
      params: {
        name: "fdic_search_summary",
        arguments: {
          cert: 3511,
          year: 2023,
          filters: "ASSET:[500000 TO *]",
          sort_by: "YEAR",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      summary: [
        {
          CERT: 3511,
          YEAR: 2023,
          ASSET: 1000000,
          DEP: 800000,
          NETINC: 12000,
          ROA: 1.2,
        },
      ],
    });
    expect(getMock).toHaveBeenLastCalledWith("/summary", {
      params: {
        filters: "(ASSET:[500000 TO *]) AND CERT:3511 AND YEAR:2023",
        limit: 20,
        offset: 0,
        output: "json",
        sort_by: "YEAR",
        sort_order: "ASC",
      },
    });
  });

  it("returns MCP error payloads when the FDIC client throws", async () => {
    getMock.mockRejectedValueOnce(new Error("backend unavailable"));

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "fdic_search_demographics",
        arguments: { cert: 3511 },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toBe(
      "Error: Unexpected error calling FDIC API: Error: backend unavailable",
    );
  });

  it("batches snapshot comparisons into financial and demographic date queries", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, NAME: "Bank A", CITY: "Charlotte", STALP: "NC" } },
            { data: { CERT: 9846, NAME: "Bank B", CITY: "Raleigh", STALP: "NC" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, NAME: "Bank A", ASSET: 100, DEP: 50, NETINC: 10, ROA: 1, ROE: 8 } },
            { data: { CERT: 9846, NAME: "Bank B", ASSET: 200, DEP: 100, NETINC: 20, ROA: 2, ROE: 9 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, NAME: "Bank A", ASSET: 150, DEP: 90, NETINC: 12, ROA: 1.2, ROE: 8.5 } },
            { data: { CERT: 9846, NAME: "Bank B", ASSET: 260, DEP: 140, NETINC: 30, ROA: 2.5, ROE: 10 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, OFFTOT: 5, CBSANAME: "Charlotte" } },
            { data: { CERT: 9846, OFFTOT: 7, CBSANAME: "Raleigh" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, OFFTOT: 4, CBSANAME: "Charlotte" } },
            { data: { CERT: 9846, OFFTOT: 8, CBSANAME: "Raleigh" } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          limit: 2,
          sort_by: "asset_growth",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.analyzed_count).toBe(2);
    expect(response.body.result.structuredContent.comparisons[0]).toMatchObject({
      cert: 9846,
      asset_growth: 60,
      dep_growth: 40,
      offices_change: 1,
    });
    expect(response.body.result.content[0].text).toContain(
      "Compared 2 institutions from 20211231 to 20250630",
    );
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      "/institutions",
      expect.objectContaining({
        params: {
          fields: "CERT,NAME,CITY,STALP,ACTIVE",
          filters: 'STNAME:"North Carolina" AND ACTIVE:1',
          limit: 10000,
          offset: 0,
          output: "json",
          sort_by: "CERT",
          sort_order: "ASC",
        },
      }),
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/financials",
      expect.objectContaining({
        params: {
          fields: "CERT,NAME,REPDTE,ASSET,DEP,NETINC,ROA,ROE",
          filters: "(CERT:3510 OR CERT:9846) AND REPDTE:20211231",
          limit: 10000,
          offset: 0,
          output: "json",
          sort_by: "CERT",
          sort_order: "ASC",
        },
      }),
    );
  });

  it("returns time-series analysis with derived metrics and insights", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 3510, NAME: "Bank A", CITY: "Charlotte", STALP: "NC" } }],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, NAME: "Bank A", REPDTE: "20211231", ASSET: 100, DEP: 50, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
            { data: { CERT: 3510, NAME: "Bank A", REPDTE: "20220331", ASSET: 120, DEP: 60, NETINC: 11, ROA: 1.1, ROE: 8.2 } },
            { data: { CERT: 3510, NAME: "Bank A", REPDTE: "20250630", ASSET: 180, DEP: 100, NETINC: 16, ROA: 1.4, ROE: 9.5 } },
          ],
          meta: { total: 3 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 3510, REPDTE: "20211231", OFFTOT: 5, CBSANAME: "Charlotte" } },
            { data: { CERT: 3510, REPDTE: "20220331", OFFTOT: 5, CBSANAME: "Charlotte" } },
            { data: { CERT: 3510, REPDTE: "20250630", OFFTOT: 6, CBSANAME: "Charlotte" } },
          ],
          meta: { total: 3 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          analysis_mode: "timeseries",
          limit: 1,
          sort_by: "asset_growth_pct",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.analysis_mode).toBe(
      "timeseries",
    );
    expect(response.body.result.structuredContent.comparisons[0]).toMatchObject({
      cert: 3510,
      asset_growth: 80,
      asset_growth_streak: 2,
    });
    expect(
      response.body.result.structuredContent.comparisons[0]
        .deposits_per_office_change,
    ).toBeCloseTo(6.666666666666668);
    expect(
      response.body.result.structuredContent.comparisons[0]
        .deposits_to_assets_change,
    ).toBeCloseTo(0.05555555555555558);
    expect(
      response.body.result.structuredContent.comparisons[0].insights,
    ).toContain("growth_with_branch_expansion");
    expect(response.body.result.content[0].text).toContain(
      "using timeseries analysis",
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/financials",
      expect.objectContaining({
        params: {
          fields: "CERT,NAME,REPDTE,ASSET,DEP,NETINC,ROA,ROE",
          filters: "(CERT:3510) AND REPDTE:[20211231 TO 20250630]",
          limit: 10000,
          offset: 0,
          output: "json",
          sort_by: "REPDTE",
          sort_order: "ASC",
        },
      }),
    );
  });

  it("fails analysis requests that exceed the overall timeout budget", async () => {
    const setTimeoutSpy = vi
      .spyOn(global, "setTimeout")
      .mockImplementation(((callback: TimerHandler) => {
        queueMicrotask(() => {
          if (typeof callback === "function") {
            callback();
          }
        });
        return 0 as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    getMock.mockImplementation(
      (_url: string, config?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          config?.signal?.addEventListener("abort", () => {
            reject(new Error("canceled"));
          });
        }),
    );

    const responsePromise = mcpPost({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
        },
      },
    });

    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain(
      "Analysis timed out after 90 seconds.",
    );
    setTimeoutSpy.mockRestore();
  });

  it("orders top-level insight summaries by the ranked comparisons", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Bank Slow", CITY: "Raleigh", STALP: "NC" } },
            { data: { CERT: 2222, NAME: "Bank Fast", CITY: "Durham", STALP: "NC" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Bank Slow", REPDTE: "20211231", ASSET: 100, DEP: 100, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
            { data: { CERT: 2222, NAME: "Bank Fast", REPDTE: "20211231", ASSET: 100, DEP: 100, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Bank Slow", REPDTE: "20250630", ASSET: 130, DEP: 120, NETINC: 12, ROA: 1.1, ROE: 8.5 } },
            { data: { CERT: 2222, NAME: "Bank Fast", REPDTE: "20250630", ASSET: 180, DEP: 160, NETINC: 15, ROA: 1.3, ROE: 9.0 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, REPDTE: "20211231", OFFTOT: 4, CBSANAME: "Raleigh" } },
            { data: { CERT: 2222, REPDTE: "20211231", OFFTOT: 4, CBSANAME: "Durham" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, REPDTE: "20250630", OFFTOT: 5, CBSANAME: "Raleigh" } },
            { data: { CERT: 2222, REPDTE: "20250630", OFFTOT: 6, CBSANAME: "Durham" } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          limit: 2,
          sort_by: "asset_growth",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(
      response.body.result.structuredContent.insights.growth_with_branch_expansion,
    ).toEqual(["Bank Fast", "Bank Slow"]);
  });

  it("includes all generated insight categories in the top-level summary", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          { data: { CERT: 1111, NAME: "Trend Bank", REPDTE: "20210331", ASSET: 100, DEP: 90, NETINC: 10, ROA: 1.4, ROE: 9.0 } },
          { data: { CERT: 1111, NAME: "Trend Bank", REPDTE: "20210630", ASSET: 110, DEP: 85, NETINC: 9, ROA: 1.2, ROE: 8.8 } },
          { data: { CERT: 1111, NAME: "Trend Bank", REPDTE: "20210930", ASSET: 120, DEP: 80, NETINC: 8, ROA: 1.0, ROE: 8.5 } },
          { data: { CERT: 1111, NAME: "Trend Bank", REPDTE: "20211231", ASSET: 130, DEP: 75, NETINC: 7, ROA: 0.8, ROE: 8.2 } },
          { data: { CERT: 2222, NAME: "Funding Bank", REPDTE: "20210331", ASSET: 200, DEP: 190, NETINC: 12, ROA: 0.9, ROE: 7.5 } },
          { data: { CERT: 2222, NAME: "Funding Bank", REPDTE: "20210630", ASSET: 205, DEP: 170, NETINC: 11, ROA: 0.9, ROE: 7.4 } },
          { data: { CERT: 2222, NAME: "Funding Bank", REPDTE: "20210930", ASSET: 210, DEP: 160, NETINC: 10, ROA: 0.8, ROE: 7.2 } },
          { data: { CERT: 2222, NAME: "Funding Bank", REPDTE: "20211231", ASSET: 220, DEP: 150, NETINC: 9, ROA: 0.8, ROE: 7.0 } },
        ],
        meta: { total: 8 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          certs: [1111, 2222],
          start_repdte: "20210331",
          end_repdte: "20211231",
          analysis_mode: "timeseries",
          include_demographics: false,
          limit: 2,
          sort_by: "asset_growth",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.insights).toMatchObject({
      deposit_mix_softening: ["Trend Bank", "Funding Bank"],
      sustained_asset_growth: ["Trend Bank", "Funding Bank"],
      multi_quarter_roa_decline: ["Trend Bank"],
    });
  });

  it("warns when the analysis roster is truncated by the FDIC API limit", async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === "/institutions") {
        return {
          data: {
            data: Array.from({ length: 10_000 }, (_, index) => ({
              data: { CERT: index + 1, NAME: `Bank ${index + 1}` },
            })),
            meta: { total: 10_500 },
          },
        };
      }

      return {
        data: {
          data: [],
          meta: { total: 0 },
        },
      };
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          limit: 1,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.warnings).toEqual([
      "Institution roster truncated to 10,000 records out of 10,500 matched institutions. Narrow the comparison set with institution_filters or certs for complete analysis.",
    ]);
    expect(response.body.result.content[0].text).toContain(
      "Warning: Institution roster truncated to 10,000 records out of 10,500 matched institutions.",
    );
  });

  it("includes fdic_peer_group_analysis in the tool list", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 100,
      method: "tools/list",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_peer_group_analysis");
  });

  it("performs subject-driven peer group analysis", async () => {
    getMock
      // Phase 1: institutions lookup
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, NAME: "Subject Bank", CITY: "Wilmington", STALP: "NC", BKCLASS: "NM" } }],
          meta: { total: 1 },
        },
      })
      // Phase 1: subject financials
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, ASSET: 1000, DEP: 800, NETINC: 20, ROA: 1.5, ROE: 12.0, NETNIM: 3.5, EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25 } }],
          meta: { total: 1 },
        },
      })
      // Phase 2: peer roster
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 100, NAME: "Subject Bank", CITY: "Wilmington", STALP: "NC", BKCLASS: "NM" } },
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "NM" } },
            { data: { CERT: 300, NAME: "Peer B", CITY: "Charlotte", STALP: "NC", BKCLASS: "NM" } },
          ],
          meta: { total: 3 },
        },
      })
      // Phase 3: peer financials
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, ASSET: 900, DEP: 700, NETINC: 15, ROA: 1.2, ROE: 10.0, NETNIM: 3.0, EQTOT: 90, LNLSNET: 500, INTINC: 40, EINTEXP: 12, NONII: 8, NONIX: 22 } },
            { data: { CERT: 300, ASSET: 1100, DEP: 850, NETINC: 25, ROA: 1.8, ROE: 14.0, NETNIM: 4.0, EQTOT: 120, LNLSNET: 700, INTINC: 60, EINTEXP: 18, NONII: 12, NONIX: 28 } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: { cert: 100, repdte: "20241231" },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.peer_count).toBe(2);
    expect(sc.returned_count).toBe(2);
    expect(sc.subject.cert).toBe(100);
    expect(sc.subject.rankings.roa).toMatchObject({ of: 3 });
    // Subject ROA 1.5 vs peers [1.2, 1.8] → sorted desc: 1.8, 1.5, 1.2 → subject rank 2
    expect(sc.subject.rankings.roa.rank).toBe(2);
    expect(sc.peers).toHaveLength(2);
    // Peer B (CERT 300, ASSET 1100) should be first (highest asset)
    expect(sc.peers[0].cert).toBe(300);
    expect(sc.metric_definitions.roa.higher_is_better).toBe(true);
    expect(sc.metric_definitions.efficiency_ratio.higher_is_better).toBe(false);
    expect(sc.warnings).toEqual([]);
    expect(sc.message).toBeNull();
    expect(response.body.result.content[0].text).toContain("Subject Bank");
    expect(response.body.result.content[0].text).toContain("December 31, 2024");
  });

  it("performs explicit-criteria peer group analysis without subject", async () => {
    getMock
      // Phase 2: peer roster (no Phase 1 since no cert)
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "N" } },
            { data: { CERT: 300, NAME: "Peer B", CITY: "Charlotte", STALP: "NC", BKCLASS: "N" } },
          ],
          meta: { total: 2 },
        },
      })
      // Phase 3: peer financials
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, ASSET: 5000000, DEP: 4000000, NETINC: 100000, ROA: 1.0, ROE: 9.0, NETNIM: 3.0, EQTOT: 500000, LNLSNET: 3000000, INTINC: 200000, EINTEXP: 80000, NONII: 30000, NONIX: 100000 } },
            { data: { CERT: 300, ASSET: 8000000, DEP: 6000000, NETINC: 200000, ROA: 1.5, ROE: 11.0, NETNIM: 3.5, EQTOT: 900000, LNLSNET: 4500000, INTINC: 350000, EINTEXP: 120000, NONII: 50000, NONIX: 150000 } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
          asset_min: 5000000,
          asset_max: 20000000,
          charter_classes: ["N"],
          state: "NC",
        },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.subject).toBeUndefined();
    expect(sc.peer_count).toBe(2);
    expect(sc.peer_group.criteria_used.state).toBe("NC");
    expect(sc.peer_group.medians.roa).toBe(1.25);
    expect(response.body.result.content[0].text).toContain("Peer group medians");
  });

  it("returns empty result when no peers match", async () => {
    getMock
      // Phase 1: institutions
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, NAME: "Lonely Bank", CITY: "Nowhere", STALP: "NC", BKCLASS: "NM" } }],
          meta: { total: 1 },
        },
      })
      // Phase 1: financials
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, ASSET: 1000, DEP: 800, ROA: 1.0, ROE: 8.0, NETNIM: 3.0, EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25 } }],
          meta: { total: 1 },
        },
      })
      // Phase 2: roster returns only the subject
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, NAME: "Lonely Bank", CITY: "Nowhere", STALP: "NC", BKCLASS: "NM" } }],
          meta: { total: 1 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: { cert: 100, repdte: "20241231" },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.peer_count).toBe(0);
    expect(sc.message).toBe("No peers matched the specified criteria.");
    expect(sc.peers).toEqual([]);
    expect(sc.subject.rankings).toBeNull();
  });
});
