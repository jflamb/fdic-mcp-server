import { McpServer } from "@modelcontextprotocol/server";
import type { Express } from "express";
import request, { type Response } from "supertest";
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
import { RateLimiter } from "../src/chatRateLimit.js";
import { clearQueryCache } from "../src/services/fdicClient.js";
import packageJson from "../package.json";

const expectedVersion = packageJson.version;
const mcpAcceptHeader = "application/json, text/event-stream";
const defaultProtocolVersion = "2026-07-28";
const legacyProtocolVersion = "2025-03-26";
const protocolVersionMetaKey = "io.modelcontextprotocol/protocolVersion";
const clientCapabilitiesMetaKey = "io.modelcontextprotocol/clientCapabilities";

function modernBody(body: Record<string, unknown>) {
  const params = (body.params ?? {}) as Record<string, unknown>;
  return {
    ...body,
    params: {
      ...params,
      _meta: {
        [protocolVersionMetaKey]: defaultProtocolVersion,
        [clientCapabilitiesMetaKey]: {},
        ...(params._meta as Record<string, unknown> | undefined),
      },
    },
  };
}

function sseMessages(response: Response): Array<Record<string, any>> {
  return response.text.split(/\r?\n\r?\n/).flatMap((event) => {
    const data = event.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n");
    return data ? [JSON.parse(data)] : [];
  });
}

async function mcpRequest(
  app: Express,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const requestBuilder = request(app)
    .post("/mcp")
    .set("content-type", "application/json")
    .set("accept", mcpAcceptHeader)
    .set("mcp-protocol-version", defaultProtocolVersion)
    .set("mcp-method", String(body.method));
  const params = body.params as Record<string, unknown> | undefined;
  const name = body.method === "resources/read" ? params?.uri : params?.name;
  if (typeof name === "string") requestBuilder.set("mcp-name", name);

  for (const [name, value] of Object.entries(headers)) {
    requestBuilder.set(name, value);
  }

  const response = await requestBuilder.send(modernBody(body));
  if (response.headers["content-type"]?.includes("text/event-stream")) {
    response.body = sseMessages(response).find((message) => message.id === body.id);
  }
  return response;
}

function mcpPost(body: Record<string, unknown>) {
  return mcpRequest(createApp(), body);
}

