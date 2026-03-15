---
title: Technical Specification
nav_group: technical
kicker: Technical Docs
summary: The contract-level view of the server: supported transports, exposed tools, output shape, data constraints, and explicit non-goals.
breadcrumbs:
  - title: Overview
    url: /
  - title: Technical Docs
    url: /technical/
---

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

## Data Contracts

All tools return:

- `content` for human-readable summaries
- `structuredContent` for machine-readable output

Contract stability matters because MCP clients may automate against either or both shapes.

## FDIC Data Constraints

- Financial, summary, and demographics datasets are quarterly and use `REPDTE` in `YYYYMMDD`.
- Summary of Deposits data is annual branch-level data as of June 30.
- Monetary values are generally reported in thousands of dollars.
- `CERT` is the stable institution identifier used across datasets.

## Non-Goals

- No private credentials or API keys
- No proprietary data enrichment outside the FDIC public API
- No breaking tool-contract changes without explicit coordination
