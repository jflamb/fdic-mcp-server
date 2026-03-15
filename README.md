# FDIC BankFind MCP Server

An MCP (Model Context Protocol) server that provides access to the [FDIC BankFind Suite API](https://api.fdic.gov/banks/docs/), giving LLMs programmatic access to public data on FDIC-insured financial institutions.

## Features

- **No API key required** — The FDIC BankFind API is publicly available
- **11 tools** covering BankFind datasets plus a built-in comparative analysis tool
- **Flexible ElasticSearch-style filtering** on all endpoints
- **Pagination support** for large result sets
- **Dual transport**: stdio (local) or HTTP (remote)
- **Structured tool output** via `structuredContent` for MCP clients
- **Built-in analytical batching** for multi-bank comparisons
- **Short-lived response caching** for repeated analytical prompts

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
| `fdic_compare_bank_snapshots` | Compare two reporting snapshots across banks and rank growth/profitability changes |

Two tools are convenience lookups rather than separate BankFind datasets:
- `fdic_get_institution` wraps the `institutions` dataset
- `fdic_get_institution_failure` wraps the `failures` dataset

One tool is a server-side analysis helper:
- `fdic_compare_bank_snapshots` batches roster lookup, financial snapshots, and optional demographics snapshots inside the MCP server so complex trend prompts do not require many separate tool calls
- It supports both `snapshot` comparisons and `timeseries` analysis across a quarterly range
- It computes derived efficiency and balance-sheet metrics and assigns insight tags for notable growth patterns

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

**Rank banks by growth across two dates without orchestrating many separate queries:**
```
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
sort_by: asset_growth
sort_order: DESC
(fdic_compare_bank_snapshots)
```

**Analyze quarterly trends with streaks and derived metrics:**
```
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
analysis_mode: timeseries
sort_by: asset_growth_pct
sort_order: DESC
(fdic_compare_bank_snapshots)
```

## Complex Prompts

The built-in `fdic_compare_bank_snapshots` tool is meant to make analysis-heavy prompts performant by batching FDIC calls inside the MCP server. The server also caches repeated state/date lookups for a short period, which helps iterative analysis. Good examples:

- Identify North Carolina banks with the strongest asset growth from 2021 to 2025, then compare whether that growth came with higher deposits, more branches, or better profitability
- Rank a set of banks by deposit growth percentage between two report dates and check which ones also improved ROA or ROE
- Compare current active banks in a state between two snapshots to see which institutions grew while reducing office counts
- Analyze whether rapid asset growth was accompanied by stronger profitability or just balance-sheet expansion
- Analyze quarterly trends from 2021 through 2025 and call out inflection points, sustained asset-growth streaks, or multi-quarter ROA declines
- Identify banks whose deposits-per-office and assets-per-office improved even while total branch counts fell
- Separate banks with branch-supported growth from banks that mainly expanded their balance sheets

The tool can take either:
- `state` plus optional `institution_filters` to build a roster
- `certs` to compare a specific list of institutions directly

Notable outputs from `fdic_compare_bank_snapshots`:
- point-to-point changes for assets, deposits, net income, ROA, ROE, and office counts
- derived metrics such as `assets_per_office_change`, `deposits_per_office_change`, and `deposits_to_assets_change`
- insight tags such as `growth_with_better_profitability`, `growth_with_branch_expansion`, `balance_sheet_growth_without_profitability`, and `growth_with_branch_consolidation`
- in `timeseries` mode, quarterly series plus streak metrics like sustained asset growth and multi-quarter ROA decline

## Response Shape

All tools return:
- a human-readable text representation in `content[0].text`
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
