/**
 * Live FDIC API smoke tests via real MCP HTTP tool calls.
 *
 * These tests hit the real FDIC BankFind API through the MCP server's
 * HTTP transport, validating the full tool path: argument parsing → tool
 * registration → FDIC API call → response shaping → MCP result.
 *
 * Excluded from the default `npm test` run. Intended for:
 *   - Scheduled CI (nightly)
 *   - Manual verification before releases
 *   - Post-incident confidence checks
 *
 * Run with: npm run test:live
 *
 * Assertions are intentionally stable: they check structure and key-field
 * presence rather than exact counts or rankings that shift with quarterly
 * data refreshes.
 */

import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/index.js";

// Well-known stable inputs
const BANK_OF_AMERICA_CERT = 3511;
const STABLE_REPDTE = "20231231"; // Q4 2023 — fully published

const app = createApp();
const mcpAcceptHeader = "application/json, text/event-stream";
const defaultProtocolVersion = "2025-03-26";

/**
 * Initialize an MCP session and return a helper for calling tools.
 */
async function initSession() {
  const initRes = await request(app)
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
        clientInfo: { name: "live-smoke-test", version: "1.0.0" },
      },
    });

  expect(initRes.status).toBe(200);
  const sessionId = initRes.headers["mcp-session-id"];
  expect(sessionId).toBeTruthy();

  // Send initialized notification
  await request(app)
    .post("/mcp")
    .set("content-type", "application/json")
    .set("accept", mcpAcceptHeader)
    .set("mcp-session-id", sessionId)
    .send({ jsonrpc: "2.0", method: "notifications/initialized" });

  let nextId = 1;

  async function callTool(name: string, args: Record<string, unknown>) {
    const res = await request(app)
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", mcpAcceptHeader)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      });

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error).toBeUndefined();
    expect(body.result).toBeDefined();
    return body.result;
  }

  return { sessionId, callTool };
}

