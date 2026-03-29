---
title: Tool Reference
nav_group: prompting
kicker: Reference
summary: Decide which MCP tool to use based on whether you need raw records, direct lookups, cross-period comparisons, or peer benchmarking.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
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

## Health And Risk Analysis Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_analyze_bank_health` | You want a CAMELS-style health assessment for a single institution | Produces a public_camels_proxy_v1 assessment with PCA capital categorization, management overlay, and enhanced trend analysis. Legacy CAMELS-style output retained for compatibility. |
| `fdic_compare_peer_health` | You want to rank a group of institutions by CAMELS-style health scores | Ranks peers by health scores with peer percentiles, robust z-scores, and outlier flags for the subject institution. |
| `fdic_detect_risk_signals` | You want to scan institutions for early warning indicators | Flags critical issues with standardized V2 signal codes (capital_buffer_erosion, earnings_loss, etc.) alongside legacy signals. |

These tools produce analytical assessments based on public financial data. They are not official regulatory CAMELS ratings.

## Credit, Funding, And Securities Detail Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_analyze_credit_concentration` | You want loan portfolio composition and CRE concentration risk | Flags CRE and construction concentrations per interagency guidance thresholds |
| `fdic_analyze_funding_profile` | You want deposit composition, wholesale funding reliance, and liquidity metrics | Flags brokered deposit reliance, low core deposits, and FHLB dependence |
| `fdic_analyze_securities_portfolio` | You want securities holdings breakdown and concentration risk | Flags high securities-to-assets, securities-to-capital, and MBS concentration |

## UBPR-Equivalent Analysis

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_ubpr_analysis` | You want a UBPR-style ratio report with summary, loan mix, capital, liquidity, and growth rates | Computes UBPR-equivalent ratios from Call Report data. Not official FFIEC UBPR output. |

## Market Share And Franchise Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_market_share_analysis` | You want deposit market share and HHI concentration for an MSA or city market | Requires either a numeric `MSABR` code (`msa`) or a city name and state (`city` + `state`). Use `fdic_search_sod` to look up MSABR codes. Uses annual SOD data. |
| `fdic_franchise_footprint` | You want to see one institution's branch network across all its markets | Shows deposit totals and branch counts grouped by MSA code (`MSA <code>` or `Non-MSA / Rural`) from SOD data. |

## Holding Company Tools

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_holding_company_profile` | You want to see all subsidiaries under a holding company with aggregated financials | Look up by HC name or any subsidiary CERT. Shows asset-weighted metrics across the consolidated entity. |

## Regional Economic Context

| Tool | Use It When | Notes |
|------|-------------|-------|
| `fdic_regional_context` | You want macro/regional economic context for a bank's operating environment | Uses FRED data for unemployment and interest rate trends. Gracefully degrades if FRED is unavailable. |

## FDIC Examiner Support Skill (Claude Code)

If you are using Claude Code with this MCP server, the `/fdic-examiner-overlay` command guides you through layering qualitative examiner knowledge onto a `public_camels_proxy_v1` baseline. It collects structured analyst inputs for five overlay domains, computes bounded score adjustments, and produces a blended assessment with explicit provenance separation.

See the [FDIC Examiner Support](examiner-support.md) page for the full walkthrough, adjustment rules, and output format.

## Choosing The Right Tool

- Use search tools when you want raw records.
- Use lookup tools when you already know the `CERT`.
- Use `fdic_compare_bank_snapshots` when the question compares banks across time.
- Use `fdic_peer_group_analysis` when the question is "How does this bank rank against peers right now?"
- Use `fdic_analyze_bank_health` when the question is "How healthy is this bank?" or "What are its strengths and weaknesses?"
- Use `fdic_compare_peer_health` when you want to rank peers by overall health rather than a single metric.
- Use `fdic_detect_risk_signals` when you want to screen a set of banks for potential concerns.
- Use `fdic_analyze_credit_concentration` when the question is about loan portfolio mix or CRE exposure.
- Use `fdic_analyze_funding_profile` when the question is about deposit stability, wholesale funding, or liquidity.
- Use `fdic_analyze_securities_portfolio` when the question is about bond portfolio risk or securities concentration.
- Use `fdic_ubpr_analysis` when you want a comprehensive ratio report similar to a UBPR page.
- Use `fdic_market_share_analysis` when the question is about competitive position in a specific market.
- Use `fdic_franchise_footprint` when you want to map where an institution operates and how its deposits are distributed.
- Use `fdic_holding_company_profile` when you want to understand the parent-subsidiary structure and consolidated metrics.
- Use `fdic_regional_context` when you need economic backdrop for interpreting bank performance.
- Use `/fdic-examiner-overlay` when you have examiner-grade qualitative knowledge to layer onto a public-data health assessment.

## Data Basis Reminder

- Financials and demographics update quarterly.
- Summary data is annual.
- SOD is annual branch-level data as of June 30.
