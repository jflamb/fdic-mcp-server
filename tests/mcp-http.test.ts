import { once } from "node:events";
import type { Express } from "express";
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

import {
  createApp,
  parseAllowedOrigins,
  parseHttpHost,
  parseHttpPort,
} from "../src/index.js";
import { clearQueryCache } from "../src/services/fdicClient.js";
import packageJson from "../package.json";

const expectedVersion = packageJson.version;
const mcpAcceptHeader = "application/json, text/event-stream";
const defaultProtocolVersion = "2025-03-26";

async function initializeSession(app = createApp()) {
  const initializeResponse = await request(app)
    .post("/mcp")
    .set("content-type", "application/json")
    .set("accept", mcpAcceptHeader)
    .send({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: defaultProtocolVersion,
        capabilities: {},
        clientInfo: {
          name: "vitest",
          version: "1.0.0",
        },
      },
    });

  const sessionId = initializeResponse.headers["mcp-session-id"];
  if (initializeResponse.status !== 200 || typeof sessionId !== "string") {
    throw new Error(
      `Failed to initialize MCP session: ${initializeResponse.status}`,
    );
  }

  const initializedResponse = await request(app)
    .post("/mcp")
    .set("content-type", "application/json")
    .set("accept", mcpAcceptHeader)
    .set("mcp-session-id", sessionId)
    .send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

  if (initializedResponse.status !== 202) {
    throw new Error(
      `Failed to send initialized notification: ${initializedResponse.status}`,
    );
  }

  return { app, sessionId, initializeResponse };
}

function mcpRequest(
  app: Express,
  sessionId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const requestBuilder = request(app)
    .post("/mcp")
    .set("content-type", "application/json")
    .set("accept", mcpAcceptHeader)
    .set("mcp-session-id", sessionId);

  for (const [name, value] of Object.entries(headers)) {
    requestBuilder.set(name, value);
  }

  return requestBuilder.send(body);
}

async function mcpPost(body: Record<string, unknown>) {
  const { app, sessionId } = await initializeSession();
  return mcpRequest(app, sessionId, body);
}

