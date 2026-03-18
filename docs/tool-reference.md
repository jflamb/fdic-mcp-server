---
title: Tool Reference
nav_group: user
kicker: User Guide
summary: Decide which MCP tool to use based on whether you need raw records, direct lookups, cross-period comparisons, or peer benchmarking.
breadcrumbs:
  - title: Overview
    url: /
  - title: Use the Server
    url: /user-guide/
---

This page summarizes what each MCP tool is for and when to use it.

## Search And Lookup Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_search_institutions` | You need institution search results by name, state, status, asset size, or other institution details | Good default entry point for bank discovery |
| `fdic_get_institution` | You already know the FDIC `CERT` and need one institution record | Best for direct bank lookup |
| `fdic_search_failures` | You need failed-bank records, failure dates, costs, or resolution details | Use this when the question is specifically about bank failures |
| `fdic_get_institution_failure` | You already know the failed institution `CERT` and want a direct lookup | Best for one failed-bank record |
| `fdic_search_locations` | You need branch or office locations for one bank or a geography | Useful for office-level footprint questions |
| `fdic_search_history` | You need structural-change records such as mergers or name changes | Use when the question is about institution history |

## Financial And Deposit Datasets

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_search_financials` | You need quarterly Call Report data | Best for balance sheet, income, and ratio questions by quarter |
| `fdic_search_summary` | You need annual summary data | Different from branch-level SOD data |
| `fdic_search_sod` | You need Summary of Deposits branch-level deposit data | Annual data as of June 30 |
| `fdic_search_demographics` | You need quarterly demographics or market-structure fields, including office counts | Useful for office-count comparisons and geography context |

## Analysis Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_compare_bank_snapshots` | You want to compare multiple banks across two quarterly report dates or over a quarterly time series | Best for growth, profitability, branch-count, and trend analysis |
| `fdic_peer_group_analysis` | You want to benchmark one institution against a peer group at a single report date | Best for ranking a bank against comparable institutions |

## Choosing The Right Tool

- Use search tools when you want raw records.
- Use lookup tools when you already know the `CERT`.
- Use `fdic_compare_bank_snapshots` when the question compares banks across time.
- Use `fdic_peer_group_analysis` when the question is "How does this bank rank against peers right now?"

## Data Basis Reminder

- Financials and demographics update quarterly.
- Summary data is annual.
- SOD is annual branch-level data as of June 30.
