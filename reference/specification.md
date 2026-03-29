# Technical Specification

Repository reference for the MCP server contract: supported transports, exposed tools, output shape, data constraints, and explicit non-goals.

## Purpose

`fdic-mcp-server` exposes public FDIC BankFind Suite datasets through MCP tools so LLM hosts can search institutions, retrieve records, and perform common multi-bank analysis without custom FDIC API integration.

## Supported Transports

- stdio for local MCP hosts
- streamable HTTP for remote MCP hosts

## Tool Surface

Core search and lookup tools:

- `fdic_search_institutions`
- `fdic_get_institution`
- `fdic_search_failures`
- `fdic_get_institution_failure`
- `fdic_search_locations`
- `fdic_search_history`
- `fdic_search_financials`
- `fdic_search_summary`
- `fdic_search_sod`
- `fdic_search_demographics`

Server-side analysis tools:

- `fdic_compare_bank_snapshots`
- `fdic_peer_group_analysis`

Health and risk analysis tools:

- `fdic_analyze_bank_health`
- `fdic_ubpr_analysis`
- `fdic_compare_peer_health`
- `fdic_detect_risk_signals`
- `fdic_analyze_credit_concentration`
- `fdic_analyze_funding_profile`
- `fdic_analyze_securities_portfolio`

Geographic and market tools:

- `fdic_franchise_footprint`
- `fdic_market_share_analysis`

Entity tools:

- `fdic_holding_company_profile`
- `fdic_regional_context`

## Resource Surface

The server also exposes MCP `resources` for endpoint field discovery:

- `fdic://schemas/index` for the schema index
- `fdic://schemas/{endpoint}` for one machine-readable field catalog per FDIC endpoint

Clients and agents should use these resources to discover valid endpoint-specific `fields` and `sort_by` values before composing search requests.

## Data Contracts

All tools return:

- `content` for human-readable summaries
- `structuredContent` for machine-readable output

Contract stability matters because MCP clients may automate against either or both shapes.

## HTTP Transport Notes

- The streamable HTTP MCP endpoint is served at `/mcp`.
- HTTP MCP sessions are initialized once and then resumed by reusing the returned `MCP-Session-Id` header.
- Local HTTP runs bind to `127.0.0.1` by default unless `HOST` is set.
- Browser-origin access can be restricted with `ALLOWED_ORIGINS`.
- `FDIC_MAX_RESPONSE_BYTES` controls the upstream FDIC response-size guard.

## FDIC Data Constraints

- Financial and demographics datasets are quarterly and use `REPDTE` in `YYYYMMDD`.
- Summary data is annual and uses `YEAR`.
- Summary of Deposits data is annual branch-level data as of June 30.
- Monetary values are generally reported in thousands of dollars.
- `CERT` is the stable institution identifier used across datasets.

## Public Off-Site Proxy Model

The analysis tools use a shared `public_camels_proxy_v1` model that:

- Scores institutions on a 1-4 scale across five components: capital, asset quality, earnings, liquidity/funding, and sensitivity proxy
- Includes PCA-style capital categorization using official regulatory thresholds
- Adds a management overlay (normal / watch / elevated_concern) based on multi-factor pattern detection
- Provides risk signals with standardized codes and neutral, supervisory-safe language
- Records metric provenance and data-quality flags

**Output shape varies by tool:**

| Tool | Proxy in `structuredContent` | Rationale |
|------|------------------------------|-----------|
| `fdic_analyze_bank_health` | Full `ProxyAssessment` object under `proxy` | Single-institution deep analysis |
| `fdic_compare_peer_health` | Per-institution `proxy_score` + `proxy_band` summary; full `ProxyAssessment` under `proxy` only for the subject cert (or `null`) | Bulk comparison — full proxy per institution would bloat response |
| `fdic_detect_risk_signals` | `proxy: null`; signals derived from the proxy engine internally, surfaced as per-institution `signals[]` | Screening tool — the proxy engine drives signal generation but the output is signal-shaped, not assessment-shaped |

All three tools include `model: "public_camels_proxy_v1"` and `official_status` at the top level of `structuredContent` to identify the analytical framework.

**Important:** This is a public-data analytical proxy — not an official CAMELS rating or confidential supervisory conclusion. The Management (M) component is not scored directly; it appears only as a pattern-based overlay.

## Claude Code Skills

The repository ships one Claude Code slash command skill in `.claude/commands/`:

| Skill file | Command | Description |
|------------|---------|-------------|
| `fdic-bank-deep-dive.md` | `/fdic-bank-deep-dive` | Chains nine MCP tools into a ten-section narrative report for a single institution. Accepts a bank name or CERT number and an optional quarter-end `repdte`. For inactive institutions, derives the analysis date from the institution's last reported `REPDTE`. |

Skills are prompt documents — not server-side code — and are versioned alongside the MCP tools they depend on.

## Input Contract Notes

`fdic_market_share_analysis` accepts a geographic market through one of two mutually exclusive paths:

- `msa` (number): numeric FDIC MSABR code (e.g., `19100` for Dallas-Fort Worth-Arlington). Use `fdic_search_sod` to look up MSABR codes by state or institution.
- `city` (string) + `state` (string): city name and two-letter state code.

The former `msa` (string name) and `county` parameters are no longer supported; the FDIC SOD endpoint no longer accepts `MSANAMEBR` or `CNTYBR` as filter fields.

## Non-Goals

- No private credentials or API keys
- No proprietary data enrichment outside the FDIC public API
- No breaking tool-contract changes without explicit coordination
