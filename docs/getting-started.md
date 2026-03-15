---
title: Getting Started
nav_group: user
kicker: User Docs
summary: Start with a hosted MCP URL when your host supports it, or use the local install path when you need a stdio server on your own machine.
breadcrumbs:
  - title: Overview
    url: /
  - title: User Docs
    url: /user-guide/
---

This server gives MCP-compatible clients access to public FDIC BankFind datasets and a set of server-side analysis tools for comparing institutions and peer groups.

## Easiest Option: Use A Hosted MCP URL

If your MCP host supports connecting to a remote MCP server by URL, that is the lowest-friction way to get started because it avoids local installation entirely.

Use this path when:

- your host supports remote MCP URLs or hosted apps
- you already have a deployed HTTPS copy of this server
- you want to skip local `npm` and terminal setup

Current example:

- ChatGPT Developer Mode can connect to a remote MCP server URL, as covered in the client setup guidance

If you do not have a deployed URL, or your host only supports local stdio servers, use the local install path below.

## Local Install Path

### Prerequisites

- Node.js 18 or later
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

The HTTP MCP endpoint is available at `http://localhost:3000/mcp`.

### Connect A Client

Use the client-specific instructions in [Client Setup]({{ '/clients/' | relative_url }}).

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

- the model should call `fdic_search_institutions`
- filters should include `STNAME:"North Carolina"`, `ACTIVE:1`, and `ASSET:[1000000 TO *]`
- results should come back with both human-readable output and machine-readable `structuredContent`

## What To Read Next

- [Prompting Guide]({{ '/prompting-guide/' | relative_url }})
- [Usage Examples]({{ '/usage-examples/' | relative_url }})
- [Technical Specification]({{ '/technical/specification/' | relative_url }})
