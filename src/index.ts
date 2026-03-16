import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import type { Express } from "express";

import { VERSION } from "./constants.js";
import { registerInstitutionTools } from "./tools/institutions.js";
import { registerFailureTools } from "./tools/failures.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerHistoryTools } from "./tools/history.js";
import { registerFinancialTools } from "./tools/financials.js";
import { registerSodTools } from "./tools/sod.js";
import { registerDemographicsTools } from "./tools/demographics.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerPeerGroupTools } from "./tools/peerGroup.js";
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

export function createApp(): Express {
  const app = express();
  const server = createServer();
  let requestQueue = Promise.resolve();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "fdic-mcp-server", version: VERSION });
  });

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      void transport.close().catch(() => {});
    });

    // The SDK server can only connect to one transport at a time, so HTTP
    // requests reuse the same tool-registered server instance sequentially.
    const runRequest = async () => {
      try {
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
      } finally {
        await transport.close().catch(() => {});
        await server.close().catch(() => {});
      }
    };

    const queuedRequest = requestQueue.catch(() => {}).then(runRequest);
    requestQueue = queuedRequest;
    await queuedRequest;
  });

  return app;
}

async function runHTTP(): Promise<void> {
  const app = createApp();
  const port = parseHttpPort(process.env.PORT);
  app.listen(port, () => {
    console.error(
      `FDIC BankFind MCP server running on http://localhost:${port}/mcp`,
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