describe("Live FDIC API smoke tests", () => {
  // Increase timeout — real API calls may take a few seconds
  const TIMEOUT = 30_000;

  describe("Institution search", () => {
    it(
      "fdic_search_institutions returns records with expected fields",
      async () => {
        const { callTool } = await initSession();

        const result = await callTool("fdic_search_institutions", {
          filters: `CERT:${BANK_OF_AMERICA_CERT}`,
          limit: 1,
        });

        // MCP tool result: content (text) + structuredContent (JSON)
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);

        // Text content should be present
        const textContent = result.content.find(
          (c: { type: string }) => c.type === "text",
        );
        expect(textContent).toBeDefined();
        expect(typeof textContent.text).toBe("string");
        expect(textContent.text.length).toBeGreaterThan(0);

        // structuredContent has the parsed data
        const sc = result.structuredContent;
        expect(sc).toBeDefined();
        expect(Array.isArray(sc.institutions)).toBe(true);
        expect(sc.institutions.length).toBe(1);

        const record = sc.institutions[0];
        expect(record.CERT).toBe(BANK_OF_AMERICA_CERT);
        expect(typeof record.NAME).toBe("string");
        expect(record.NAME.length).toBeGreaterThan(0);

        // Pagination
        expect(sc.total).toBeGreaterThan(0);
        expect(typeof sc.has_more).toBe("boolean");
      },
      TIMEOUT,
    );

    it(
      "fdic_get_institution returns a single institution profile",
      async () => {
        const { callTool } = await initSession();

        const result = await callTool("fdic_get_institution", {
          cert: BANK_OF_AMERICA_CERT,
        });

        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);

        const sc = result.structuredContent;
        expect(sc).toBeDefined();
        expect(sc.CERT).toBe(BANK_OF_AMERICA_CERT);
        expect(typeof sc.NAME).toBe("string");
      },
      TIMEOUT,
    );
  });

  describe("Quarterly financials", () => {
    it(
      "fdic_search_financials returns records for a known institution and date",
      async () => {
        const { callTool } = await initSession();

        const result = await callTool("fdic_search_financials", {
          cert: BANK_OF_AMERICA_CERT,
          repdte: STABLE_REPDTE,
          limit: 1,
        });

        expect(result.content).toBeDefined();

        const sc = result.structuredContent;
        expect(sc).toBeDefined();
        expect(Array.isArray(sc.financials)).toBe(true);
        expect(sc.financials.length).toBe(1);

        const record = sc.financials[0];
        expect(record.CERT).toBe(BANK_OF_AMERICA_CERT);
        expect(record.REPDTE).toBe(STABLE_REPDTE);
        expect(typeof record.ASSET).toBe("number");
      },
      TIMEOUT,
    );
  });

  describe("Annual summary", () => {
    it(
      "fdic_search_summary returns annual aggregate records",
      async () => {
        const { callTool } = await initSession();

        // Summary is aggregate (not per-institution); filter by year only
        const result = await callTool("fdic_search_summary", {
          year: 2023,
          limit: 1,
        });

        expect(result.content).toBeDefined();

        const sc = result.structuredContent;
        expect(sc).toBeDefined();
        expect(Array.isArray(sc.summary)).toBe(true);
        expect(sc.summary.length).toBe(1);

        const record = sc.summary[0];
        expect(typeof record.ASSET).toBe("number");
      },
      TIMEOUT,
    );
  });

  describe("Demographics", () => {
    it(
      "fdic_search_demographics returns records with office data",
      async () => {
        const { callTool } = await initSession();

        const result = await callTool("fdic_search_demographics", {
          cert: BANK_OF_AMERICA_CERT,
          repdte: STABLE_REPDTE,
          limit: 1,
        });

        expect(result.content).toBeDefined();

        const sc = result.structuredContent;
        expect(sc).toBeDefined();
        // Demographics tool uses "demographics" key
        const records = sc.demographics ?? sc.records;
        expect(Array.isArray(records)).toBe(true);
        expect(records.length).toBe(1);
      },
      TIMEOUT,
    );
  });

  describe("Analysis helper", () => {
    it(
      "fdic_analyze_bank_health returns a structured health assessment",
      async () => {
        const { callTool } = await initSession();

        const result = await callTool("fdic_analyze_bank_health", {
          cert: BANK_OF_AMERICA_CERT,
          quarters: 4,
        });

        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);

        // Health analysis should return text content with the assessment
        const textContent = result.content.find(
          (c: { type: string }) => c.type === "text",
        );
        expect(textContent).toBeDefined();
        expect(typeof textContent.text).toBe("string");
        expect(textContent.text.length).toBeGreaterThan(100);

        // structuredContent should contain the proxy model and legacy fields
        const sc = result.structuredContent;
        expect(sc).toBeDefined();
        expect(sc.model).toBe("public_camels_proxy_v1");
        expect(sc.composite).toBeDefined();
        expect(sc.components).toBeDefined();
        expect(sc.proxy).toBeDefined();
      },
      TIMEOUT,
    );
  });

  describe("MCP contract", () => {
    it(
      "tools/list includes expected tool names",
      async () => {
        const initRes = await request(app)
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
              clientInfo: { name: "live-smoke-test", version: "1.0.0" },
            },
          });

        const sessionId = initRes.headers["mcp-session-id"];

        await request(app)
          .post("/mcp")
          .set("content-type", "application/json")
          .set("accept", mcpAcceptHeader)
          .set("mcp-session-id", sessionId)
          .send({ jsonrpc: "2.0", method: "notifications/initialized" });

        const res = await request(app)
          .post("/mcp")
          .set("content-type", "application/json")
          .set("accept", mcpAcceptHeader)
          .set("mcp-session-id", sessionId)
          .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

        expect(res.status).toBe(200);
        const tools = res.body.result.tools;
        expect(Array.isArray(tools)).toBe(true);

        const toolNames = tools.map((t: { name: string }) => t.name);

        // Core search tools that must always be present
        const expectedTools = [
          "fdic_search_institutions",
          "fdic_get_institution",
          "fdic_search_financials",
          "fdic_search_summary",
          "fdic_search_sod",
          "fdic_search_demographics",
          "fdic_search_failures",
          "fdic_search_locations",
          "fdic_search_history",
          "fdic_analyze_bank_health",
        ];

        for (const name of expectedTools) {
          expect(toolNames).toContain(name);
        }
      },
      TIMEOUT,
    );
  });
});
