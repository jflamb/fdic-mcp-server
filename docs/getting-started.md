---
title: Getting Started
nav_group: user
kicker: User Docs
summary: Start with a hosted MCP URL when your host supports it, or use the local install path when you need a stdio server on your own machine.
breadcrumbs:
  - title: Overview
    url: /
  - title: Use the Server
    url: /user-guide/
---

This server gives MCP-compatible clients access to public FDIC BankFind datasets plus built-in comparison and peer-benchmarking tools.

## Easiest Option: Use The Hosted Endpoint

If your MCP host supports connecting to a remote MCP server by URL, that is the lowest-friction way to get started because it avoids local installation entirely.

<div class="hosted-url-block">
  <p>Hosted MCP URL:</p>
  <pre><code>https://bankfind.jflamb.com/mcp</code></pre>
</div>

Use this path when:

- your host supports remote MCP URLs or hosted apps
- you want to skip local `npm` and terminal setup

Do not assume a plain chat product can install the npm package for you just from a prompt. That only works in agentic environments that can actually run shell commands or edit MCP configuration on your machine.

Examples:

- ChatGPT Developer Mode can connect to the hosted endpoint directly
- Any MCP host that accepts a public streamable HTTP MCP URL can use the same endpoint
- Local coding agents such as Codex or Claude Code may be able to install the npm package for you, but that is a separate workflow from connecting to a hosted MCP URL

If your host only supports local stdio servers, use the local install path below.

## Local Install Path

### Prerequisites

- Node.js 20 or later
- npm
- An MCP-compatible host such as Claude Desktop, ChatGPT Developer Mode, Gemini CLI, or GitHub Copilot CLI

### Install

Run directly without a global install:

```bash
npx fdic-mcp-server
```

Install globally:

```bash
npm install -g fdic-mcp-server
fdic-mcp-server
```

Install from source:

```bash
git clone https://github.com/jflamb/fdic-mcp-server.git
cd fdic-mcp-server
npm install
npm run build
```

### Run The Server

Stdio transport:

```bash
node dist/index.js
```

HTTP transport:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

The HTTP MCP endpoint is available at `http://127.0.0.1:3000/mcp` by default.

The Docker image and Cloud Run deployment use port `8080` by default; `3000` is the local shell example for direct runs outside the container. Advanced transport and deployment details live in the repository reference docs.

### Connect A Client

Use the client-specific instructions in [Client Setup]({{ '/clients/' | relative_url }}).

For remote-URL hosts, use:

```text
https://bankfind.jflamb.com/mcp
```

For most local MCP hosts, the minimal stdio configuration looks like this:

```json
{
  "mcpServers": {
    "fdic": {
      "command": "npx",
      "args": ["-y", "fdic-mcp-server"]
    }
  }
}
```

### Verify It Works

Try a simple prompt in your MCP host:

```text
Find active FDIC-insured banks in North Carolina with more than $1 billion in assets.
```

Expected behavior:

- the model should return matching North Carolina institutions
- the results should focus on active banks above the requested asset threshold
