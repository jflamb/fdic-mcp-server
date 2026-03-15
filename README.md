# FDIC BankFind MCP Server

An MCP (Model Context Protocol) server that provides access to the [FDIC BankFind Suite API](https://api.fdic.gov/banks/docs/), giving LLMs programmatic access to public data on FDIC-insured financial institutions.

## Features

- **No API key required** — The FDIC BankFind API is publicly available
- **10 tools** covering all BankFind dataset endpoints
- **Flexible ElasticSearch-style filtering** on all endpoints
- **Pagination support** for large result sets
- **Dual transport**: stdio (local) or HTTP (remote)
- **Structured tool output** via `structuredContent` for MCP clients

## Available Tools

| Tool | Description |
|------|-------------|
| `fdic_search_institutions` | Search FDIC-insured banks and savings institutions |
| `fdic_get_institution` | Get details for a specific institution by CERT number |
| `fdic_search_failures` | Search failed bank records |
| `fdic_get_institution_failure` | Get failure details for a specific institution |
| `fdic_search_locations` | Search branch/office locations |
| `fdic_search_history` | Search structural change events (mergers, name changes, etc.) |
| `fdic_search_financials` | Search quarterly Call Report financial data |
| `fdic_search_summary` | Search annual financial summary data |
| `fdic_search_sod` | Search Summary of Deposits (branch-level deposit data) |
| `fdic_search_demographics` | Search quarterly demographics and market-structure data |

Two tools are convenience lookups rather than separate BankFind datasets:
- `fdic_get_institution` wraps the `institutions` dataset
- `fdic_get_institution_failure` wraps the `failures` dataset

## Filter Syntax

All tools support ElasticSearch query string syntax for filtering:

```
# Exact match
NAME:"Chase Bank"

# State filter
STNAME:"California"

# Numeric range (assets in $thousands)
ASSET:[1000000 TO *]

# Date range
FAILDATE:[2008-01-01 TO 2010-12-31]

# Combine with AND / OR
STNAME:"Texas" AND ACTIVE:1 AND ASSET:[500000 TO *]

# Exclude
!(BKCLASS:NM OR BKCLASS:N)
```

Field names vary by dataset. For example:
- `institutions` commonly uses fields like `STNAME`, `ASSET`, `ACTIVE`
- `failures` commonly uses fields like `FAILDATE`, `COST`, `RESTYPE`
- `locations` commonly uses fields like `STALP`, `CITY`, `BRNUM`
- `sod` commonly uses fields like `STALPBR`, `CITYBR`, `DEPSUMBR`

Use the tool description or `fields` parameter to tailor queries to the dataset you are calling.

## Installation

```bash
npm install
npm run build
```

## Development

```bash
npm run typecheck
npm test
npm run build
```

## CI And Releases

- Pull requests should target `main`
- Continuous integration runs on pushes to `main` and on pull requests targeting `main`
- Package publish is reserved for semantic version tags like `v1.2.3`
- Release tags must point at a commit already on `main`

To prepare a release:

```bash
npm version patch
git push origin main --follow-tags
```

Publishing from GitHub Actions is intended to use npm trusted publishing via GitHub Actions OIDC rather than a long-lived `NPM_TOKEN`.

### Local Secrets With direnv

To keep tokens local to this repo without committing them:

```bash
cp .envrc.example .envrc
$EDITOR .envrc
direnv allow
```

Example `.envrc` entry:

```bash
export GITHUB_TOKEN="your_pat_here"
```

The repo ignores `.envrc`, `.envrc.local`, and `.env` so local secrets stay untracked.

## Usage

### CLI bundle

The build produces two outputs:
- `dist/index.js`: CLI entrypoint for stdio/HTTP server execution
- `dist/server.js`: import-safe library bundle exporting `createServer`, `createApp`, and `main`

### stdio (for Claude Desktop / local MCP clients)

```bash
node dist/index.js
```

**Claude Desktop config** (`~/Library/Application\ Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "fdic": {
      "command": "node",
      "args": ["/path/to/fdic-mcp-server/dist/index.js"]
    }
  }
}
```

### HTTP server

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

The MCP endpoint will be available at `http://localhost:3000/mcp`.

For direct HTTP MCP clients, include:
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`

The streamable HTTP transport expects both response types to be accepted.

## Example Queries

**Find all active banks in North Carolina with assets over $1 billion:**
```
filters: STNAME:"North Carolina" AND ACTIVE:1 AND ASSET:[1000000 TO *]
```

**Get the 10 costliest bank failures since 2000:**
```
filters: FAILDATE:[2000-01-01 TO *]
sort_by: COST
sort_order: DESC
limit: 10
```

**Get all branches of a specific bank:**
```
cert: 3511
(fdic_search_locations)
```

**Get quarterly financials for Bank of America for 2023:**
```
cert: 3511
filters: REPDTE:[20230101 TO 20231231]
(fdic_search_financials)
```

**Get demographics history for a bank:**
```
cert: 3511
sort_by: REPDTE
sort_order: DESC
(fdic_search_demographics)
```

## Response Shape

All tools return:
- human-readable JSON in `content[0].text`
- machine-readable data in `structuredContent`

Typical search response shape:

```json
{
  "total": 1,
  "offset": 0,
  "count": 1,
  "has_more": false,
  "institutions": [
    {
      "CERT": 3511,
      "NAME": "Wells Fargo Bank, National Association"
    }
  ]
}
```

Typical lookup miss response shape:

```json
{
  "found": false,
  "cert": 999999999,
  "message": "No institution found with CERT number 999999999."
}
```

## Data Notes

- Monetary values are in **$thousands** unless otherwise noted
- The `CERT` field is the unique FDIC Certificate Number for each institution
- The `ACTIVE` field: `1` = currently active, `0` = inactive/closed
- Report dates (`REPDTE`) are in `YYYYMMDD` format
- The financials endpoint covers **1,100+ Call Report variables** — use `fields` to narrow results
- `fdic_search_financials` defaults to `sort_order: DESC` for most-recent-first results
- Most other search tools default to `sort_order: ASC`
- The demographics endpoint is useful for office counts, metro/micro flags, territory assignments, and related geographic reference attributes
- The demographics dataset is quarterly historical data, not just a current snapshot
