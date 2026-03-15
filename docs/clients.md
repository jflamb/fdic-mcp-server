---
title: Client Setup
nav_group: user
kicker: User Docs
summary: Configure the server in Claude Desktop, ChatGPT, Gemini CLI, or GitHub Copilot CLI, with transport-specific caveats called out.
breadcrumbs:
  - title: Overview
    url: /
  - title: User Docs
    url: /user-guide/
---

This page collects setup notes for common MCP clients.

## Before You Configure A Client

Hosted MCP endpoint:

```text
https://bankfind.jflamb.com/mcp
```

If your host supports remote MCP URLs, prefer the hosted endpoint over a local install.

Asking a model to install `https://www.npmjs.com/package/fdic-mcp-server` for you only works in agentic environments that can run commands or edit local MCP config. It is not the normal path for chat products that only accept a remote MCP URL.

## When You Need Local Installation

Prefer `npx` in client configs when you need a local server. It avoids hard-coding an install path and works across macOS, Linux, and Windows.

Run locally without a global install:

```bash
npx -y fdic-mcp-server
```

If you prefer a global install:

```bash
npm install -g fdic-mcp-server
```

Client support changes quickly. Treat the linked official docs as the source of truth.

Last verified: March 15, 2026.

## Claude Desktop

Claude Desktop supports remote MCP connectors. If you have a supported Claude plan, use the hosted endpoint instead of a local binary.

Use this hosted URL:

```text
https://bankfind.jflamb.com/mcp
```

In Claude Desktop:

1. Go to `Settings -> Connectors`.
2. Click `Add connector`.
3. Name it `FDIC BankFind`.
4. Paste `https://bankfind.jflamb.com/mcp` as the connector URL.
5. Save the connector and enable the tools you want available.

Local stdio fallback:

Use this only when you specifically need a local install or do not have access to Claude's remote connector flow.

Config file:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

Example:

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

After editing the file, restart Claude Desktop.

Official docs:
- Anthropic custom remote connectors: https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp
- Anthropic remote MCP build/deploy notes: https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers

## ChatGPT

ChatGPT Developer Mode supports MCP apps/connectors, but it expects a remote MCP server over streaming HTTP or SSE, not a local stdio process.

Use this hosted URL:

```text
https://bankfind.jflamb.com/mcp
```

In ChatGPT:

1. Go to `Settings -> Apps -> Advanced settings -> Developer mode` and enable Developer mode.
2. Open the Apps settings page and create an app for your MCP server.
3. Use `https://bankfind.jflamb.com/mcp`.
4. Refresh tools from the app details page if needed.

Notes:
- ChatGPT supports streaming HTTP and SSE for MCP apps.
- ChatGPT Developer Mode availability depends on plan and workspace settings.
- For Business and Enterprise/Edu workspaces, admins may need to allow custom apps first.

Official docs:
- OpenAI Developer Mode: https://developers.openai.com/api/docs/guides/developer-mode
- OpenAI Apps in ChatGPT help: https://help.openai.com/en/articles/11487775

## Gemini CLI

Gemini CLI supports MCP servers through `~/.gemini/settings.json` for user scope or `.gemini/settings.json` for project scope.

Hosted endpoint example:

```json
{
  "mcpServers": {
    "fdic": {
      "httpUrl": "https://bankfind.jflamb.com/mcp"
    }
  }
}
```

Use the hosted endpoint when you want the simplest setup and your Gemini CLI environment can reach a public HTTPS MCP server.

Local stdio fallback:

Config example:

```json
{
  "mcpServers": {
    "fdic": {
      "command": "npx",
      "args": ["-y", "fdic-mcp-server"],
      "trust": true
    }
  }
}
```

Verification:

```bash
gemini mcp list
```

Notes:
- Gemini CLI supports both local stdio and remote HTTP MCP servers.
- If the current folder is untrusted, local stdio MCP servers may appear disconnected until you trust the folder.

Official docs:
- Gemini CLI MCP guide: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md

## GitHub Copilot CLI

GitHub Copilot CLI supports local MCP servers through `~/.copilot/mcp-config.json`.

Config example:

```json
{
  "mcpServers": {
    "fdic": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "fdic-mcp-server"],
      "env": {},
      "tools": ["*"]
    }
  }
}
```

CLI-based setup:

```bash
/mcp add
```

Or edit the config file directly, then check:

```bash
/mcp show
```

Notes:
- The built-in GitHub MCP server is separate; these instructions are only for adding this FDIC server.
- Copilot CLI makes newly added MCP servers available immediately without a restart.

Official docs:
- GitHub Copilot CLI MCP setup: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers

## Other MCP Hosts

Many other MCP hosts accept the same basic stdio pattern:

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

Before documenting a specific host in this repo, verify:
- that it currently supports MCP
- whether it expects local stdio, remote HTTP, or both
- where its config file lives
- whether it requires a restart or explicit enable step
