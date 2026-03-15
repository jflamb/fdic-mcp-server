---
title: Client Setup
---

# Client Setup

This page collects setup notes for common MCP clients.

## Before You Configure A Client

Install the published package:

```bash
npm install -g fdic-mcp-server
```

On this machine, that installs the binary at:

```bash
/opt/homebrew/bin/fdic-mcp-server
```

If your global npm prefix differs, adjust the path accordingly.

Client support changes quickly. Treat the linked official docs as the source of truth.

Last verified: March 15, 2026.

## Claude Desktop

Config file:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

Example:

```json
{
  "mcpServers": {
    "fdic": {
      "command": "/opt/homebrew/bin/fdic-mcp-server"
    }
  }
}
```

After editing the file, restart Claude Desktop.

## ChatGPT

ChatGPT Developer Mode supports MCP apps/connectors, but it expects a remote MCP server over streaming HTTP or SSE, not a local stdio process. This means you cannot point ChatGPT directly at `/opt/homebrew/bin/fdic-mcp-server` unless you expose it through the server's HTTP transport.

Run the server over HTTP:

```bash
TRANSPORT=http PORT=3000 /opt/homebrew/bin/fdic-mcp-server
```

Then expose it at a reachable HTTPS URL, for example through a tunnel or your own deployment.

In ChatGPT:

1. Go to `Settings -> Apps -> Advanced settings -> Developer mode` and enable Developer mode.
2. Open the Apps settings page and create an app for your MCP server.
3. Use your remote MCP URL.
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

Config example:

```json
{
  "mcpServers": {
    "fdic": {
      "command": "/opt/homebrew/bin/fdic-mcp-server",
      "trust": true
    }
  }
}
```

CLI-based setup:

```bash
gemini mcp add -s user --trust fdic /opt/homebrew/bin/fdic-mcp-server
```

Verification:

```bash
gemini mcp list
```

Notes:
- Gemini CLI uses stdio for local MCP servers by default.
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
      "command": "/opt/homebrew/bin/fdic-mcp-server",
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
      "command": "/opt/homebrew/bin/fdic-mcp-server"
    }
  }
}
```

Before documenting a specific host in this repo, verify:
- that it currently supports MCP
- whether it expects local stdio, remote HTTP, or both
- where its config file lives
- whether it requires a restart or explicit enable step
