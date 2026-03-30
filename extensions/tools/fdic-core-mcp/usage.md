# FDIC Core MCP Tools — Usage Guide

## What This Bundle Provides

The `fdic-core-mcp` tool bundle exposes foundational FDIC BankFind data retrieval tools:

| Tool | Purpose |
|---|---|
| `fdic_search_institutions` | Search and filter FDIC-insured institutions |
| `fdic_get_institution` | Retrieve a single institution profile by CERT |
| `fdic_search_failures` | Search FDIC bank failure records |
| `fdic_get_institution_failure` | Retrieve a single institution's failure record |
| `fdic_search_financials` | Quarterly Call Report financial data |
| `fdic_search_summary` | Annual financial summary data |
| `fdic_search_locations` | Branch location data |
| `fdic_search_history` | Structural event history (mergers, charter changes) |
| `fdic_search_sod` | Summary of Deposits branch-level data |
| `fdic_search_demographics` | FDIC demographic financial data |

## Authentication

None required. The FDIC BankFind API is public.

## Transport

`stdio` — runs as a local MCP server process.

## Date Basis Notes

- Financial data (`fdic_search_financials`, `fdic_search_summary`) uses `REPDTE` in `YYYYMMDD` format.
- SOD data (`fdic_search_sod`) uses `YEAR` in `YYYY` format (annual as of June 30).
- Institution profile (`fdic_get_institution`) is not date-scoped — always current.

See `extensions/shared/context/fdic-date-basis.md` for full rules.
