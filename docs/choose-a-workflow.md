---
title: Choose a Workflow
nav_group: prompting
kicker: Guide
summary: Decide whether to use an MCP tool or a Claude Code skill, and pick the right one for your analysis goal.
breadcrumbs:
  - title: Overview
    url: /
---

This page helps you quickly find the right path for your FDIC data analysis task.

## Are You Using Claude Code?

| If you are using... | You have access to... |
|---------------------|----------------------|
| **Claude Code** (with plugin installed) | MCP tools **and** Claude Code skills |
| **Any other MCP client** (Claude Desktop, ChatGPT, Gemini CLI, etc.) | MCP tools only |

Skills are guided analyst workflows available exclusively in Claude Code. They chain multiple MCP tools into structured reports. If you are not in Claude Code, you can achieve similar results by prompting the [MCP tools]({{ '/tool-reference/' | relative_url }}) directly — it just takes more manual orchestration.

## What Are You Analyzing?

### Single Active Institution

| Goal | Best Path | Client |
|------|-----------|--------|
| Full-picture report (health, financials, peers, credit, funding, franchise) | [Bank Deep Dive]({{ '/skills/bank-deep-dive/' | relative_url }}) skill | Claude Code |
| Health assessment only | `fdic_analyze_bank_health` tool | Any MCP client |
| Financial ratios only | `fdic_ubpr_analysis` tool | Any MCP client |
| Peer benchmarking only | `fdic_peer_group_analysis` tool | Any MCP client |
| Credit concentration only | `fdic_analyze_credit_concentration` tool | Any MCP client |
| Layer examiner knowledge onto baseline | [Examiner Support]({{ '/skills/examiner-support/' | relative_url }}) skill | Claude Code |
| Quick fact lookup (name, location, charter) | `fdic_get_institution` tool | Any MCP client |

### Portfolio / Multiple Institutions

| Goal | Best Path | Client |
|------|-----------|--------|
| Screen and triage a group of banks | [Portfolio Surveillance]({{ '/skills/portfolio-surveillance/' | relative_url }}) skill | Claude Code |
| Risk signal scan (flat list) | `fdic_detect_risk_signals` tool | Any MCP client |
| Rank a group by health scores | `fdic_compare_peer_health` tool | Any MCP client |
| Compare growth/profitability across time | `fdic_compare_bank_snapshots` tool | Any MCP client |
| Benchmark one bank against peers | `fdic_peer_group_analysis` tool | Any MCP client |

### Failed Institution

| Goal | Best Path | Client |
|------|-----------|--------|
| Reconstruct pre-failure timeline and identify warning signals | [Failure Forensics]({{ '/skills/failure-forensics/' | relative_url }}) skill | Claude Code |
| Look up failure details (date, cost, resolution) | `fdic_get_institution_failure` tool | Any MCP client |
| Search multiple failures by date/cost/state | `fdic_search_failures` tool | Any MCP client |
| Pre-failure financials (manual reconstruction) | `fdic_search_financials` + `fdic_detect_risk_signals` tools | Any MCP client |

### Market and Geography

| Goal | Best Path | Client |
|------|-----------|--------|
| Deposit market share in an MSA or city | `fdic_market_share_analysis` tool | Any MCP client |
| Branch footprint for one institution | `fdic_franchise_footprint` tool | Any MCP client |
| Branch locations with addresses | `fdic_search_locations` tool | Any MCP client |
| Economic backdrop for a state | `fdic_regional_context` tool | Any MCP client |

### Holding Companies

| Goal | Best Path | Client |
|------|-----------|--------|
| All subsidiaries and consolidated metrics | `fdic_holding_company_profile` tool | Any MCP client |

## Decision Flowchart

```
Are you in Claude Code (with plugin)?
├── Yes
│   ├── Single institution, full report? → /fdic-bank-deep-dive
│   ├── Single institution, add examiner knowledge? → /fdic-examiner-overlay
│   ├── Multiple institutions, screen & triage? → /fdic-portfolio-surveillance
│   ├── Failed institution, reconstruct timeline? → /fdic-failure-forensics
│   └── One specific dataset or analysis? → Use the MCP tool directly
└── No
    └── Use MCP tools directly (see Tool Reference)
        ├── Search/lookup: fdic_search_*, fdic_get_*
        ├── Compare: fdic_compare_bank_snapshots, fdic_peer_group_analysis
        ├── Health/risk: fdic_analyze_bank_health, fdic_detect_risk_signals
        └── Specialized: fdic_ubpr_analysis, fdic_market_share_analysis, etc.
```

## Data Basis Quick Reference

Understanding the data cadence helps you write better prompts and interpret results correctly.

| Dataset | Cadence | Date Field | Notes |
|---------|---------|------------|-------|
| Call Reports (financials, demographics) | Quarterly | `REPDTE` (YYYYMMDD) | Quarter-end: 0331, 0630, 0930, 1231 |
| Summary data | Annual | `YEAR` | Year-end aggregate |
| Summary of Deposits (SOD) | Annual | `YEAR` | Branch-level deposits as of June 30 |
| Institution profiles | Current | — | Reflects latest known status |
| Failure records | Event-based | `FAILDATE` | Date of failure |

**Dollar amounts** are in thousands unless otherwise noted. **Publication lag** is approximately 90 days after the reporting period.

When a skill or multi-tool prompt mixes quarterly and annual data, the output states the date basis for each section. Be explicit about dates in your prompts to avoid unintentional mixing.

## Next Steps

- [Tool Reference]({{ '/tool-reference/' | relative_url }}) — Full list of MCP tools with use-case guidance
- [Skills]({{ '/skills/' | relative_url }}) — Claude Code skill details, inputs, and output formats
- [Prompting Guide]({{ '/prompting-guide/' | relative_url }}) — Prompt patterns and date rules for effective queries
- [Usage Examples]({{ '/usage-examples/' | relative_url }}) — Copyable prompts with expected answer shapes
