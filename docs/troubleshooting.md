---
title: Troubleshooting And FAQ
---

# Troubleshooting And FAQ

## Quick Checks

Before debugging a client-specific issue, verify:

- Node.js is version 18 or later
- the package is installed or the local build exists
- the MCP host supports the transport you configured
- your client config points at the correct binary or HTTP URL
- your prompt matches the FDIC dataset and time basis you actually need

## FAQ

### Why does ChatGPT not connect to my local binary?

ChatGPT Developer Mode expects a remotely reachable MCP server over HTTP or SSE. A local stdio command such as `/opt/homebrew/bin/fdic-mcp-server` is not enough by itself.

Use the server's HTTP transport:

```bash
TRANSPORT=http PORT=3000 fdic-mcp-server
```

Then expose it through a reachable HTTPS URL.

### Why do I get no results for a bank I know exists?

Common causes:

- the filter field is wrong for that dataset
- the bank is inactive and you filtered on `ACTIVE:1`
- the report date is outside the relevant range
- you are using SOD-style branch questions against a quarterly dataset

### Why do results look inconsistent across tools?

The datasets answer different questions and do not all update on the same schedule.

- financials, summary, and demographics are quarterly
- SOD is annual branch-level data as of June 30
- failures and history use their own event dates

If you compare across datasets, state the date basis clearly.

### Why does a comparison return warnings?

Warnings usually mean the server detected incomplete or potentially misleading analysis conditions, such as a truncated roster or missing values for some institutions.

The tool still returns data, but you should read the warnings before drawing conclusions.

### Why does peer group ranking denominator change by metric?

Rankings are metric-specific. If some peers do not have a valid value for ROA, efficiency ratio, or another metric, they are excluded from that metric's denominator.

## Troubleshooting By Symptom

### The MCP host says the server failed to start

Check:

- whether the command path exists
- whether the package was installed under a different npm prefix
- whether you built the project before pointing a client at `dist/index.js`

Useful commands:

```bash
which fdic-mcp-server
node dist/index.js
```

### The HTTP client connects but tool calls fail

Check:

- that the server is running with `TRANSPORT=http`
- that the MCP endpoint is `/mcp`
- that the client sends `Content-Type: application/json`
- that the client accepts both `application/json` and `text/event-stream`

### The model keeps choosing the wrong tool

Improve the prompt by stating:

- whether you want raw records or analysis
- whether you already know the `CERT`
- the date basis
- the ranking metric or geography

See [Prompting Guide](./prompting-guide.md) and [Tool Reference](./tool-reference.md).

### I asked about branches and got quarterly figures instead

You likely needed SOD or demographics data instead of quarterly financials.

- Use `fdic_search_sod` for branch deposit totals
- Use `fdic_search_demographics` for office counts and market-structure fields
- Use `fdic_search_locations` for branch records

### A local client cannot find the binary after global install

Your npm global prefix may differ from the examples. Run:

```bash
npm prefix -g
which fdic-mcp-server
```

Then update the client configuration with the actual binary path.

## Still Stuck

- Review [Client Setup](./clients.md)
- Review [Support](./support.md)
- Open an issue with the exact MCP host, transport, prompt, and observed error
