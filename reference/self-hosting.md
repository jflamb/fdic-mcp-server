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

Operators supply their own HTTPS endpoint ending in `/mcp`. A cloud client cannot reach another machine's loopback address. Configure TLS, access controls, and any reverse proxy for your deployment before exposing it remotely. `ALLOWED_ORIGINS` is a comma-separated browser-origin allowlist, not authentication.

This release preserves the existing session-based HTTP protocol: initialize once, then reuse `MCP-Session-Id` on subsequent requests. If multiple instances serve it, requests for an existing session must reach the instance holding that session. `FDIC_MCP_STATELESS_HTTP=true` selects the existing SDK's stateless JSON mode; it does not upgrade the protocol to the new stateless MCP specification. The protocol migration is separate.

MCP throttling remains configurable with `MCP_RATE_LIMIT_MAX_REQUESTS_PER_MINUTE`, `MCP_STREAM_RATE_LIMIT_MAX_REQUESTS_PER_HOUR`, and `MCP_MAX_CONCURRENT_STREAMS_PER_IP`. `MCP_BLOCKED_IPS` accepts explicit IPs or CIDR ranges. Preserve the correct client IP at your trusted proxy boundary.

## Publishing

CI continues to validate Node 20/22 and Docker builds. Releases publish the package and stdio MCP Registry metadata. Pages publishes the documentation. There is no automated Cloud Run deployment.
