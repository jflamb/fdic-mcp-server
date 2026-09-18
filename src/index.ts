import { hostHeaderValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import express from "express";
import type { Express } from "express";

import { VERSION } from "./constants.js";
import { RateLimiter } from "./chatRateLimit.js";
import {
  getRequestIp,
  isBlockedIp,
  parseBlockedIpRules,
  type IpBlockRule,
} from "./requestIdentity.js";
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
import { registerSecuritiesPortfolioTools } from "./tools/securitiesPortfolio.js";
import { registerUbprAnalysisTools } from "./tools/ubprAnalysis.js";
import { registerMarketShareAnalysisTools } from "./tools/marketShareAnalysis.js";
import { registerFranchiseFootprintTools } from "./tools/franchiseFootprint.js";
import { registerHoldingCompanyProfileTools } from "./tools/holdingCompanyProfile.js";
import { registerRegionalContextTools } from "./tools/regionalContext.js";
import { registerQbpLiteTools } from "./tools/qbpLite.js";
import { registerChatGptRetrievalTools } from "./tools/chatgptRetrieval.js";
import { registerChatGptBankDeepDiveTool } from "./tools/chatgptBankDeepDive.js";
import { registerChatGptAppResources } from "./resources/chatgptAppResources.js";
import { registerSchemaResources } from "./resources/schemaResources.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";

export type FdicMcpProfile =
  | "core"
  | "analysis"
  | "chatgpt"
  | "chatgpt-canonical"
  | "chatgpt-aliases";

export interface CreateServerOptions {
  /**
   * Comma-separated profile selector. Default `all` registers everything.
   * Recognized tokens: `core`, `analysis`, `chatgpt`, `chatgpt-canonical`,
   * `chatgpt-aliases`, `prompts`, `resources`, `all`. Anything outside this
   * list is ignored. Pass `chatgpt-aliases` to drop the un-prefixed
   * `search`/`fetch` names while keeping the namespaced `fdic_search`/
   * `fdic_fetch` aliases — useful in mixed-connector Claude environments.
   */
  profile?: string;
}

interface ResolvedProfile {
  core: boolean;
  analysis: boolean;
  chatgptCanonical: boolean;
  chatgptAliases: boolean;
  chatgptDeepDive: boolean;
  prompts: boolean;
  resources: boolean;
}

export function resolveProfile(raw: string | undefined): ResolvedProfile {
  const tokens = (raw ?? "all")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  const has = (token: string) => tokens.includes(token);
  const all = has("all") || tokens.length === 0;

  const includeChatgpt = all || has("chatgpt");
  return {
    core: all || has("core"),
    analysis: all || has("analysis"),
    chatgptCanonical:
      all || includeChatgpt || has("chatgpt-canonical"),
    chatgptAliases:
      all || includeChatgpt || has("chatgpt-aliases"),
    chatgptDeepDive: all || includeChatgpt,
    prompts: all || has("prompts"),
    resources: all || has("resources"),
  };
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({
    name: "fdic-mcp-server",
    version: VERSION,
  });

  const profile = resolveProfile(options.profile ?? process.env.FDIC_MCP_PROFILE);

  if (profile.core) {
    registerInstitutionTools(server);
    registerFailureTools(server);
    registerLocationTools(server);
    registerHistoryTools(server);
    registerFinancialTools(server);
    registerSodTools(server);
    registerDemographicsTools(server);
  }

  if (profile.analysis) {
    registerAnalysisTools(server);
    registerPeerGroupTools(server);
    registerBankHealthTools(server);
    registerPeerHealthTools(server);
    registerRiskSignalTools(server);
    registerCreditConcentrationTools(server);
    registerFundingProfileTools(server);
    registerSecuritiesPortfolioTools(server);
    registerUbprAnalysisTools(server);
    registerMarketShareAnalysisTools(server);
    registerFranchiseFootprintTools(server);
    registerHoldingCompanyProfileTools(server);
    registerRegionalContextTools(server);
    registerQbpLiteTools(server);
  }

  if (profile.chatgptCanonical || profile.chatgptAliases) {
    registerChatGptRetrievalTools(server, {
      includeCanonicalNames: profile.chatgptCanonical,
      includeNamespacedAliases: profile.chatgptAliases,
    });
  }

  if (profile.chatgptDeepDive) {
    registerChatGptBankDeepDiveTool(server);
    registerChatGptAppResources(server);
  }

  if (profile.resources) {
    registerSchemaResources(server);
  }

  if (profile.prompts) {
    registerWorkflowPrompts(server);
  }

  return server;
}

async function runStdio(): Promise<void> {
  serveStdio(() => createServer(), {
    onerror: (error) => console.error("MCP stdio error:", error),
  });
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
  allowedHosts?: string[];
  mcpRateLimiter?: RateLimiter;
  mcpBlockedIpRules?: IpBlockRule[];
  serverFactory?: () => McpServer;
}

const DEFAULT_MCP_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_MCP_RATE_LIMIT_WINDOW_MS = 60_000;

export function parseAllowedHosts(rawHosts: string | undefined): string[] {
  return rawHosts === undefined
    ? ["localhost", "127.0.0.1", "[::1]"]
    : rawHosts.split(",").map((host) => host.trim()).filter(Boolean);
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallback: number,
  name: string,
): number {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer. Received: ${rawValue}`);
  }

  return value;
}

function sendMcpRateLimitResponse(
  res: express.Response,
  retryAfterSeconds: number,
): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Rate limit exceeded. Try again shortly.",
    },
    id: null,
  });
}

function sendMcpBlockedIpResponse(res: express.Response): void {
  res.status(403).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Forbidden client IP.",
    },
    id: null,
  });
}

export function createApp(options: HttpAppOptions = {}): Express {
  const app = express();
  const serverFactory = options.serverFactory ?? (() => createServer());
  const port = options.port ?? 3000;
  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins(undefined, port);
  const validateHost = hostHeaderValidation(
    options.allowedHosts ?? parseAllowedHosts(process.env.ALLOWED_HOSTS),
  );
  const mcpRateLimiter = options.mcpRateLimiter ?? new RateLimiter({
    maxRequests: parsePositiveInteger(
      process.env.MCP_RATE_LIMIT_MAX_REQUESTS_PER_MINUTE,
      DEFAULT_MCP_RATE_LIMIT_MAX_REQUESTS,
      "MCP_RATE_LIMIT_MAX_REQUESTS_PER_MINUTE",
    ),
    windowMs: DEFAULT_MCP_RATE_LIMIT_WINDOW_MS,
  });
  const mcpBlockedIpRules = options.mcpBlockedIpRules ?? parseBlockedIpRules(process.env.MCP_BLOCKED_IPS);
  const handler = toNodeHandler(createMcpHandler(serverFactory), {
    onerror: (error) => console.error("MCP request error:", error),
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "fdic-mcp-server", version: VERSION });
  });

  app.all("/mcp", (req, res, next) => {
    if (!validateHost(req, res)) return;
    const origin = req.headers.origin;
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      res.status(403).json({
        jsonrpc: "2.0", error: { code: -32000, message: "Forbidden Origin." }, id: null,
      });
      return;
    }
    const requestIp = getRequestIp(req);
    if (isBlockedIp(requestIp, mcpBlockedIpRules)) {
      sendMcpBlockedIpResponse(res);
      return;
    }
    if (!mcpRateLimiter.check(requestIp)) {
      sendMcpRateLimitResponse(res, Math.ceil(DEFAULT_MCP_RATE_LIMIT_WINDOW_MS / 1000));
      return;
    }
    next();
  }, express.json({ limit: "100kb" }), async (req, res) => {
    // Express has consumed the body; pass it explicitly to the SDK adapter.
    await handler(req, res, req.body);
  });

  return app;
}

async function runHTTP(): Promise<void> {
  const port = parseHttpPort(process.env.PORT);
  const host = parseHttpHost(process.env.HOST);
  const app = createApp({
    port,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS, port),
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