async function collectProgressNotifications(trigger: () => Promise<Response>) {
  const response = await trigger();
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toContain("text/event-stream");
  expect(response.body.result.isError).not.toBe(true);
  return sseMessages(response)
    .filter((message) => message.method === "notifications/progress")
    .map((message) => message.params);
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

  it("rejects oversized request bodies before calling the FDIC API", async () => {
    const response = await mcpRequest(createApp(), {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "fdic_search_institutions", arguments: { filters: "X".repeat(102_400) } },
    });
    expect(response.status).toBe(413);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("retires chat routes while preserving HTTP MCP and health", async () => {
    const app = createApp();
    expect((await request(app).get("/chat/status")).status).toBe(404);
    expect((await request(app).post("/chat").send({ messages: [] })).status).toBe(404);
    expect((await request(app).get("/health")).status).toBe(200);
    const response = await mcpRequest(app, {
      jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
    });
    expect(response.status).toBe(200);
    expect(response.headers["mcp-session-id"]).toBeUndefined();
    expect(response.body.result.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "fdic_search_institutions" }),
    ]));
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

  it("discovers modern capabilities without an initialize handshake", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0", id: 100, method: "server/discover", params: {},
    });
    expect(response.status).toBe(200);
    expect(response.headers["mcp-session-id"]).toBeUndefined();
    expect(response.body.result.supportedVersions).toContain(defaultProtocolVersion);
    expect(response.body.result.capabilities).toMatchObject({
      tools: {}, resources: {}, prompts: {},
    });
    expect(response.body.result._meta["io.modelcontextprotocol/serverInfo"]).toMatchObject({
      name: "fdic-mcp-server", version: expectedVersion,
    });
  });

  it("serves independent requests across app instances without initialization or session affinity", async () => {
    const first = await mcpRequest(createApp(), {
      jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
    });
    const second = await mcpRequest(createApp(), {
      jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers["mcp-session-id"]).toBeUndefined();
    expect(second.headers["mcp-session-id"]).toBeUndefined();
    expect(second.body.result.tools).toEqual(first.body.result.tools);
  });

  it.each(["get", "delete"] as const)("rejects %s session operations", async (method) => {
    const response = await request(createApp())[method]("/mcp")
      .set("accept", mcpAcceptHeader)
      .set("mcp-protocol-version", defaultProtocolVersion);
    expect(response.status).toBe(405);
  });

  it("supports the legacy initialize handshake without allocating a session", async () => {
    const app = createApp();
    const initialized = await request(app).post("/mcp")
      .set("accept", mcpAcceptHeader)
      .send({
        jsonrpc: "2.0", id: 0, method: "initialize",
        params: {
          protocolVersion: legacyProtocolVersion,
          capabilities: {},
          clientInfo: { name: "legacy-vitest", version: "1.0.0" },
        },
      });
    expect(initialized.status).toBe(200);
    expect(initialized.headers["mcp-session-id"]).toBeUndefined();
    const initializeBody = initialized.headers["content-type"]?.includes("text/event-stream")
      ? sseMessages(initialized).find((message) => message.id === 0)
      : initialized.body;
    expect(initializeBody.result.protocolVersion).toBe(legacyProtocolVersion);
    const notification = await request(app).post("/mcp")
      .set("accept", mcpAcceptHeader)
      .send({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(notification.status).toBe(202);
    const response = await request(app).post("/mcp")
      .set("accept", mcpAcceptHeader)
      .set("mcp-protocol-version", legacyProtocolVersion)
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    expect(response.status).toBe(200);
    const body = response.headers["content-type"]?.includes("text/event-stream")
      ? sseMessages(response).find((message) => message.id === 1)
      : response.body;
    expect(body.result.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "fdic_search_institutions" }),
    ]));
  });

  it("rate limits MCP requests by client IP", async () => {
    const mcpRateLimiter = new RateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
    });
    mcpRateLimiter.check("203.0.113.10", Date.now());
    const app = createApp({
      mcpRateLimiter,
    });

    const response = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("x-forwarded-for", "203.0.113.10")
      .send({
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: legacyProtocolVersion,
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        },
      });

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expect(response.body.error.message).toBe(
      "Rate limit exceeded. Try again shortly.",
    );
  });

  it("blocks MCP requests from configured client IP ranges", async () => {
    const app = createApp({
      mcpBlockedIpRules: [
        {
          raw: "2605:a601:8119:1800::/64",
          version: 6,
          address: 0x2605a601811918000000000000000000n,
          prefixLength: 64,
        },
      ],
    });

    const response = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("x-forwarded-for", "2605:a601:8119:1800:b10e:b915:d83c:13e1")
      .send({
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: legacyProtocolVersion,
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Forbidden client IP.");
  });

  it("requires a complete modern request envelope", async () => {
    for (const meta of [undefined, { [protocolVersionMetaKey]: defaultProtocolVersion }]) {
      const response = await request(createApp()).post("/mcp")
        .set("accept", mcpAcceptHeader)
        .set("mcp-protocol-version", defaultProtocolVersion)
        .send({ jsonrpc: "2.0", id: 3, method: "tools/list", params: { _meta: meta } });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(-32602);
    }
  });

  it("rejects unsupported versions and mismatched protocol headers", async () => {
    const unsupported = await mcpRequest(createApp(), {
      jsonrpc: "2.0", id: 4, method: "tools/list",
      params: { _meta: { [protocolVersionMetaKey]: "2099-01-01" } },
    }, { "mcp-protocol-version": "2099-01-01" });
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe(-32022);

    const mismatch = await mcpRequest(createApp(), {
      jsonrpc: "2.0", id: 5, method: "tools/list", params: {},
    }, { "mcp-protocol-version": legacyProtocolVersion });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe(-32020);
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
          protocolVersion: legacyProtocolVersion,
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
          protocolVersion: legacyProtocolVersion,
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        },
      });

    expect(disallowedInit.status).toBe(403);
  });

  it("rejects untrusted Host headers before invoking the server factory", async () => {
    const serverFactory = vi.fn(() => new McpServer({ name: "test", version: "1" }));
    const response = await mcpRequest(createApp({ serverFactory }), {
      jsonrpc: "2.0", id: 101, method: "tools/list", params: {},
    }, { host: "attacker.example" });
    expect(response.status).toBe(403);
    expect(serverFactory).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched method and tool headers before calling the FDIC API", async () => {
    for (const headers of [
      { "mcp-method": "tools/list" },
      { "mcp-name": "different_tool" },
    ]) {
      const response = await mcpRequest(createApp(), {
        jsonrpc: "2.0", id: 102, method: "tools/call",
        params: { name: "fdic_search_institutions", arguments: {} },
      }, headers);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(-32020);
    }
    expect(getMock).not.toHaveBeenCalled();
  });

  it("keeps concurrent progress and results on their originating POST streams", async () => {
    let entered = 0;
    let release!: () => void;
    const bothEntered = new Promise<void>((resolve) => { release = resolve; });
    const app = createApp({
      serverFactory: () => {
        const server = new McpServer({ name: "progress-test", version: "1" });
        server.registerTool("progress_probe", {}, async (ctx) => {
          const token = ctx.mcpReq._meta?.progressToken as string;
          await ctx.mcpReq.notify({
            method: "notifications/progress",
            params: { progressToken: token, progress: 0, total: 1, message: `Started ${token}` },
          });
          entered += 1;
          if (entered === 2) release();
          await bothEntered;
          await ctx.mcpReq.notify({
            method: "notifications/progress",
            params: { progressToken: token, progress: 1, total: 1, message: `Finished ${token}` },
          });
          return { content: [{ type: "text", text: token }] };
        });
        return server;
      },
    });
    const tokens = ["first-request", "second-request"];
    const responses = await Promise.all(tokens.map((token, index) => mcpRequest(app, {
      jsonrpc: "2.0", id: index + 1, method: "tools/call",
      params: { name: "progress_probe", arguments: {}, _meta: { progressToken: token } },
    })));
    expect(entered).toBe(2);
    responses.forEach((response, index) => {
      expect(response.status).toBe(200);
      expect(response.body.result.content).toEqual([{ type: "text", text: tokens[index] }]);
      const notifications = sseMessages(response)
        .filter((message) => message.method === "notifications/progress");
      expect(notifications.map((message) => message.params.progressToken)).toEqual([
        tokens[index], tokens[index],
      ]);
      expect(notifications.map((message) => message.params.progress)).toEqual([0, 1]);
    });
  });

  it("streams progress notifications for snapshot analysis when the client provides a progress token", async () => {
    const app = createApp();
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

    const progress = await collectProgressNotifications(() =>
      mcpRequest(app, {
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

    const progress = await collectProgressNotifications(() =>
      mcpRequest(app, {
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

    const progress = await collectProgressNotifications(() =>
      mcpRequest(app, {
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
    expect(response.body.result.tools).toHaveLength(29);
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_search_demographics");
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_compare_bank_snapshots");
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_qbp_lite_data");
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual(
      expect.arrayContaining([
        // ChatGPT compatibility names
        "search",
        "fetch",
        "fdic_show_bank_deep_dive",
        // Namespaced aliases registered for general MCP clients
        "fdic_search",
        "fdic_fetch",
      ]),
    );

    const financialsTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fdic_search_financials",
    );
    expect(financialsTool.inputSchema.properties.sort_order.default).toBe(
      "DESC",
    );
    expect(
      financialsTool.outputSchema.properties.financials.items.properties,
    ).toMatchObject({
      CERT: { type: "integer" },
      REPDTE: {
        type: ["string", "number"],
      },
      ASSET: { type: "number" },
      ROA: { type: "number" },
      IDT1CER: { type: "number" },
    });
    expect(
      financialsTool.outputSchema.properties.financials.items.additionalProperties,
    ).toEqual({});
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

    const searchTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "search",
    );
    expect(searchTool.inputSchema.properties.query.type).toBe("string");
    expect(searchTool.annotations.readOnlyHint).toBe(true);

    const fetchTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fetch",
    );
    expect(fetchTool.inputSchema.properties.id.type).toBe("string");
    expect(fetchTool.annotations.readOnlyHint).toBe(true);

    const deepDiveTool = response.body.result.tools.find(
      (tool: { name: string }) => tool.name === "fdic_show_bank_deep_dive",
    );
    expect(deepDiveTool._meta.ui.resourceUri).toBe(
      "ui://widget/fdic-bank-deep-dive-v1.html",
    );
    expect(deepDiveTool._meta["openai/outputTemplate"]).toBe(
      "ui://widget/fdic-bank-deep-dive-v1.html",
    );
    expect(deepDiveTool.outputSchema.properties.institution.properties).toMatchObject({
      cert: { type: "integer" },
      name: { type: "string" },
      report_date: { type: "string" },
    });
    expect(deepDiveTool.outputSchema.properties.metrics.properties).toMatchObject({
      roa: { type: "string" },
      tier1_leverage: { type: "string" },
      efficiency_ratio: { type: "string" },
    });
  });

  it("lists the canonical workflow prompts", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1010,
      method: "prompts/list",
      params: {},
    });

    expect(response.status).toBe(200);
    const names = response.body.result.prompts.map(
      (prompt: { name: string }) => prompt.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "bank_deep_dive",
        "failure_forensics",
        "portfolio_surveillance",
        "examiner_overlay",
      ]),
    );
  });

  it("renders the bank_deep_dive prompt with the bank argument", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 1011,
      method: "prompts/get",
      params: {
        name: "bank_deep_dive",
        arguments: { bank: "Wells Fargo", repdte: "20241231" },
      },
    });

    expect(response.status).toBe(200);
    const messages = response.body.result.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content.type).toBe("text");
    expect(messages[0].content.text).toContain("Wells Fargo");
    expect(messages[0].content.text).toContain("20241231");
    expect(messages[0].content.text).toContain("fdic_analyze_bank_health");
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
        "ui://widget/fdic-bank-deep-dive-v1.html",
      ]),
    );
  });

  it("reads the ChatGPT bank deep-dive widget resource", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 103,
      method: "resources/read",
      params: {
        uri: "ui://widget/fdic-bank-deep-dive-v1.html",
      },
    });

    expect(response.status).toBe(200);
    const resource = response.body.result.contents[0];
    expect(resource.uri).toBe("ui://widget/fdic-bank-deep-dive-v1.html");
    expect(resource.mimeType).toBe("text/html;profile=mcp-app");
    expect(resource.text).toContain("FDIC BankFind");
    expect(resource._meta.ui.prefersBorder).toBe(true);
    expect(resource._meta.ui.csp).toEqual({
      connectDomains: [],
      resourceDomains: [],
    });
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

  it("returns ChatGPT-compatible search results", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              NAME: "Wells Fargo Bank, National Association",
              CITY: "Sioux Falls",
              STALP: "SD",
              ACTIVE: 1,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 104,
      method: "tools/call",
      params: {
        name: "search",
        arguments: { query: "Wells Fargo Bank" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.content).toHaveLength(1);
    const payload = JSON.parse(response.body.result.content[0].text);
    expect(payload.results).toEqual([
      {
        id: "institution:3511",
        title: "Wells Fargo Bank, National Association (Sioux Falls, SD)",
        url: "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511",
      },
    ]);
  });

  it("returns fetch text for an institution result", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            data: {
              CERT: 3511,
              NAME: "Wells Fargo Bank, National Association",
              CITY: "Sioux Falls",
              STALP: "SD",
              ACTIVE: 1,
              ASSET: 1000000,
            },
          },
        ],
        meta: { total: 1 },
      },
    });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 105,
      method: "tools/call",
      params: {
        name: "fetch",
        arguments: { id: "institution:3511" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.content).toHaveLength(1);
    const payload = JSON.parse(response.body.result.content[0].text);
    expect(payload).toMatchObject({
      id: "institution:3511",
      title: "Wells Fargo Bank, National Association",
      url: "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511",
      metadata: {
        type: "institution",
        cert: 3511,
      },
    });
    expect(payload.text).toContain("CERT: 3511");
  });

  it("returns fetchable branch search results", async () => {
    getMock
      .mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                UNINUM: 123456,
                CERT: 3511,
                UNINAME: "Wells Fargo Bank",
                NAMEFULL: "Austin Branch",
                ADDRESS: "100 Congress Ave",
                CITY: "Austin",
                STALP: "TX",
                ZIP: "78701",
                BRNUM: 12,
              },
            },
          ],
          meta: { total: 1 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 106,
      method: "tools/call",
      params: {
        name: "search",
        arguments: { query: "branches in Austin" },
      },
    });

    expect(response.status).toBe(200);
    const payload = JSON.parse(response.body.result.content[0].text);
    expect(payload.results).toEqual([
      {
        id: "branch:123456",
        title: "Wells Fargo Bank - 100 Congress Ave, Austin, TX, 78701",
        url: "https://jflamb.github.io/fdic-mcp-server/tool-reference/#fdic_search_locations",
      },
    ]);
  });

  it("returns dashboard structuredContent for the ChatGPT bank deep-dive tool", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              data: {
                CERT: 3511,
                NAME: "Wells Fargo Bank, National Association",
                CITY: "Sioux Falls",
                STALP: "SD",
                ACTIVE: 1,
                ASSET: 1000000,
                DEP: 900000,
                OFFICES: 10,
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
                REPDTE: "20241231",
                ASSET: 1000000,
                DEP: 900000,
                ROA: 1.25,
                IDT1CER: 8.5,
              },
            },
          ],
          meta: { total: 1 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 107,
      method: "tools/call",
      params: {
        name: "fdic_show_bank_deep_dive",
        arguments: { cert: 3511, repdte: "20241231" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.result.structuredContent).toMatchObject({
      institution: {
        cert: 3511,
        name: "Wells Fargo Bank, National Association",
        report_date: "20241231",
        asset_thousands: 1000000,
      },
      metrics: {
        roa: "1.25%",
        tier1_leverage: "8.50%",
      },
      sources: [
        {
          url: "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511",
        },
      ],
    });
    expect(response.body.result._meta.widget.resourceUri).toBe(
      "ui://widget/fdic-bank-deep-dive-v1.html",
    );

    // Claude (and any MCP client without a widget renderer) reads the text
    // content. It must be a self-contained Markdown dashboard, not a stub
    // that only the ChatGPT widget can interpret.
    const text = response.body.result.content[0].text;
    expect(text).toContain("## FDIC Bank Deep Dive: Wells Fargo Bank");
    expect(text).toContain("**CERT** 3511");
    expect(text).toContain("Sioux Falls, SD");
    expect(text).toContain("**Report date** 20241231");
    expect(text).toContain("| Metric | Value |");
    // Dollar formatting: 1,000,000 ($thousands) → $1.0B
    expect(text).toContain("| Assets | $1.0B |");
    expect(text).toContain("| ROA | 1.25% |");
    expect(text).toContain("| Tier 1 leverage | 8.50% |");
    expect(text).toContain(
      "[FDIC BankFind institution profile](https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511)",
    );
  });

  it("reuses cached FDIC responses across sequential HTTP requests", async () => {
    const app = createApp();
    getMock.mockResolvedValueOnce({
      data: { data: [{ data: { CERT: 3511 } }], meta: { total: 1 } },
    });

    const first = await mcpRequest(app, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "fdic_search_institutions",
        arguments: { filters: "CERT:3511", limit: 1 },
      },
    });

    const second = await mcpRequest(app, {
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

  it("exposes the failure cost field and descending ranking guidance to clients", async () => {
    const response = await mcpPost({ jsonrpc: "2.0", id: 611, method: "tools/list" });
    expect(response.status).toBe(200);
    const tools = response.body.result.tools;
    const search = tools.find((tool: { name: string }) => tool.name === "fdic_search_failures");
    const lookup = tools.find((tool: { name: string }) => tool.name === "fdic_get_institution_failure");
    expect(search.description).toContain("estimated loss (DIF cost) is COST");
    expect(search.description).toContain("sort_by: COST and sort_order: DESC");
    expect(search.description).toContain("Do not use ESTIMATED_LOSS");
    expect(lookup.description).toContain("estimated DIF cost in the COST field");
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

  it("returns flat peer-health metrics and explicit institution name sources", async () => {
    const financial = (
      cert: number,
      asset: number,
      roa: number,
      equityRatio: number,
      nim: number,
      efficiency: number,
      loanToDeposit: number,
    ) => ({
      CERT: cert,
      REPDTE: "20241231",
      ASSET: asset,
      DEP: asset * 0.8,
      DEPDOM: asset * 0.75,
      COREDEP: asset * 0.6,
      EQTOT: asset * (equityRatio / 100),
      EQV: equityRatio,
      NETINC: asset * (roa / 100),
      IDT1CER: 9,
      IDT1RWAJR: 11,
      RBCT1J: 10,
      RBCRWAJ: 12,
      ROA: roa,
      ROE: 9,
      NIMY: nim,
      EEFFR: efficiency,
      LNLSDEPR: loanToDeposit,
      NCLNLSR: 0.7,
      NTLNLSR: 0.1,
      NPERFV: 0.5,
      LNRESNCR: 160,
      ELNATRY: 0.2,
      BROR: 3,
      CHBALR: 9,
      SC: asset * 0.2,
    });

    getMock
      // Financials for explicit peer set
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: financial(100, 1_000_000, 1.2, 10, 3.4, 54, 72) },
            { data: financial(200, 900_000, 0.8, 8, 3.0, 62, 86) },
            { data: financial(31628, 1_100_000, 0.9, 9, 3.2, 58, 82) },
          ],
          meta: { total: 3 },
        },
      })
      // Initial institution roster omits one CERT, matching the artifact feedback.
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 100, NAME: "Subject Bank", CITY: "Raleigh", STALP: "NC" } },
            { data: { CERT: 200, NAME: "Peer Bank", CITY: "Cary", STALP: "NC" } },
          ],
          meta: { total: 2 },
        },
      })
      // Best-effort gap fill still cannot resolve the missing name.
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: { total: 0 },
        },
      })
      // Subject history enrichment
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: { total: 0 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 107,
      method: "tools/call",
      params: {
        name: "fdic_compare_peer_health",
        arguments: {
          cert: 100,
          certs: [100, 200, 31628],
          repdte: "20241231",
          limit: 10,
        },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;

    expect(sc.peer_context.subject_percentiles.roaPct).toMatchObject({
      subject_value: 1.2,
      peer_median: expect.closeTo(0.85, 5),
    });
    expect(sc.peer_context.weighted_peer_averages.roaPct).toBe(0.86);
    expect(sc.deprecations).toEqual([
      expect.objectContaining({
        path: "peer_context.subject_percentiles",
        status: "deprecated",
        replacement: "metrics",
        removal_target: "future_major_release",
      }),
    ]);
    expect(sc.proxy_summary).toMatchObject({
      model: "public_camels_proxy_v1",
      official_status: "public off-site proxy, not official CAMELS",
      score: expect.any(Number),
      band: expect.any(String),
      capital_classification: {
        category: "well_capitalized",
        label: "Well Capitalized",
        binding_constraint: null,
        ratios_used: {
          totalRiskBased: 12,
          tier1RiskBased: 11,
          cet1: 10,
          leverage: 9,
        },
      },
      management_overlay: {
        level: expect.any(String),
        caps_band: expect.any(Boolean),
        reason_codes: expect.any(Array),
      },
      risk_signal_count: expect.any(Number),
      risk_signal_severities: expect.any(Object),
      trend_count: 0,
      data_quality: {
        report_date: "20241231",
        staleness: expect.any(String),
        gaps_count: expect.any(Number),
        gaps: expect.any(Array),
      },
    });
    expect(sc.proxy_summary.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "capital",
          label: expect.any(String),
          score: expect.any(Number),
          legacy_rating: expect.any(Number),
          flags: expect.any(Array),
        }),
        expect.objectContaining({
          name: "liquidity_funding",
          legacy_label: expect.any(String),
        }),
      ]),
    );
    expect(sc.proxy).toMatchObject({
      overall: {
        score: sc.proxy_summary.score,
        band: sc.proxy_summary.band,
      },
      component_assessment: {
        capital: {
          score: expect.any(Number),
        },
      },
    });
    expect(sc.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "roa_pct",
          label: "Return on assets",
          subject: 1.2,
          peer_median: expect.closeTo(0.85, 5),
          peer_weighted_avg: 0.86,
          higher_is_better: true,
          is_outlier: expect.any(Boolean),
          outlier_direction: expect.anything(),
        }),
        expect.objectContaining({
          name: "efficiency_ratio_pct",
          higher_is_better: false,
          outlier_direction: null,
        }),
      ]),
    );
    expect(sc.institutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cert: 100,
          name: "Subject Bank",
          name_source: "fdic_institution_profile",
        }),
        expect.objectContaining({
          cert: 31628,
          name: "CERT 31628",
          name_source: "cert_fallback",
          city: null,
          state: null,
        }),
      ]),
    );
  });
});
