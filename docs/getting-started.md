---
title: Getting Started
nav_group: setup
kicker: Setup
summary: Install a local MCP server or operate your own HTTP endpoint.
breadcrumbs:
  - title: Overview
    url: /
  - title: Setup
    url: /setup/
---

This server gives MCP-compatible clients access to public FDIC BankFind datasets plus built-in comparison and peer-benchmarking tools.

## Local Installation

The project-operated public endpoint and website chatbot are retired. Use local stdio in a compatible client, or supply your own reachable HTTP endpoint. A chat product that only accepts remote URLs cannot launch a local npm package.


### Prerequisites

- Node.js 20 or later
- npm
- An MCP-compatible host that can launch a local stdio process

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

The Docker image uses port `8080` by default; `3000` is the local shell example for direct runs outside the container. Advanced transport and deployment details live in the repository reference docs.

### Connect A Client

Use the client-specific instructions in [Client Setup]({{ '/clients/' | relative_url }}).

For remote-URL hosts, supply your own reachable HTTPS endpoint ending in `/mcp`. Your local loopback URL is not reachable from a cloud-hosted client.

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
