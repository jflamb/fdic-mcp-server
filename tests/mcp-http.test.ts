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

import { createApp } from "../src/index.js";
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

  it("lists all registered tools including demographics", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(response.body.result.tools).toHaveLength(10);
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_search_demographics");

    const financialsTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fdic_search_financials",
    );
    expect(financialsTool.inputSchema.properties.sort_order.default).toBe(
      "DESC",
    );
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
});
