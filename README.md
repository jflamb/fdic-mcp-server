# FDIC BankFind MCP Server

An MCP (Model Context Protocol) server that provides access to the [FDIC BankFind Suite API](https://api.fdic.gov/banks/docs/), giving LLMs programmatic access to public data on FDIC-insured financial institutions.

## Features

- **No API key required** — The FDIC BankFind API is publicly available
- **12 tools** covering BankFind datasets plus built-in analytical tools
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
| `fdic_peer_group_analysis` | Build a peer group and rank an institution against peers on financial metrics |

Two tools are server-side analysis helpers:
- `fdic_compare_bank_snapshots` batches roster lookup, financial snapshots, and optional demographics snapshots inside the MCP server so complex trend prompts do not require many separate tool calls
- `fdic_peer_group_analysis` builds a peer group from asset size, charter class, and geography criteria, then ranks an institution against peers on financial and efficiency metrics

Two tools are convenience lookups rather than separate BankFind datasets:
- `fdic_get_institution` wraps the `institutions` dataset
- `fdic_get_institution_failure` wraps the `failures` dataset

`fdic_compare_bank_snapshots` supports both `snapshot` comparisons and `timeseries` analysis across a quarterly range. It computes derived efficiency and balance-sheet metrics and assigns insight tags for notable growth patterns

## Filter Syntax

All tools support ElasticSearch query string syntax for filtering:

```
# Exact match
NAME:"Chase Bank"

# State filter
STNAME:"California"

# Numeric range (assets in $thousands)
ASSET:[1000000 TO *]

# Date range (hyphenated format for failures/history datasets)
FAILDATE:[2008-01-01 TO 2010-12-31]

# Date range (compact YYYYMMDD format for financials/demographics/summary datasets)
REPDTE:[20230101 TO 20231231]

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

### From npm

Run directly without a global install:

```bash
npx fdic-mcp-server
```

Or install globally:

```bash
npm install -g fdic-mcp-server
fdic-mcp-server
```

### From GitHub Packages

The GitHub Packages mirror is published as `@jflamb/fdic-mcp-server`.

```bash
npm install -g @jflamb/fdic-mcp-server --registry=https://npm.pkg.github.com
fdic-mcp-server
```

### From source

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

Client-specific setup notes for Claude Desktop, ChatGPT, Gemini CLI, and GitHub Copilot CLI are in [docs/clients.md](./docs/clients.md).

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
      "command": "npx",
      "args": ["-y", "fdic-mcp-server"]
    }
  }
}
```

If running from a local clone instead of the npm package:

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

**Rank banks by growth across two snapshots (default `analysis_mode: snapshot`):**
```
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
sort_by: asset_growth
sort_order: DESC
(fdic_compare_bank_snapshots)
```

**Analyze quarterly trends with streaks and derived metrics (`analysis_mode: timeseries`):**
```
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
analysis_mode: timeseries
sort_by: asset_growth_pct
sort_order: DESC
(fdic_compare_bank_snapshots)
```

**Find peers for a specific bank (auto-derived criteria):**
```
cert: 29846
repdte: 20241231
(fdic_peer_group_analysis)
```

**Define a peer group with explicit criteria:**
```
repdte: 20241231
asset_min: 5000000
asset_max: 20000000
charter_classes: ["N"]
state: NC
(fdic_peer_group_analysis)
```

**Override auto-derived defaults:**
```
cert: 29846
repdte: 20241231
asset_min: 3000000
state: NC
(fdic_peer_group_analysis)
```

## Peer Group Analysis

The `fdic_peer_group_analysis` tool builds a peer group for a bank and ranks it against peers on financial and efficiency metrics at a single report date.

The tool returns rankings (competition rank + percentile) and peer group medians for:
- Total Assets, Total Deposits, ROA, ROE, Net Interest Margin
- Equity Capital Ratio, Efficiency Ratio, Loan-to-Deposit Ratio
- Deposits-to-Assets Ratio, Non-Interest Income Share

The subject bank is excluded from the peer set and ranking denominators. Ranking denominators are metric-specific — if some peers lack data for a metric, the denominator reflects only peers with valid values.

Peer CERTs from the response can be passed to `fdic_compare_bank_snapshots` for trend analysis across the peer group.

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
- insight tags (see [Insight Tags](#insight-tags) below)
- in `timeseries` mode, quarterly series plus streak metrics

### Insight Tags

The analysis tool assigns insight tags to individual comparisons and aggregates them in a top-level `insights` summary. All possible tags:

| Tag | Meaning |
|-----|---------|
| `growth_with_better_profitability` | Asset growth >= 25%, deposit growth >= 15%, and ROA improved |
| `growth_with_branch_expansion` | Asset growth >= 25%, deposit growth >= 15%, and office count increased |
| `balance_sheet_growth_without_profitability` | Asset growth >= 20% but ROA and ROE both flat or declining |
| `growth_with_branch_consolidation` | Positive asset growth while office count decreased |
| `deposit_mix_softening` | Deposits declined both in absolute terms and as a share of total assets |
| `sustained_asset_growth` | (timeseries only) Three or more consecutive quarters of rising assets |
| `multi_quarter_roa_decline` | (timeseries only) Two or more consecutive quarters of falling ROA |

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

Typical analysis response shape (`fdic_compare_bank_snapshots`):

```json
{
  "total_candidates": 150,
  "analyzed_count": 142,
  "start_repdte": "20211231",
  "end_repdte": "20250630",
  "analysis_mode": "snapshot",
  "sort_by": "asset_growth",
  "sort_order": "DESC",
  "warnings": [],
  "insights": {
    "growth_with_better_profitability": ["Bank A", "Bank B"],
    "growth_with_branch_expansion": ["Bank A"],
    "balance_sheet_growth_without_profitability": [],
    "growth_with_branch_consolidation": ["Bank C"],
    "deposit_mix_softening": [],
    "sustained_asset_growth": [],
    "multi_quarter_roa_decline": []
  },
  "total": 142,
  "offset": 0,
  "count": 10,
  "has_more": true,
  "next_offset": 10,
  "comparisons": [
    {
      "cert": 12345,
      "name": "Bank A",
      "asset_growth": 50000,
      "asset_growth_pct": 45.2,
      "insights": ["growth_with_better_profitability", "growth_with_branch_expansion"]
    }
  ]
}
```

The `warnings` array is populated when the server detects a data issue, such as the institution roster being truncated because it exceeded the FDIC API's per-request limit.

In most successful analyses, `warnings` will be empty.

The `sustained_asset_growth` and `multi_quarter_roa_decline` insight summaries are only populated for `analysis_mode: "timeseries"`.

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
