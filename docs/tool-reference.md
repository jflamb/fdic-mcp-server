---
title: Tool Reference
nav_group: prompting
kicker: Reference
summary: Quick reference for all MCP tools — what each does, when to use it, and key notes on inputs and data basis.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---

This page is a reference for the MCP tools provided by this server. All tools work in **any MCP client** — Claude Desktop, ChatGPT, Gemini CLI, GitHub Copilot CLI, and others.

For guided multi-tool workflows available in Claude Code, see [Skills]({{ '/skills/' | relative_url }}). For help choosing between tools and skills, see [Choose a Workflow]({{ '/choose-a-workflow/' | relative_url }}).

## Search and Lookup Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_search_institutions` | You need institution search results by name, state, status, asset size, or other details | Good default entry point for bank discovery |
| `fdic_get_institution` | You already know the FDIC `CERT` and need one institution record | Best for direct bank lookup |
| `fdic_search_failures` | You need failed-bank records, failure dates, costs, or resolution details | Use when the question is specifically about bank failures |
| `fdic_get_institution_failure` | You already know the failed institution `CERT` and want a direct lookup | Best for one failed-bank record |
| `fdic_search_locations` | You need branch or office locations for one bank or a geography | Useful for office-level footprint questions |
| `fdic_search_history` | You need structural-change records such as mergers or name changes | Use when the question is about institution history |

## Financial and Deposit Datasets

| Tool | Use It When | Data Cadence |
|------|-------------|--------------|
| `fdic_search_financials` | You need quarterly Call Report data | **Quarterly** — identified by `REPDTE` (YYYYMMDD). Quarter-end dates: 0331, 0630, 0930, 1231. |
| `fdic_search_summary` | You need annual summary data | **Annual** — identified by `YEAR`. Different from branch-level SOD data. |
| `fdic_search_sod` | You need Summary of Deposits branch-level deposit data | **Annual** — as of June 30 each year. Branch-level, not institution-level. |
| `fdic_search_demographics` | You need quarterly demographics or market-structure fields, including office counts | **Quarterly** — useful for office-count comparisons and geography context. |

All financial amounts are in **thousands of dollars** unless otherwise noted.

## Analysis Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_compare_bank_snapshots` | You want to compare multiple banks across two quarterly report dates or over a quarterly time series | Best for growth, profitability, branch-count, and trend analysis |
| `fdic_peer_group_analysis` | You want to benchmark one institution against a peer group at a single report date | Best for ranking a bank against comparable institutions. Auto-derives peer criteria from the subject's asset size and charter class. |

## Health and Risk Analysis Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_analyze_bank_health` | You want a CAMELS-style health assessment for a single institution | `public_camels_proxy_v1` assessment with overall band, PCA capital categorization, management overlay, and trend analysis |
| `fdic_compare_peer_health` | You want to rank a group of institutions by health scores | Ranks peers by proxy scores with percentiles and outlier flags for the subject institution |
| `fdic_detect_risk_signals` | You want to scan institutions for early warning indicators | Flags critical and warning-level issues with standardized signal codes |

These tools produce analytical assessments based on public financial data. They are **not** official regulatory CAMELS ratings or confidential supervisory conclusions.

## Credit, Funding, and Securities Detail Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_analyze_credit_concentration` | You want loan portfolio composition and CRE concentration risk | Flags CRE and construction concentrations per interagency guidance thresholds (300% / 100% of capital) |
| `fdic_analyze_funding_profile` | You want deposit composition, wholesale funding reliance, and liquidity metrics | Flags brokered deposit reliance, low core deposits, and FHLB dependence |
| `fdic_analyze_securities_portfolio` | You want securities holdings breakdown and concentration risk | Flags high securities-to-assets, securities-to-capital, and MBS concentration |

## UBPR-Equivalent Analysis

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_ubpr_analysis` | You want a comprehensive ratio report with summary, loan mix, capital, liquidity, and growth rates | Computes UBPR-equivalent ratios from Call Report data. Not official FFIEC UBPR output. |

## Market Share and Franchise Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_market_share_analysis` | You want deposit market share and HHI concentration for an MSA or city market | Requires a numeric `MSABR` code or city + state. Uses annual SOD data. Use `fdic_search_sod` to look up MSABR codes. |
| `fdic_franchise_footprint` | You want one institution's branch network across all its markets | Shows deposit totals and branch counts grouped by MSA from SOD data |

## Holding Company Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_holding_company_profile` | You want all subsidiaries under a holding company with aggregated financials | Look up by HC name or any subsidiary CERT |

## Regional Economic Context

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_regional_context` | You want macro/regional economic context for a bank's operating environment | Uses FRED data for unemployment and rate trends. Gracefully degrades if FRED is unavailable. |

## Data Basis Reference

| Dataset | Cadence | Date Field | Dollar Units |
|---------|---------|------------|-------------|
| Call Reports (financials, demographics) | Quarterly | `REPDTE` (YYYYMMDD) | Thousands |
| Summary data | Annual | `YEAR` | Thousands |
| Summary of Deposits (SOD) | Annual (June 30) | `YEAR` | Thousands |
| Institution profiles | Current | — | Thousands |
| Failure records | Event-based | `FAILDATE` | Thousands |

Publication lag: FDIC data is typically available approximately 90 days after the reporting period.

Do not mix quarterly and annual data in a single prompt without acknowledging the different date bases. For more on date handling, see the [Prompting Guide]({{ '/prompting-guide/' | relative_url }}).
