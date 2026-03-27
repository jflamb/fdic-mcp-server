import { randomUUID } from "node:crypto";
import type { ChatContent } from "./chat.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import type { Express } from "express";

import { VERSION } from "./constants.js";
import {
  createChatRouter,
  parseChatAllowedOrigins,
  sweepIdleChatSessions,
} from "./chat.js";
import { registerInstitutionTools } from "./tools/institutions.js";
import { registerFailureTools } from "./tools/failures.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerHistoryTools } from "./tools/history.js";
import { registerFinancialTools } from "./tools/financials.js";
import { registerSodTools } from "./tools/sod.js";
import { registerDemographicsTools } from "./tools/demographics.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerPeerGroupTools } from "./tools/peerGroup.js";
import { registerBankHealthTools } from "./tools/bankHealth.js";
import { registerPeerHealthTools } from "./tools/peerHealth.js";
import { registerRiskSignalTools } from "./tools/riskSignals.js";
import { registerCreditConcentrationTools } from "./tools/creditConcentration.js";
import { registerFundingProfileTools } from "./tools/fundingProfile.js";
import { registerSchemaResources } from "./resources/schemaResources.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "fdic-mcp-server",
    version: VERSION,
  });

  registerInstitutionTools(server);
  registerFailureTools(server);
  registerLocationTools(server);
  registerHistoryTools(server);
  registerFinancialTools(server);
  registerSodTools(server);
  registerDemographicsTools(server);
  registerAnalysisTools(server);
  registerPeerGroupTools(server);
  registerBankHealthTools(server);
  registerPeerHealthTools(server);
  registerRiskSignalTools(server);
  registerCreditConcentrationTools(server);
  registerFundingProfileTools(server);
  registerSchemaResources(server);

  return server;
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FDIC BankFind MCP server running on stdio");
}

export function parseHttpPort(rawPort: string | undefined): number {
  const port = Number.parseInt(rawPort ?? "3000", 10);
  if (Number.isNaN(port)) {
    throw new Error(`Invalid PORT value: ${rawPort ?? ""}`);
  }
  if (port < 0 || port > 65535) {
    throw new Error(`PORT must be between 0 and 65535. Received: ${port}`);
  }
  return port;
}

export function parseHttpHost(rawHost: string | undefined): string {
  return rawHost?.trim() || "127.0.0.1";
}

export function parseAllowedOrigins(
  rawOrigins: string | undefined,
  port: number,
): string[] {
  if (rawOrigins) {
    return rawOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  return [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `https://localhost:${port}`,
    `https://127.0.0.1:${port}`,
  ];
}

interface HttpAppOptions {
  port?: number;
  allowedOrigins?: string[];
  sessionIdleTimeoutMs?: number;
  sessionSweepIntervalMs?: number;
  chatAllowedOrigins?: string[];
  geminiApiKey?: string;
  serverFactory?: () => McpServer;
}

interface SessionContext {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivityAt: number;
}

const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function closeSession(
  sessions: Map<string, SessionContext>,
  sessionId: string,
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  sessions.delete(sessionId);
  await session.server.close().catch(() => {});
  await session.transport.close().catch(() => {});
}

function touchSession(session: SessionContext, now: number): void {
  session.lastActivityAt = now;
}

async function sweepIdleSessions(
  sessions: Map<string, SessionContext>,
  idleTimeoutMs: number,
  now: number,
): Promise<void> {
  const expiredSessionIds: string[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivityAt >= idleTimeoutMs) {
      expiredSessionIds.push(sessionId);
    }
  }

  await Promise.all(
    expiredSessionIds.map((sessionId) => closeSession(sessions, sessionId)),
  );
}

function sendInvalidSessionResponse(res: express.Response): void {
  res.status(400).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Bad Request: No valid session ID provided",
    },
    id: null,
  });
}

export function createApp(options: HttpAppOptions = {}): Express {
  const app = express();
  const serverFactory = options.serverFactory ?? createServer;
  const port = options.port ?? 3000;
  const allowedOrigins =
    options.allowedOrigins ?? parseAllowedOrigins(undefined, port);
  const sessions = new Map<string, SessionContext>();
  const chatSessions = new Map<
    string,
    { history: ChatContent[]; lastActivityAt: number }
  >();
  const sessionIdleTimeoutMs =
    options.sessionIdleTimeoutMs ?? DEFAULT_SESSION_IDLE_TIMEOUT_MS;
  const sessionSweepIntervalMs =
    options.sessionSweepIntervalMs ?? DEFAULT_SESSION_SWEEP_INTERVAL_MS;
  app.use(express.json());

  const sessionSweepTimer = setInterval(() => {
    void sweepIdleSessions(sessions, sessionIdleTimeoutMs, Date.now());
    sweepIdleChatSessions(chatSessions, sessionIdleTimeoutMs, Date.now());
  }, sessionSweepIntervalMs);
  sessionSweepTimer.unref?.();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "fdic-mcp-server", version: VERSION });
  });

  app.all("/mcp", async (req, res) => {
    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;

    try {
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session) {
          res.status(404).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Session not found",
            },
            id: null,
          });
          return;
        }

        touchSession(session, Date.now());
        await session.transport.handleRequest(req, res, req.body);
        if (req.method === "DELETE") {
          await closeSession(sessions, sessionId);
        }
        return;
      }

      if (req.method !== "POST" || !isInitializeRequest(req.body)) {
        sendInvalidSessionResponse(res);
        return;
      }

      const server = serverFactory();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        allowedOrigins,
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, {
            server,
            transport,
            lastActivityAt: Date.now(),
          });
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error: unknown) {
      console.error("MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }

      if (sessionId) {
        await closeSession(sessions, sessionId);
      }
    }
  });

  app.use(
    "/chat",
    createChatRouter({
      allowedOrigins:
        options.chatAllowedOrigins ??
        parseChatAllowedOrigins(process.env.CHAT_ALLOWED_ORIGINS),
      geminiApiKey: options.geminiApiKey ?? process.env.GEMINI_API_KEY,
      sessions: chatSessions,
      serverFactory,
    }),
  );

  return app;
}

async function runHTTP(): Promise<void> {
  const port = parseHttpPort(process.env.PORT);
  const host = parseHttpHost(process.env.HOST);
  const app = createApp({
    port,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS, port),
    chatAllowedOrigins: parseChatAllowedOrigins(
      process.env.CHAT_ALLOWED_ORIGINS,
    ),
    geminiApiKey: process.env.GEMINI_API_KEY,
  });

  app.listen(port, host, () => {
    console.error(
      `FDIC BankFind MCP server running on http://${host}:${port}/mcp`,
    );
  });
}

export async function main(): Promise<void> {
  const transportMode = process.env.TRANSPORT ?? "stdio";
  if (transportMode === "http") {
    await runHTTP();
  } else {
    await runStdio();
  }
}
