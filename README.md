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

- GitHub Pages docs entry point: <https://jflamb.github.io/fdic-mcp-server/>
- Hosted MCP endpoint: <https://bankfind.jflamb.com/mcp>
- Local docs home: [docs/index.md](./docs/index.md)
- Getting started: [docs/getting-started.md](./docs/getting-started.md)
- Prompting guide: [docs/prompting-guide.md](./docs/prompting-guide.md)
- Usage examples: [docs/usage-examples.md](./docs/usage-examples.md)
- Tool reference: [docs/tool-reference.md](./docs/tool-reference.md)
- Client setup: [docs/clients.md](./docs/clients.md)
- Troubleshooting and FAQ: [docs/troubleshooting.md](./docs/troubleshooting.md)
- Compatibility matrix: [docs/compatibility-matrix.md](./docs/compatibility-matrix.md)
- Technical specification: [docs/technical/specification.md](./docs/technical/specification.md)
- Architecture: [docs/technical/architecture.md](./docs/technical/architecture.md)
- Key decisions: [docs/technical/decisions.md](./docs/technical/decisions.md)
- Release history: [GitHub Releases](https://github.com/jflamb/fdic-mcp-server/releases)
- Archived release notes: [docs/release-notes/index.md](./docs/release-notes/index.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## Installation

Prerequisites:

- Node.js 18 or later
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

Two tools are server-side analysis helpers:

- `fdic_compare_bank_snapshots` batches roster lookup, financial snapshots, and optional demographics snapshots inside the MCP server
- `fdic_peer_group_analysis` builds a peer group from asset size, charter class, and geography criteria and then ranks an institution against peers

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
