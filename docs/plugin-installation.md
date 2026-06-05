---
title: Plugin Installation
nav_group: setup
kicker: Setup
summary: Install the BankFind MCP Server as a plugin in Codex or Claude Code so the MCP tools and guided skills load together.
breadcrumbs:
  - title: Overview
    url: /
  - title: Setup
    url: /setup/
---

Use a plugin when your coding agent supports plugins and you want the BankFind MCP tools plus the guided analysis skills in one package.

If your host only needs MCP tools, or it does not support plugins, use [Client Setup]({{ '/clients/' | relative_url }}) instead.

Plugin skills are not Claude-only. Codex and Claude Code can both load guided skills through their plugin systems, although the exact skill list can differ by host.

## What The Plugin Adds

- **MCP tools** for FDIC BankFind search, lookups, comparisons, risk signals, branch data, failures, and peer analysis
- **Guided skills** for workflows such as Portfolio Surveillance and Failure Forensics
- **Shared repo guidance** so coding agents use the FDIC data conventions and MCP tool contracts correctly

The hosted MCP endpoint is still the fastest transport for most users:

```text
https://bankfind.jflamb.com/mcp
```

Use a local stdio transport only when you need to test source changes from a checkout.

## Install In Claude Code

Claude Code can install this repository as a plugin from its marketplace flow.

Add the marketplace:

```text
/plugin marketplace add jflamb/fdic-mcp-server
```

Install the plugin:

```text
/plugin install fdic-mcp-server@fdic-mcp-server
```

After installation, Claude Code should have access to:

- the hosted MCP tools at `https://bankfind.jflamb.com/mcp`
- plugin skills such as Bank Deep Dive, Examiner Support, Portfolio Surveillance, and Failure Forensics

To use a local server instead of the hosted endpoint, override the MCP server after installing the plugin:

```bash
claude mcp add fdic -- npx -y fdic-mcp-server
```

## Install In Codex

Codex uses a local plugin package. This repository includes a sync helper that builds that package from the current checkout.

From the repository root:

```bash
npm install
npm run plugin:sync
```

By default, the helper writes the plugin to:

```text
~/plugins/fdic-mcp-server
```

Then install `fdic-mcp-server` from your personal marketplace in the Codex app.

The generated plugin contains:

```text
.codex-plugin/plugin.json
.mcp.json
.mcp.local-stdio.example.json
skills/
```

The active `.mcp.json` uses the hosted HTTP endpoint by default. To generate a plugin that points at this local checkout instead, run:

```bash
npm run plugin:sync -- --transport stdio
```

Before using the local stdio variant, build the checkout:

```bash
npm run build
npm start
```

## Keep A Local Plugin Current

Run the sync helper again whenever repository skills, plugin metadata, or the MCP transport config changes:

```bash
npm run plugin:sync
```

For local development plugins, rebuild after TypeScript changes:

```bash
npm run build
```

## Related Setup Paths

- [Client Setup]({{ '/clients/' | relative_url }}) covers host-specific MCP configuration.
- [Skills]({{ '/skills/' | relative_url }}) explains the guided workflows included with plugin-aware agents.
- [Troubleshooting And FAQ]({{ '/troubleshooting/' | relative_url }}) covers startup, transport, and hosted endpoint issues.