async function collectProgressNotifications(
  app: Express,
  sessionId: string,
  trigger: () => Promise<unknown>,
) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address for test server");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
    headers: {
      accept: "text/event-stream",
      "mcp-session-id": sessionId,
    },
  });

  if (!response.ok || response.body === null) {
    throw new Error(`Failed to open SSE stream: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const progressEvents: Array<{
    progressToken: string | number;
    progress: number;
    total: number;
    message: string;
  }> = [];

  const readTask = (async () => {
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) {
          continue;
        }

        const payload = JSON.parse(dataLine.slice(6));
        if (payload.method === "notifications/progress") {
          progressEvents.push(payload.params);
          if (payload.params.progress === 1) {
            return;
          }
        }
      }
    }
  })();

  await trigger();
  await readTask;
  await reader.cancel();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  return progressEvents;
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

  it("defaults the HTTP host to localhost", () => {
    expect(parseHttpHost(undefined)).toBe("127.0.0.1");
  });

  it("parses allowed origins from the environment or localhost defaults", () => {
    expect(parseAllowedOrigins(undefined, 3000)).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://localhost:3000",
      "https://127.0.0.1:3000",
    ]);
    expect(parseAllowedOrigins("https://one.test, https://two.test", 3000)).toEqual([
      "https://one.test",
      "https://two.test",
    ]);
  });

  it("rejects non-initialize requests without a valid session", async () => {
    const response = await request(createApp())
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      "Bad Request: No valid session ID provided",
    );
  });

  it("supports GET and DELETE for an initialized session", async () => {
    const { app, sessionId } = await initializeSession(createApp());
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP address for test server");
    }

    const getResponse = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      headers: {
        accept: "text/event-stream",
        "mcp-session-id": sessionId,
      },
    });

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("content-type")).toContain(
      "text/event-stream",
    );
    await getResponse.body?.cancel();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    const deleteResponse = await request(app)
      .delete("/mcp")
      .set("accept", "application/json")
      .set("mcp-session-id", sessionId)
      .set("mcp-protocol-version", defaultProtocolVersion);

    expect(deleteResponse.status).toBe(200);

    const postDeleteResponse = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

    expect(postDeleteResponse.status).toBe(404);
    expect(postDeleteResponse.body.error.message).toBe("Session not found");
  });

  it("expires idle HTTP sessions even when the client never sends DELETE", async () => {
    vi.useFakeTimers();
    const app = createApp({
      sessionIdleTimeoutMs: 1000,
      sessionSweepIntervalMs: 250,
    });

    const { sessionId } = await initializeSession(app);

    await vi.advanceTimersByTimeAsync(1500);

    const response = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 22,
        method: "tools/list",
        params: {},
      });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Session not found");
    vi.useRealTimers();
  });

  it("refreshes the idle deadline when an HTTP session stays active", async () => {
    vi.useFakeTimers();
    const app = createApp({
      sessionIdleTimeoutMs: 1000,
      sessionSweepIntervalMs: 250,
    });

    const { sessionId } = await initializeSession(app);

    await vi.advanceTimersByTimeAsync(600);

    const keepAliveResponse = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 23,
        method: "tools/list",
        params: {},
      });

    expect(keepAliveResponse.status).toBe(200);

    await vi.advanceTimersByTimeAsync(600);

    const stillActiveResponse = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 24,
        method: "tools/list",
        params: {},
      });

    expect(stillActiveResponse.status).toBe(200);

    await vi.advanceTimersByTimeAsync(1200);

    const expiredResponse = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 25,
        method: "tools/list",
        params: {},
      });

    expect(expiredResponse.status).toBe(404);
    expect(expiredResponse.body.error.message).toBe("Session not found");
    vi.useRealTimers();
  });

  it("accepts missing MCP-Protocol-Version after initialization and rejects unsupported versions", async () => {
    const { app, sessionId } = await initializeSession(createApp());

    const withoutVersion = await mcpRequest(app, sessionId, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    });

    expect(withoutVersion.status).toBe(200);

    const withInvalidVersion = await mcpRequest(
      app,
      sessionId,
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/list",
        params: {},
      },
      { "mcp-protocol-version": "2099-01-01" },
    );

    expect(withInvalidVersion.status).toBe(400);
    expect(withInvalidVersion.body.error.message).toContain(
      "Unsupported protocol version",
    );
  });

  it("rejects disallowed Origin headers and allows requests without Origin", async () => {
    const app = createApp({
      port: 3000,
      allowedOrigins: ["https://allowed.example"],
    });

    const allowedInit = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("origin", "https://allowed.example")
      .send({
        jsonrpc: "2.0",
        id: 5,
        method: "initialize",
        params: {
          protocolVersion: defaultProtocolVersion,
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        },
      });

    expect(allowedInit.status).toBe(200);

    const disallowedInit = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("origin", "https://disallowed.example")
      .send({
        jsonrpc: "2.0",
        id: 6,
        method: "initialize",
        params: {
          protocolVersion: defaultProtocolVersion,
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        },
      });

    expect(disallowedInit.status).toBe(403);
  });

  it("streams progress notifications for snapshot analysis when the client provides a progress token", async () => {
    const app = createApp();
    const { sessionId } = await initializeSession(app);
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                NAME: "Example Bank",
                REPDTE: "20240331",
                ASSET: 1000,
                DEP: 800,
                NETINC: 10,
                ROA: 1,
                ROE: 10,
              },
            },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                NAME: "Example Bank",
                REPDTE: "20241231",
                ASSET: 1200,
                DEP: 900,
                NETINC: 12,
                ROA: 1.1,
                ROE: 10.5,
              },
            },
          ],
          meta: { total: 1 },
        },
      });

    const progress = await collectProgressNotifications(app, sessionId, () =>
      mcpRequest(app, sessionId, {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "fdic_compare_bank_snapshots",
          arguments: {
            certs: [3511],
            start_repdte: "20240331",
            end_repdte: "20241231",
            include_demographics: false,
          },
          _meta: {
            progressToken: "analysis-progress",
          },
        },
      }),
    );

    expect(progress).toEqual([
      {
        progressToken: "analysis-progress",
        progress: 0.1,
        total: 1,
        message: "Fetching institution roster",
      },
      {
        progressToken: "analysis-progress",
        progress: 0.3,
        total: 1,
        message: "Fetching financial snapshots",
      },
      {
        progressToken: "analysis-progress",
        progress: 0.9,
        total: 1,
        message: "Computing metrics and insights",
      },
      {
        progressToken: "analysis-progress",
        progress: 1,
        total: 1,
        message: "Analysis complete",
      },
    ]);
  });

  it("uses combined fetch progress messages when snapshot analysis includes demographics", async () => {
    const app = createApp();
    const { sessionId } = await initializeSession(app);
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                NAME: "Example Bank",
                REPDTE: "20240331",
                ASSET: 1000,
                DEP: 800,
                NETINC: 10,
                ROA: 1,
                ROE: 10,
              },
            },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                NAME: "Example Bank",
                REPDTE: "20241231",
                ASSET: 1200,
                DEP: 900,
                NETINC: 12,
                ROA: 1.1,
                ROE: 10.5,
              },
            },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                REPDTE: "20240331",
                OFFTOT: 5,
                CBSANAME: "Austin",
              },
            },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                REPDTE: "20241231",
                OFFTOT: 6,
                CBSANAME: "Austin",
              },
            },
          ],
          meta: { total: 1 },
        },
      });

    const progress = await collectProgressNotifications(app, sessionId, () =>
      mcpRequest(app, sessionId, {
        jsonrpc: "2.0",
        id: 71,
        method: "tools/call",
        params: {
          name: "fdic_compare_bank_snapshots",
          arguments: {
            certs: [3511],
            start_repdte: "20240331",
            end_repdte: "20241231",
            include_demographics: true,
          },
          _meta: {
            progressToken: "analysis-progress-with-demographics",
          },
        },
      }),
    );

    expect(progress).toEqual([
      {
        progressToken: "analysis-progress-with-demographics",
        progress: 0.1,
        total: 1,
        message: "Fetching institution roster",
      },
      {
        progressToken: "analysis-progress-with-demographics",
        progress: 0.3,
        total: 1,
        message: "Fetching financial and demographic snapshots",
      },
      {
        progressToken: "analysis-progress-with-demographics",
        progress: 0.9,
        total: 1,
        message: "Computing metrics and insights",
      },
      {
        progressToken: "analysis-progress-with-demographics",
        progress: 1,
        total: 1,
        message: "Analysis complete",
      },
    ]);
  });

  it("streams progress notifications for peer group analysis when the client provides a progress token", async () => {
    const app = createApp();
    const { sessionId } = await initializeSession(app);
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                NAME: "Example Bank",
                CITY: "Austin",
                STALP: "TX",
                BKCLASS: "N",
              },
            },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                ASSET: 1000,
                DEP: 800,
                NETINC: 10,
                ROA: 1,
                ROE: 10,
                NETNIM: 3,
                EQTOT: 100,
                LNLSNET: 700,
                INTINC: 50,
                EINTEXP: 10,
                NONII: 5,
                NONIX: 4,
              },
            },
          ],
          meta: { total: 1 },
        },
      });

    const progress = await collectProgressNotifications(app, sessionId, () =>
      mcpRequest(app, sessionId, {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "fdic_peer_group_analysis",
          arguments: {
            repdte: "20241231",
            asset_min: 500,
            asset_max: 2000,
            active_only: false,
          },
          _meta: {
            progressToken: "peer-progress",
          },
        },
      }),
    );

    expect(progress).toEqual([
      {
        progressToken: "peer-progress",
        progress: 0.1,
        total: 1,
        message: "Resolving subject and peer criteria",
      },
      {
        progressToken: "peer-progress",
        progress: 0.4,
        total: 1,
        message: "Fetching peer roster",
      },
      {
        progressToken: "peer-progress",
        progress: 0.7,
        total: 1,
        message: "Fetching peer financials",
      },
      {
        progressToken: "peer-progress",
        progress: 0.9,
        total: 1,
        message: "Computing peer rankings",
      },
      {
        progressToken: "peer-progress",
        progress: 1,
        total: 1,
        message: "Analysis complete",
      },
    ]);
  });

  it("lists all registered tools including demographics", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(response.body.result.tools).toHaveLength(21);
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
    expect(analysisTool.inputSchema.properties.state.type).toBe("string");
    expect(analysisTool.inputSchema.properties.certs.type).toBe("array");
    expect(analysisTool.inputSchema.properties.start_repdte.type).toBe("string");

    const peerGroupTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fdic_peer_group_analysis",
    );
    expect(peerGroupTool.inputSchema.properties.repdte.type).toBe("string");
    expect(peerGroupTool.inputSchema.properties.cert.type).toBe("integer");
    expect(peerGroupTool.inputSchema.properties.asset_min.type).toBe("number");
  });

  it("lists schema resources for each supported FDIC endpoint", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 101,
      method: "resources/list",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(
      response.body.result.resources.map(
        (resource: { uri: string }) => resource.uri,
      ),
    ).toEqual(
      expect.arrayContaining([
        "fdic://schemas/index",
        "fdic://schemas/institutions",
        "fdic://schemas/financials",
        "fdic://schemas/summary",
        "fdic://schemas/sod",
        "fdic://schemas/demographics",
      ]),
    );
  });

  it("reads an endpoint schema resource over HTTP", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 102,
      method: "resources/read",
      params: {
        uri: "fdic://schemas/financials",
      },
    });

    expect(response.status).toBe(200);
    const resource = response.body.result.contents[0];
    const parsed = JSON.parse(resource.text);

    expect(resource.uri).toBe("fdic://schemas/financials");
    expect(parsed.endpoint).toBe("financials");
    expect(parsed.fields.CERT).toBeDefined();
    expect(parsed.fields.NETNIM).toBeDefined();
    expect(parsed.sort_fields).toContain("CERT");
  });

  it("reuses cached FDIC responses across sequential HTTP requests", async () => {
    const app = createApp();
    const { sessionId } = await initializeSession(app);
    getMock.mockResolvedValueOnce({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    const first = await mcpRequest(app, sessionId, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "fdic_search_institutions",
        arguments: { filters: "CERT:3511", limit: 1 },
      },
    });

    const second = await mcpRequest(app, sessionId, {
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
    expect(getMock).toHaveBeenCalledTimes(1);
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
    expect(getMock).toHaveBeenCalledWith(
      "/institutions",
      expect.objectContaining({
        params: {
          filters: "CERT:3511",
          limit: 1,
          offset: 0,
          output: "json",
          sort_order: "ASC",
        },
      }),
    );
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

  it("returns structured lookup details for a single institution", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              NAME: "Wells Fargo Bank, National Association",
              CITY: "Sioux Falls",
              STALP: "SD",
              ASSET: 1000000,
              ACTIVE: 1,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: {
        name: "fdic_get_institution",
        arguments: { cert: 3511, fields: "CERT,NAME,CITY,STALP,ASSET,ACTIVE" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      CERT: 3511,
      NAME: "Wells Fargo Bank, National Association",
      CITY: "Sioux Falls",
      STALP: "SD",
      ASSET: 1000000,
      ACTIVE: 1,
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

    expect(getMock).toHaveBeenLastCalledWith(
      "/locations",
      expect.objectContaining({
        params: {
          filters: 'CERT:3511 AND (CITY:"Austin")',
          limit: 20,
          offset: 0,
          output: "json",
          sort_order: "ASC",
        },
      }),
    );
  });

  it("returns structured location search results", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              UNINAME: "Wells Fargo Bank, National Association",
              NAMEFULL: "Downtown Branch",
              CITY: "Austin",
              STALP: "TX",
              BRNUM: 12,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 51,
      method: "tools/call",
      params: {
        name: "fdic_search_locations",
        arguments: { filters: 'CITY:"Austin"', limit: 1 },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      locations: [
        {
          CERT: 3511,
          UNINAME: "Wells Fargo Bank, National Association",
          NAMEFULL: "Downtown Branch",
          CITY: "Austin",
          STALP: "TX",
          BRNUM: 12,
        },
      ],
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
    expect(response.body.result.structuredContent).toEqual({
      total: 1,
      offset: 0,
      count: 1,
      has_more: false,
      financials: [{ CERT: 3511, REPDTE: "20251231" }],
    });
    expect(getMock).toHaveBeenLastCalledWith(
      "/financials",
      expect.objectContaining({
        params: {
          fields: "CERT,REPDTE",
          filters: "CERT:3511 AND REPDTE:20251231",
          limit: 20,
          offset: 0,
          output: "json",
          sort_order: "DESC",
        },
      }),
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
    expect(getMock).toHaveBeenLastCalledWith(
      "/failures",
      expect.objectContaining({
        params: {
          filters: "STALP:CA",
          limit: 1,
          offset: 0,
          output: "json",
          sort_by: "FAILDATE",
          sort_order: "ASC",
        },
      }),
    );
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
    expect(getMock).toHaveBeenLastCalledWith(
      "/history",
      expect.objectContaining({
        params: {
          filters: "CERT:3511 AND (TYPE:merger)",
          limit: 20,
          offset: 0,
          output: "json",
          sort_by: "PROCDATE",
          sort_order: "ASC",
        },
      }),
    );
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
    expect(getMock).toHaveBeenLastCalledWith(
      "/sod",
      expect.objectContaining({
        params: {
          filters: '(CITYBR:"Austin") AND CERT:3511 AND YEAR:2022',
          limit: 20,
          offset: 0,
          output: "json",
          sort_by: "DEPSUMBR",
          sort_order: "ASC",
        },
      }),
    );
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
    expect(getMock).toHaveBeenLastCalledWith(
      "/summary",
      expect.objectContaining({
        params: {
          filters: "(ASSET:[500000 TO *]) AND CERT:3511 AND YEAR:2023",
          limit: 20,
          offset: 0,
          output: "json",
          sort_by: "YEAR",
          sort_order: "ASC",
        },
      }),
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

  it("returns structured demographics search results for combined filters", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              REPDTE: "20241231",
              OFFTOT: 12,
              OFFSTATE: 3,
              METRO: 1,
              CBSANAME: "Austin-Round Rock-Georgetown, TX",
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 71,
      method: "tools/call",
      params: {
        name: "fdic_search_demographics",
        arguments: {
          cert: 3511,
          repdte: "20241231",
          filters: "METRO:1",
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
      demographics: [
        {
          CERT: 3511,
          REPDTE: "20241231",
          OFFTOT: 12,
          OFFSTATE: 3,
          METRO: 1,
          CBSANAME: "Austin-Round Rock-Georgetown, TX",
        },
      ],
    });
    expect(getMock).toHaveBeenLastCalledWith(
      "/demographics",
      expect.objectContaining({
        params: {
          filters: "(METRO:1) AND CERT:3511 AND REPDTE:20241231",
          limit: 1,
          offset: 0,
          output: "json",
          sort_order: "ASC",
        },
      }),
    );
  });

  it("returns empty demographics results with the expected structured shape", async () => {
    getMock.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0 } },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 72,
      method: "tools/call",
      params: {
        name: "fdic_search_demographics",
        arguments: { cert: 3511 },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toEqual({
      total: 0,
      offset: 0,
      count: 0,
      has_more: false,
      demographics: [],
    });
  });

  it("passes unusual filter strings through all search tools", async () => {
    const cases = [
      {
        name: "fdic_search_institutions",
        endpoint: "/institutions",
        filters: `NAME:"O'FALLON"`,
        expectedFilters: `NAME:"O'FALLON"`,
      },
      {
        name: "fdic_search_failures",
        endpoint: "/failures",
        filters: `NAME:"FIRST STATE BANK - ST. CHARLES"`,
        expectedFilters: `NAME:"FIRST STATE BANK - ST. CHARLES"`,
      },
      {
        name: "fdic_search_locations",
        endpoint: "/locations",
        filters: `CITY:"ST. JOHN'S"`,
        expectedFilters: `(CITY:"ST. JOHN'S")`,
      },
      {
        name: "fdic_search_history",
        endpoint: "/history",
        filters: `INSTNAME:"BANK & TRUST"`,
        expectedFilters: `(INSTNAME:"BANK & TRUST")`,
      },
      {
        name: "fdic_search_financials",
        endpoint: "/financials",
        filters: `NAME:"BANK OF THE WEST"`,
        expectedFilters: `(NAME:"BANK OF THE WEST")`,
      },
      {
        name: "fdic_search_summary",
        endpoint: "/summary",
        filters: `NAME:"BANK OF THE WEST"`,
        expectedFilters: `(NAME:"BANK OF THE WEST")`,
      },
      {
        name: "fdic_search_sod",
        endpoint: "/sod",
        filters: `NAMEFULL:"MAIN/OFFICE"`,
        expectedFilters: `(NAMEFULL:"MAIN/OFFICE")`,
      },
      {
        name: "fdic_search_demographics",
        endpoint: "/demographics",
        filters: `CBSANAME:"ST. LOUIS, MO-IL"`,
        expectedFilters: `(CBSANAME:"ST. LOUIS, MO-IL")`,
      },
    ] as const;

    for (const testCase of cases) {
      getMock.mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      });

      const response = await mcpPost({
        jsonrpc: "2.0",
        id: 80,
        method: "tools/call",
        params: {
          name: testCase.name,
          arguments: { filters: testCase.filters },
        },
      });

      expect(response.status).toBe(200);
      expect(getMock).toHaveBeenLastCalledWith(
        testCase.endpoint,
        expect.objectContaining({
          params: expect.objectContaining({
            filters: testCase.expectedFilters,
          }),
        }),
      );
    }
  });

  it("rejects snapshot analysis requests without state or certs", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          start_repdte: "20211231",
          end_repdte: "20241231",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain(
      "Provide either state or certs.",
    );
  });

  it("rejects snapshot analysis requests when start_repdte is not earlier than end_repdte", async () => {
    const reversed = await mcpPost({
      jsonrpc: "2.0",
      id: 801,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20241231",
          end_repdte: "20211231",
        },
      },
    });

    const equal = await mcpPost({
      jsonrpc: "2.0",
      id: 802,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20241231",
          end_repdte: "20241231",
        },
      },
    });

    expect(reversed.status).toBe(200);
    expect(reversed.body.result.isError).toBe(true);
    expect(reversed.body.result.content[0].text).toContain(
      "start_repdte must be earlier than end_repdte.",
    );

    expect(equal.status).toBe(200);
    expect(equal.body.result.isError).toBe(true);
    expect(equal.body.result.content[0].text).toContain(
      "start_repdte must be earlier than end_repdte.",
    );
  });

  it("returns a stable empty structuredContent envelope when no institutions match", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [],
        meta: { total: 0 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 803,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          limit: 2,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.content[0].text).toBe(
      "No institutions matched the comparison set.",
    );

    const sc = response.body.result.structuredContent;
    expect(Object.keys(sc).sort()).toEqual([
      "analysis_mode",
      "analyzed_count",
      "comparisons",
      "count",
      "end_repdte",
      "has_more",
      "insights",
      "offset",
      "sort_by",
      "sort_order",
      "start_repdte",
      "total",
      "total_candidates",
      "warnings",
    ]);
    expect(sc).toMatchObject({
      total_candidates: 0,
      analyzed_count: 0,
      start_repdte: "20211231",
      end_repdte: "20250630",
      analysis_mode: "snapshot",
      sort_by: "asset_growth",
      sort_order: "DESC",
      total: 0,
      offset: 0,
      count: 0,
      has_more: false,
      warnings: [],
      comparisons: [],
      insights: {
        growth_with_better_profitability: [],
        growth_with_branch_expansion: [],
        balance_sheet_growth_without_profitability: [],
        growth_with_branch_consolidation: [],
        deposit_mix_softening: [],
        sustained_asset_growth: [],
        multi_quarter_roa_decline: [],
      },
    });
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

  it("uses cert as a deterministic tie-breaker for equal analysis sort values", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Bank One", CITY: "Raleigh", STALP: "NC" } },
            { data: { CERT: 2222, NAME: "Bank Two", CITY: "Durham", STALP: "NC" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Bank One", ASSET: 100, DEP: 50, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
            { data: { CERT: 2222, NAME: "Bank Two", ASSET: 150, DEP: 70, NETINC: 12, ROA: 1.2, ROE: 8.5 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Bank One", ASSET: 200, DEP: 120, NETINC: 15, ROA: 1.1, ROE: 8.2 } },
            { data: { CERT: 2222, NAME: "Bank Two", ASSET: 250, DEP: 140, NETINC: 17, ROA: 1.3, ROE: 8.7 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      })
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 803,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          sort_by: "asset_growth",
          limit: 2,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(
      response.body.result.structuredContent.comparisons.map(
        (comparison: { cert: number }) => comparison.cert,
      ),
    ).toEqual([1111, 2222]);
  });

  it("handles partial snapshot data by analyzing only institutions with both dates present", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Complete Bank", CITY: "Raleigh", STALP: "NC" } },
            { data: { CERT: 2222, NAME: "Missing End Bank", CITY: "Durham", STALP: "NC" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Complete Bank", ASSET: 100, DEP: 50, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
            { data: { CERT: 2222, NAME: "Missing End Bank", ASSET: 200, DEP: 80, NETINC: 12, ROA: 1.2, ROE: 8.5 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Complete Bank", ASSET: 140, DEP: 90, NETINC: 14, ROA: 1.1, ROE: 8.2 } },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      })
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 804,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          limit: 2,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.total_candidates).toBe(2);
    expect(response.body.result.structuredContent.analyzed_count).toBe(1);
    expect(response.body.result.structuredContent.comparisons).toEqual([
      expect.objectContaining({ cert: 1111, name: "Complete Bank" }),
    ]);
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

  it("builds top-level insights from the full sorted population instead of the returned slice", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Slice Bank", CITY: "Raleigh", STALP: "NC" } },
            { data: { CERT: 2222, NAME: "Hidden Insight Bank", CITY: "Durham", STALP: "NC" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Slice Bank", ASSET: 100, DEP: 90, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
            { data: { CERT: 2222, NAME: "Hidden Insight Bank", ASSET: 100, DEP: 90, NETINC: 10, ROA: 1.0, ROE: 8.0 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 1111, NAME: "Slice Bank", ASSET: 160, DEP: 130, NETINC: 15, ROA: 1.3, ROE: 9.0 } },
            { data: { CERT: 2222, NAME: "Hidden Insight Bank", ASSET: 125, DEP: 80, NETINC: 9, ROA: 0.8, ROE: 7.5 } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      })
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1202,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          include_demographics: true,
          limit: 1,
          sort_by: "asset_growth",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.comparisons).toHaveLength(1);
    expect(
      response.body.result.structuredContent.comparisons[0].name,
    ).toBe("Slice Bank");
    expect(response.body.result.structuredContent.insights).toMatchObject({
      growth_with_better_profitability: ["Slice Bank"],
      balance_sheet_growth_without_profitability: ["Hidden Insight Bank"],
    });
    expect(response.body.result.content[0].text).toContain(
      "growth_with_better_profitability: Slice Bank",
    );
    expect(response.body.result.content[0].text).not.toContain(
      "Hidden Insight Bank",
    );
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

  it("preserves roster warnings when candidates exist but no comparisons can be built", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 3510, NAME: "Bank A", CITY: "Charlotte", STALP: "NC" } }],
          meta: { total: 10001 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: { total: 0 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: { total: 0 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1201,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          state: "North Carolina",
          start_repdte: "20211231",
          end_repdte: "20250630",
          include_demographics: false,
          limit: 2,
        },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.total_candidates).toBe(1);
    expect(sc.analyzed_count).toBe(0);
    expect(sc.total).toBe(0);
    expect(sc.count).toBe(0);
    expect(sc.has_more).toBe(false);
    expect(sc.comparisons).toEqual([]);
    expect(sc.warnings).toEqual([
      "Institution roster truncated to 1 records out of 10,001 matched institutions. Narrow the comparison set with institution_filters or certs for complete analysis.",
    ]);
    expect(sc.insights).toMatchObject({
      growth_with_better_profitability: [],
      growth_with_branch_expansion: [],
      balance_sheet_growth_without_profitability: [],
      growth_with_branch_consolidation: [],
      deposit_mix_softening: [],
      sustained_asset_growth: [],
      multi_quarter_roa_decline: [],
    });
  });

  it("warns when a snapshot analysis financial batch is truncated by the FDIC API limit", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 3510, NAME: "Bank A", REPDTE: "20211231", ASSET: 100, DEP: 50, NETINC: 10, ROA: 1, ROE: 8 } }],
          meta: { total: 10001 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 3510, NAME: "Bank A", REPDTE: "20250630", ASSET: 150, DEP: 75, NETINC: 12, ROA: 1.2, ROE: 8.5 } }],
          meta: { total: 1 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "fdic_compare_bank_snapshots",
        arguments: {
          certs: [3510],
          start_repdte: "20211231",
          end_repdte: "20250630",
          include_demographics: false,
          limit: 1,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent.warnings).toEqual([
      "financials batch for REPDTE:20211231 truncated to 1 records out of 10,001 matched rows. Narrow the comparison set with institution_filters or certs for complete analysis.",
    ]);
    expect(response.body.result.content[0].text).toContain(
      "Warning: financials batch for REPDTE:20211231 truncated to 1 records out of 10,001 matched rows.",
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

  it("rejects peer group requests without a constructor", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1021,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain(
      "At least one peer-group constructor is required",
    );
  });

  it("rejects peer group requests with an invalid asset range", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1022,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
          asset_min: 200,
          asset_max: 100,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain(
      "asset_min must be <= asset_max.",
    );
  });

  it("rejects invalid peer-group extra_fields before calling the FDIC API", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1023,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
          asset_min: 5000000,
          extra_fields: ["CERT", "FAILDATE"],
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain(
      "Invalid field 'FAILDATE' for endpoint financials.",
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it("warns when a peer-group financial batch is truncated by the FDIC API limit", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "N" } },
            { data: { CERT: 300, NAME: "Peer B", CITY: "Charlotte", STALP: "NC", BKCLASS: "N" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, ASSET: 5000000, DEP: 4000000, NETINC: 100000, ROA: 1.0, ROE: 9.0, NETNIM: 3.0, EQTOT: 500000, LNLSNET: 3000000, INTINC: 200000, EINTEXP: 80000, NONII: 30000, NONIX: 100000 } },
            { data: { CERT: 300, ASSET: 8000000, DEP: 6000000, NETINC: 200000, ROA: 1.5, ROE: 11.0, NETNIM: 3.5, EQTOT: 900000, LNLSNET: 4500000, INTINC: 350000, EINTEXP: 120000, NONII: 50000, NONIX: 150000 } },
          ],
          meta: { total: 10002 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 104,
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
    expect(response.body.result.structuredContent.warnings).toEqual([
      "financials batch for REPDTE:20241231 truncated to 2 records out of 10,002 matched rows. Narrow the peer group criteria for complete analysis.",
    ]);
    expect(response.body.result.content[0].text).toContain(
      "Warning: financials batch for REPDTE:20241231 truncated to 2 records out of 10,002 matched rows.",
    );
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

  it("uses cert as a deterministic tie-breaker for equal peer asset values", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "N" } },
            { data: { CERT: 300, NAME: "Peer B", CITY: "Charlotte", STALP: "NC", BKCLASS: "N" } },
          ],
          meta: { total: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 300, ASSET: 5000000, DEP: 4000000, NETINC: 100000, ROA: 1.0, ROE: 9.0, NETNIM: 3.0, EQTOT: 500000, LNLSNET: 3000000, INTINC: 200000, EINTEXP: 80000, NONII: 30000, NONIX: 100000 } },
            { data: { CERT: 200, ASSET: 5000000, DEP: 4100000, NETINC: 110000, ROA: 1.1, ROE: 9.5, NETNIM: 3.1, EQTOT: 520000, LNLSNET: 3050000, INTINC: 210000, EINTEXP: 82000, NONII: 32000, NONIX: 101000 } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 105,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
          asset_min: 5000000,
          asset_max: 6000000,
          charter_classes: ["N"],
          state: "NC",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(
      response.body.result.structuredContent.peers.map(
        (peer: { cert: number }) => peer.cert,
      ),
    ).toEqual([200, 300]);
  });

  it("includes valid peer-group extra_fields as raw values in structured output", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "N" } },
          ],
          meta: { total: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, ASSET: 5000000, DEPDOM: 3500000, DEP: 4000000, NETINC: 100000, ROA: 1.0, ROE: 9.0, NETNIM: 3.0, EQTOT: 500000, LNLSNET: 3000000, INTINC: 200000, EINTEXP: 80000, NONII: 30000, NONIX: 100000 } },
          ],
          meta: { total: 1 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 106,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
          asset_min: 5000000,
          asset_max: 6000000,
          charter_classes: ["N"],
          state: "NC",
          extra_fields: ["DEPDOM"],
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.isError).not.toBe(true);
    expect(response.body.result.structuredContent.peers).toEqual([
      expect.objectContaining({
        cert: 200,
        DEPDOM: 3500000,
      }),
    ]);
  });
});
