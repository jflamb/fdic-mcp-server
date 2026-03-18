import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock, googleGenAIMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  googleGenAIMock: vi.fn(),
}));

vi.mock("@google/genai", async () => {
  const actual = await vi.importActual<typeof import("@google/genai")>(
    "@google/genai",
  );

  class MockGoogleGenAI {
    models = {
      generateContent: generateContentMock,
    };

    constructor(...args: unknown[]) {
      googleGenAIMock(...args);
    }
  }

  return {
    ...actual,
    GoogleGenAI: MockGoogleGenAI,
  };
});

import { createApp } from "../src/index.js";

const ALLOWED_ORIGIN = "https://test-docs.example.com";

interface StubToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

function createStubServer(toolCallImpl?: (name: string, args: unknown) => unknown) {
  const listToolsMock = vi.fn(async () => ({
    tools: [
      {
        name: "fdic_search_institutions",
        description: "Search FDIC institutions",
        inputSchema: {
          type: "object",
          properties: {
            filters: { type: "string" },
          },
          additionalProperties: false,
          $schema: "http://json-schema.org/draft-07/schema#",
        },
      } satisfies StubToolDefinition,
    ],
  }));
  const callToolMock = vi.fn(async (request: Record<string, any>) => {
    if (toolCallImpl) {
      return toolCallImpl(request.params.name, request.params.arguments);
    }

    return {
      content: [{ type: "text", text: "Tool result" }],
      structuredContent: { ok: true },
      isError: false,
    };
  });

  const server = {
    server: {
      _requestHandlers: new Map<string, any>([
        ["tools/list", listToolsMock],
        ["tools/call", callToolMock],
      ]),
    },
  };

  return {
    server,
    listToolsMock,
    callToolMock,
  };
}

function createTestApp(options?: {
  geminiApiKey?: string;
  toolCallImpl?: (name: string, args: unknown) => unknown;
}) {
  const stub = createStubServer(options?.toolCallImpl);
  const app = createApp({
    chatAllowedOrigins: [ALLOWED_ORIGIN],
    geminiApiKey:
      options && "geminiApiKey" in options ? options.geminiApiKey : "test-key",
    serverFactory: () => stub.server as any,
  });

  return { app, ...stub };
}

describe("chat routes", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    googleGenAIMock.mockClear();
  });

  it("returns 503 when GEMINI_API_KEY is not configured", async () => {
    const { app } = createTestApp({ geminiApiKey: undefined });

    const response = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ messages: [{ role: "user", content: "hello" }] });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("unavailable");
  });

  it("returns 403 when Origin header is missing", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post("/chat")
      .send({ messages: [{ role: "user", content: "hello" }] });

    expect(response.status).toBe(403);
  });

  it("returns 403 when Origin is not allowed", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post("/chat")
      .set("Origin", "https://evil.example.com")
      .send({ messages: [{ role: "user", content: "hello" }] });

    expect(response.status).toBe(403);
  });

  it("serves the status endpoint with the configured availability and CORS headers", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get("/chat/status")
      .set("Origin", ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ available: true });
    expect(response.headers["access-control-allow-origin"]).toBe(
      ALLOWED_ORIGIN,
    );
  });

  it("handles preflight requests with restricted CORS headers", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .options("/chat")
      .set("Origin", ALLOWED_ORIGIN);

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS",
    );
  });

  it("returns 400 for invalid message payloads", async () => {
    const { app } = createTestApp();

    const missingMessages = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({});
    const invalidRole = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ messages: [{ role: "system", content: "hello" }] });
    const tooLong = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ messages: [{ role: "user", content: "x".repeat(501) }] });

    expect(missingMessages.status).toBe(400);
    expect(invalidRole.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });

  it("returns 400 when messages exceed 20 items", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({
        messages: Array.from({ length: 21 }, (_, index) => ({
          role: "user",
          content: `msg ${index}`,
        })),
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("20");
  });

  it("rate limits repeated requests from the same IP", async () => {
    const { app } = createTestApp();
    generateContentMock.mockResolvedValue({
      text: "Hello",
      candidates: [{ content: { parts: [{ text: "Hello" }] } }],
    });

    for (let index = 0; index < 10; index += 1) {
      const response = await request(app)
        .post("/chat")
        .set("Origin", ALLOWED_ORIGIN)
        .set("X-Forwarded-For", "1.2.3.4")
        .send({ messages: [{ role: "user", content: `hello ${index}` }] });
      expect(response.status).toBe(200);
    }

    const limited = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .set("X-Forwarded-For", "1.2.3.4")
      .send({ messages: [{ role: "user", content: "blocked" }] });

    expect(limited.status).toBe(429);
  });

  it("executes tool calls through the MCP server and returns the final reply", async () => {
    const { app, callToolMock } = createTestApp();
    generateContentMock
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: "call-1",
            name: "fdic_search_institutions",
            args: { filters: 'STNAME:"Texas"' },
          },
        ],
        candidates: [{ content: { parts: [] } }],
      })
      .mockResolvedValueOnce({
        text: "Here are the active Texas banks.",
        candidates: [
          { content: { parts: [{ text: "Here are the active Texas banks." }] } },
        ],
      });

    const response = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ messages: [{ role: "user", content: "Find Texas banks" }] });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe("Here are the active Texas banks.");
    expect(typeof response.body.sessionId).toBe("string");
    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(callToolMock.mock.calls[0][0]).toMatchObject({
      method: "tools/call",
      params: {
        name: "fdic_search_institutions",
        arguments: { filters: 'STNAME:"Texas"' },
      },
    });
  });

  it("includes prior conversation history when the same session continues", async () => {
    const { app } = createTestApp();
    generateContentMock
      .mockResolvedValueOnce({
        text: "First reply",
        candidates: [{ content: { parts: [{ text: "First reply" }] } }],
      })
      .mockResolvedValueOnce({
        text: "Second reply",
        candidates: [{ content: { parts: [{ text: "Second reply" }] } }],
      });

    const first = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ messages: [{ role: "user", content: "First question" }] });

    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({
        sessionId: first.body.sessionId,
        messages: [{ role: "user", content: "Second question" }],
      });

    expect(second.status).toBe(200);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    const secondCallRequest = generateContentMock.mock.calls[1][0];
    expect(secondCallRequest.contents.length).toBeGreaterThanOrEqual(3);
    expect(secondCallRequest.contents[0]).toMatchObject({ role: "user" });
    expect(secondCallRequest.contents[1]).toMatchObject({ role: "model" });
    expect(secondCallRequest.contents[2]).toMatchObject({ role: "user" });
  });

  it("returns 502 when the tool-call loop exceeds the safety cap", async () => {
    const { app, callToolMock } = createTestApp();
    generateContentMock.mockResolvedValue({
      functionCalls: [
        {
          id: "call-1",
          name: "fdic_search_institutions",
          args: { filters: 'STNAME:"Texas"' },
        },
      ],
      candidates: [{ content: { parts: [] } }],
    });

    const response = await request(app)
      .post("/chat")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ messages: [{ role: "user", content: "Loop forever" }] });

    expect(response.status).toBe(502);
    expect(response.body.error).toContain("limit");
    expect(callToolMock).toHaveBeenCalledTimes(5);
  });
});
