# Self-Hosted HTTP Deployment

The project distributes an npm package and container build recipe. It does not operate a public MCP endpoint or website chatbot. GitHub Pages serves static documentation.

## Local stdio

Configure your MCP client to run `npx -y fdic-mcp-server`. Node.js 20 or later is required. No FDIC API credentials are needed.

## Local HTTP

```bash
TRANSPORT=http PORT=3000 npx -y fdic-mcp-server
```

Connect to `http://127.0.0.1:3000/mcp`; `/health` reports process health. HTTP binds to loopback by default. The retired `/chat` route is not part of the server.

## Containers

From a repository checkout:

```bash
docker build -t fdic-mcp-server .
docker run --rm -p 127.0.0.1:8080:8080 fdic-mcp-server
```

The container uses `TRANSPORT=http`, `HOST=0.0.0.0`, and `PORT=8080`. The example exposes it only on the host's loopback interface. A `VERSION` Docker build argument can identify your build.

## Remote clients

Operators supply their own HTTPS endpoint ending in `/mcp`. A cloud client cannot reach another machine's loopback address. Configure TLS, access controls, and any reverse proxy before exposing it remotely.

Set `ALLOWED_HOSTS` to the comma-separated endpoint hostnames, without schemes or ports (for example, `mcp.example.com,localhost,127.0.0.1`). Its default is `localhost,127.0.0.1,[::1]`; changing the bind address with `HOST` does not change this allowlist. `ALLOWED_ORIGINS` is a separate comma-separated allowlist of exact browser origins. Its defaults are HTTP and HTTPS origins for `localhost` and `127.0.0.1` on the configured port. Requests without an `Origin` header remain allowed. Neither allowlist provides authentication.

## Stateless protocol and upgrading

Both stdio and HTTP support MCP `2026-07-28` through the TypeScript SDK v2 serving helpers. Modern clients discover the server with `server/discover` and include protocol metadata with each request. HTTP requests need no initialization, `MCP-Session-Id`, or sticky routing: successive requests can reach different instances. The SDK also handles older clients using their existing initialization exchange, without creating an HTTP session.

HTTP accepts MCP requests at `POST /mcp`. The default response is JSON; request-scoped progress notifications switch that POST response to SSE until the terminal result arrives. Standalone `GET /mcp` streams and `DELETE /mcp` session teardown return 405. The inbound JSON body limit remains 100 KiB.

`MCP_RATE_LIMIT_MAX_REQUESTS_PER_MINUTE` continues to control per-process request throttling. `MCP_BLOCKED_IPS` accepts explicit IPs or CIDR ranges. Preserve the correct client IP at your trusted proxy boundary. These local controls do not coordinate across instances; any deployment-wide limits belong at your gateway.

The `FDIC_MCP_STATELESS_HTTP` opt-in and the old `MCP_STREAM_RATE_LIMIT_MAX_REQUESTS_PER_HOUR` / `MCP_MAX_CONCURRENT_STREAMS_PER_IP` settings are retired. Stateless serving is always enabled; there is no session expiration or standalone GET stream to configure.

For applications importing the package, this is a major API change: `createServer()` returns the SDK v2 `McpServer` from `@modelcontextprotocol/server`, and `createApp()` no longer accepts session or standalone-stream options. Tool names, arguments, profiles, and result contracts are preserved. Existing integrations must migrate SDK imports and avoid passing v1 SDK objects to the v2 API. Custom hosting should pass the server factory to `serveStdio()` from `@modelcontextprotocol/server/stdio`, or `createMcpHandler()` from `@modelcontextprotocol/server` wrapped with `toNodeHandler()` from `@modelcontextprotocol/node` for Node HTTP. Connecting `createServer()` directly to a legacy transport does not enable the modern protocol.

## Publishing

CI continues to validate Node 20/22 and Docker builds. Releases publish the package and stdio MCP Registry metadata. Pages publishes the documentation. There is no automated Cloud Run deployment.
