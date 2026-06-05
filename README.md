# FDIC BankFind MCP Server

`fdic-mcp-server` is an MCP (Model Context Protocol) server for the [FDIC BankFind Suite API](https://api.fdic.gov/banks/docs/). It gives LLM hosts a clean way to search FDIC-insured institutions, retrieve public banking records, and run common multi-bank analysis workflows without custom FDIC API plumbing.

It is useful when you want an MCP-compatible client to answer questions about banks, failures, branches, quarterly financials, deposit data, or peer performance using a stable tool surface and machine-readable responses.

## Table Of Contents

- [Project Status](#project-status)
- [Why This Project Exists](#why-this-project-exists)
- [Documentation](#documentation)
- [Installation](#installation)
- [Usage](#usage)
- [Available Tools](#available-tools)
- [Data Notes](#data-notes)
- [Support](#support)
- [Contributing](#contributing)
- [License](#license)

## Project Status

Active development. The server is usable today and the tool surface is covered by tests, but the project is still evolving as client support and analysis workflows improve.

## Why This Project Exists

The FDIC BankFind Suite API is public and useful, but it is not packaged for MCP clients out of the box. This project solves that by:

- exposing BankFind datasets as MCP tools
- preserving both human-readable and machine-readable responses
- adding server-side analysis helpers for multi-bank comparison workflows
- supporting both local stdio hosts and remote HTTP hosts

## Documentation

Public user docs:

- [User&rsquo;s Guide](https://jflamb.github.io/fdic-mcp-server/)

Validate the public docs site locally:

```bash
npm run docs:bundle
npm run docs:build
```

Repo reference docs:

- [Reference home](./reference/README.md)
- [Technical specification](./reference/specification.md)
- [Architecture](./reference/architecture.md)
- [Key decisions](./reference/decisions.md)
- [Cloud Run deployment](./reference/cloud-run-deployment.md)
- [Plans and design notes](./reference/plans/README.md)

Project and release info:

- [Release history](https://github.com/jflamb/fdic-mcp-server/releases)
- [Archived release notes](./docs/release-notes/index.md)
- [Security policy](./SECURITY.md)

## Installation

Prerequisites:

- Node.js 20 or later
- npm

Run directly without a global install:

```bash
npx fdic-mcp-server
```

Install globally:

```bash
npm install -g fdic-mcp-server
fdic-mcp-server
```

Install from GitHub Packages:

```bash
npm install -g @jflamb/fdic-mcp-server --registry=https://npm.pkg.github.com
fdic-mcp-server
```

Install from source:

```bash
git clone https://github.com/jflamb/fdic-mcp-server.git
cd fdic-mcp-server
npm install
npm run build
```

## Usage

### Hosted Endpoint

If your MCP host supports remote MCP URLs, use:

```text
https://bankfind.jflamb.com/mcp
```

### Run Locally

Stdio transport:

```bash
node dist/index.js
```

HTTP transport:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

The HTTP MCP endpoint is `http://127.0.0.1:3000/mcp` by default.

Notes:

- Local HTTP runs bind to `127.0.0.1` by default. Set `HOST` if you intentionally want a different bind address.
- Browser-origin requests are checked against `ALLOWED_ORIGINS`. If unset, the server allows the local defaults for `localhost` and `127.0.0.1` on the configured port, plus non-browser requests with no `Origin` header.
- The HTTP transport is session-based. Clients initialize once, then reuse `MCP-Session-Id` on later POST, GET, and DELETE requests.

Container builds use `PORT=8080` by default for Cloud Run compatibility.

Set `FDIC_MAX_RESPONSE_BYTES` to override the upstream FDIC response-size guard. The default is `5242880` bytes (5 MiB).

### Minimal MCP Configuration

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

If you are running from a local clone instead of the published package:

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

Client-specific setup details are in [docs/clients.md](./docs/clients.md).

### Usage Examples

Find active banks in North Carolina with assets over $1 billion:

```text
filters: STNAME:"North Carolina" AND ACTIVE:1 AND ASSET:[1000000 TO *]
```

Get the 10 costliest bank failures since January 1, 2000:

```text
filters: FAILDATE:[2000-01-01 TO *]
sort_by: COST
sort_order: DESC
limit: 10
```

Compare North Carolina banks between two quarterly report dates:

```text
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
sort_by: asset_growth
sort_order: DESC
(fdic_compare_bank_snapshots)
```

Build a peer group for a specific bank:

```text
cert: 29846
repdte: 20241231
(fdic_peer_group_analysis)
```

More examples are in [docs/usage-examples.md](./docs/usage-examples.md).

## Available Tools

| Tool | Description |
|------|-------------|
| `search` | ChatGPT-compatible citation search across institutions, failures, branches, and schema docs |
| `fetch` | Fetch full citation text for a result returned by `search` |
| `fdic_search_institutions` | Search FDIC-insured banks and savings institutions |
| `fdic_get_institution` | Get details for a specific institution by CERT number |
| `fdic_search_failures` | Search failed bank records |
| `fdic_get_institution_failure` | Get failure details for a specific institution |
| `fdic_search_locations` | Search branch and office locations |
| `fdic_search_history` | Search structural change events such as mergers and name changes |
| `fdic_search_financials` | Search quarterly Call Report financial data |
| `fdic_search_summary` | Search annual financial summary data |
| `fdic_search_sod` | Search Summary of Deposits branch-level deposit data |
| `fdic_search_demographics` | Search quarterly demographics and market-structure data |
| `fdic_compare_bank_snapshots` | Compare two reporting snapshots across banks and rank growth and profitability changes |
| `fdic_peer_group_analysis` | Build a peer group and rank an institution against peers on financial metrics |
| `fdic_analyze_bank_health` | Run a CAMELS-style health assessment for a single institution |
| `fdic_show_bank_deep_dive` | Render a ChatGPT bank deep-dive dashboard for a single institution |
| `fdic_ubpr_analysis` | Run a UBPR-equivalent ratio analysis (ROA, ROE, NIM, efficiency, capital, liquidity, growth) |
| `fdic_compare_peer_health` | Rank a group of institutions by CAMELS-style health scores |
| `fdic_detect_risk_signals` | Scan institutions for early warning risk indicators |
| `fdic_analyze_credit_concentration` | Analyze loan portfolio composition and CRE/construction concentration relative to capital |
| `fdic_analyze_funding_profile` | Analyze deposit composition, wholesale funding reliance, and funding risk signals |
| `fdic_analyze_securities_portfolio` | Analyze securities portfolio size, MBS concentration, and interest rate exposure |
| `fdic_franchise_footprint` | Map branch and deposit distribution across MSA markets using SOD data |
| `fdic_market_share_analysis` | Rank institutions by deposit market share in an MSA or city market and compute HHI |
| `fdic_holding_company_profile` | Profile a holding company and its FDIC-insured subsidiaries with aggregated metrics |
| `fdic_regional_context` | Provide regional economic context (unemployment, interest rate environment) for a bank's market |

Server-side analysis helpers:

- `fdic_compare_bank_snapshots` batches roster lookup, financial snapshots, and optional demographics snapshots inside the MCP server
- `fdic_peer_group_analysis` builds a peer group from asset size, charter class, and geography criteria and then ranks an institution against peers
- `fdic_analyze_bank_health` returns a full `public_camels_proxy_v1` proxy assessment; `fdic_compare_peer_health` returns per-institution summary scores with a full proxy for the subject; `fdic_detect_risk_signals` uses the proxy engine to generate per-institution risk signals — all are analytical proxies, not official regulatory CAMELS ratings

## Plugin Skills

This repository includes plugin skills that chain multiple FDIC MCP tools into structured analysis workflows. Skills are not MCP tools, and they are not Claude-only as a category. Codex and Claude Code can both load guided skills through their plugin systems, although each host may expose a different skill list.

| Skill | Command | Description |
|-------|---------|-------------|
| Bank Deep Dive | `/fdic-bank-deep-dive` | Comprehensive single-institution analysis report covering health assessment, financial performance, peer benchmarking, credit concentration, funding profile, securities portfolio, franchise footprint, and economic context. Accepts a bank name or CERT number with an optional report date. |
| Portfolio Surveillance | `/fdic-portfolio-surveillance` | Screens a defined group of institutions and produces a ranked watchlist with escalation tiers. |
| Failure Forensics | `/fdic-failure-forensics` | Reconstructs a failed institution's pre-failure financial timeline and identifies public-data warning signals. |

Claude Code plugin skills are defined in `.claude/commands/`. Codex plugin skills are generated from `.agents/skills/` through `npm run plugin:sync`. See [docs/plugin-installation.md](./docs/plugin-installation.md) for installation details and [docs/usage-examples.md](./docs/usage-examples.md) for usage examples.

## Data Notes

- Monetary values are generally reported in thousands of dollars.
- `CERT` is the stable FDIC institution identifier.
- Financial and demographics datasets are quarterly and use `REPDTE` in `YYYYMMDD`.
- Summary data is annual and uses `YEAR`.
- SOD data is annual branch-level data as of June 30.
- Do not mix quarterly financial data and annual branch data without stating the date basis.

## Support

Use the GitHub issue tracker for bugs, documentation problems, and feature requests: <https://github.com/jflamb/fdic-mcp-server/issues>

The main support docs are:

- [docs/support.md](./docs/support.md)
- [docs/prompting-guide.md](./docs/prompting-guide.md)
- [docs/usage-examples.md](./docs/usage-examples.md)
- [docs/troubleshooting.md](./docs/troubleshooting.md)
- [SECURITY.md](./SECURITY.md)

## Contributing

Contributor guidance lives in [CONTRIBUTING.md](./CONTRIBUTING.md).

For local validation, run:

```bash
npm run typecheck
npm test
npm run build
```

Releases are published automatically from validated `main` commits by `semantic-release`. Do not manually edit the package version or create release tags by hand. GitHub Releases is the authoritative release record for published versions.

## License

This project is licensed under the MIT License.
