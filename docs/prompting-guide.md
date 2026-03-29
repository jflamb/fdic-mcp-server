---
title: Prompting Guide
nav_group: prompting
kicker: Prompting
summary: Write prompts that state the right data type, date basis, geography, and comparison logic so the model can answer reliably.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---

This server works best when prompts are explicit about the dataset, time basis, geography, and ranking criteria.

## Prompting Principles

- Name the institution, state, or peer group clearly.
- State the date basis when using quarterly or annual FDIC data.
- Ask for ranking criteria explicitly when comparing institutions.
- Prefer one analysis question per prompt unless you want the model to chain tools.
- Distinguish between quarterly financial data and annual branch deposit data.

## Date Rules

- You can describe dates naturally in prompts.
- Financial and demographics questions are quarterly.
- Summary questions are annual.
- Summary of Deposits data is annual branch data as of June 30.
- Do not mix quarterly financial questions with annual branch questions unless the prompt acknowledges the different dates.

## Sample Prompts

Each prompt below lists the tools it exercises so you can see how prompts map to server capabilities. These prompts cover the core search, lookup, comparison, and health analysis tools. For market share, franchise footprint, holding company, UBPR analysis, credit concentration, funding profile, securities portfolio, and regional context examples, see [Usage Examples](usage-examples.md).

### Institution discovery

```text
Find active banks in California with over $10 billion in assets.
```

Tools used: `fdic_search_institutions`

What to expect: A filtered list of California institutions above the asset threshold, with name, location, charter class, and asset size.

### Direct institution lookup

```text
Get the FDIC institution record for CERT 3511.
```

Tools used: `fdic_get_institution`

What to expect: The full institution profile for the requested CERT number.

### Quarterly financials

```text
Show quarterly financials for CERT 3511 during 2024, sorted newest first.
```

Tools used: `fdic_search_financials`

What to expect: Up to four quarterly Call Report records with balance sheet, income, capital, and ratio data.

### Annual summary data

```text
Show annual summary data for CERT 628 from 2018 through 2024.
```

Tools used: `fdic_search_summary`

What to expect: Yearly aggregate snapshots of assets, deposits, income, and office counts across the requested range.

### Branch-level deposits

```text
Show all branch deposit totals for CERT 3511 from the 2024 Summary of Deposits report.
```

Tools used: `fdic_search_sod`

What to expect: Branch-by-branch deposit balances as of June 30, 2024, with branch name, address, MSABR numeric code, and deposit total.

### Demographics and office footprint

```text
How many offices does CERT 628 operate, and in how many states?
```

Tools used: `fdic_search_demographics`

What to expect: Quarterly demographic data including total office count, multi-state presence, metro classification, and territory assignment.

### Structural history

```text
Has CERT 3511 been involved in any mergers or name changes?
```

Tools used: `fdic_search_history`

What to expect: A chronological list of structural events — mergers, acquisitions, charter conversions, and name changes.

### Branch locations

```text
Show all branch locations for CERT 628 in Texas.
```

Tools used: `fdic_search_locations`

What to expect: Branch addresses, coordinates, branch type, and establishment dates for the institution's Texas offices.

### Bank failure search

```text
List the 10 costliest bank failures since 2008 and show estimated losses to the Deposit Insurance Fund.
```

Tools used: `fdic_search_failures`

What to expect: Failed institutions ranked by DIF cost estimate, with failure date, resolution type, and acquiring institution.

### Failed bank lookup

```text
What happened when Silicon Valley Bank failed? Look up CERT 24735.
```

Tools used: `fdic_get_institution_failure`

What to expect: The specific failure record — failure date, resolution method, estimated cost, and acquiring institution details.

### Snapshot comparison across time

```text
Compare active North Carolina banks between December 31, 2022 and December 31, 2024. Rank them by deposit growth percentage, return the top 10, and call out which of those top growers also improved ROA.
```

Tools used: `fdic_compare_bank_snapshots`

What to expect: A ranked comparison showing deposit growth, asset growth, and profitability changes for each institution across the two dates.

### Peer group benchmarking

```text
Build a peer group for CERT 29846 as of December 31, 2024 and rank it on ROA, efficiency ratio, and loan-to-deposit ratio. Show where it stands relative to peer medians.
```

Tools used: `fdic_peer_group_analysis`

What to expect: The subject institution ranked against auto-derived peers on each requested metric, with percentile position and peer medians.

### Health assessment with proxy model

```text
Run a full health assessment for CERT 3511 with 8 quarters of trend history. Show the overall assessment band, capital classification, management overlay, and all risk signals.
```

Tools used: `fdic_analyze_bank_health`

What to expect: A `public_camels_proxy_v1` assessment with composite and component ratings, PCA capital categorization (well capitalized through significantly undercapitalized — critically undercapitalized requires tangible-equity data not available from public BankFind), management overlay level, enhanced trend analysis with consecutive-worsening flags, and standardized risk signal codes with severity levels.

### Peer health comparison

```text
Compare the health scores for all active banks in Wyoming, sorted by composite rating. Highlight CERT 3511 and show its peer percentiles.
```

Tools used: `fdic_compare_peer_health`

What to expect: A ranked list of institutions by composite health score, with component ratings and flags. When a subject `cert` is provided, includes peer percentiles and robust z-scores for key metrics (ROA, equity ratio, NIM, efficiency ratio, loan-to-deposit). Outlier flags indicate when the subject is more than 2.5 MAD from the peer median. Note: peer percentile context requires a subject `cert` parameter — without one, the tool returns rankings only.

### Risk signal screening with follow-through

```text
Scan all active banks in Wyoming for risk signals at the latest available quarter. Show only critical and warning-level flags. For any bank with critical signals, also run a full health assessment and explain what is driving the concern.
```

Tools used: `fdic_detect_risk_signals`, `fdic_analyze_bank_health`

What to expect: A severity-ranked list of flagged institutions with standardized signal codes (e.g., `capital_buffer_erosion`, `earnings_loss`, `funding_stress`). For critically flagged banks, a follow-up health assessment showing component detail and trend context.

## Multi-Tool Analysis Prompts

These prompts intentionally chain multiple tools for deeper analysis. They work best when the model can make several tool calls in sequence.

Snapshot analysis with profitability follow-through:

```text
Compare active North Carolina banks between December 31, 2021 and June 30, 2025. Rank them by deposit growth percentage, return the top 10, and call out which of those top growers also improved ROA and reduced office counts.
```

Tools used: `fdic_compare_bank_snapshots`, `fdic_search_demographics`

Peer analysis with explicit comparison points:

```text
Build a peer group for CERT 29846 as of December 31, 2024. Report its rank and percentile for total assets, ROA, efficiency ratio, and loan-to-deposit ratio, then compare the bank to peer medians on those same metrics.
```

Tools used: `fdic_peer_group_analysis`

Health deep-dive with peer context:

```text
Run a health assessment for CERT 3511 as of December 31, 2024 using 8 quarters of trend history. Summarize the overall band, component ratings, and risk signals. Then compare its health scores against peer banks in the same state and asset range.
```

Tools used: `fdic_analyze_bank_health`, `fdic_compare_peer_health`

Failure forensics:

```text
Which bank failures since 2008 had the highest estimated losses? For the top 3, show their quarterly financials from the year before they failed and identify which risk signals were present.
```

Tools used: `fdic_search_failures`, `fdic_search_financials`, `fdic_detect_risk_signals`

Branch versus balance sheet:

```text
Compare South Carolina banks between December 31, 2021 and June 30, 2025. Find banks with positive asset growth and lower office counts, then rank them by deposits-per-office improvement and summarize whether the growth looks branch-supported or mainly balance-sheet driven.
```

Tools used: `fdic_compare_bank_snapshots`, `fdic_search_demographics`, `fdic_search_sod`

## Public Off-Site Proxy Model

The health and risk tools use a shared `public_camels_proxy_v1` analytical engine. The proxy output shape varies by tool:

- **`fdic_analyze_bank_health`** returns a full proxy assessment (overall band, component scores, risk signals, trend insights, provenance). Ask for the "overall assessment band," "capital classification," "management overlay," or "risk signals."
- **`fdic_compare_peer_health`** returns per-institution summary scores (`proxy_score`, `proxy_band`) plus a full proxy for the highlighted subject. Ask for "peer percentiles," "weighted peer averages," or "subject assessment."
- **`fdic_detect_risk_signals`** returns per-institution risk signals generated by the proxy engine. Ask about "risk signals" with a severity filter.

These outputs are analytical proxies based on public FDIC data — not official CAMELS ratings or confidential supervisory conclusions.

## FDIC Examiner Support Skill (Claude Code)

If you are using Claude Code, the `/fdic-examiner-overlay` command lets you layer qualitative examiner knowledge onto a public-data health assessment. The skill fetches a proxy baseline, collects structured analyst inputs for five overlay domains (management, asset quality, earnings, liquidity/funding, sensitivity), computes bounded score adjustments, and produces a blended assessment with explicit provenance separation.

See the [FDIC Examiner Support](examiner-support.md) page for the full walkthrough, domain-specific field tables, adjustment rules, and output format.

## Prompting Pitfalls

- "Find the best banks" is too vague. Say what "best" means.
- "Use latest branch data and latest financials" can mix annual and quarterly sources unintentionally.
- "Compare all banks" may be too broad for the FDIC API limits. Add geography or peer filters.

## Prompting For Better Analysis

Ask for:

- a specific state or list of CERTs
- a start and end report date
- a metric such as deposit growth percentage, ROA change, or efficiency ratio
- whether you want a single snapshot comparison or a quarterly time series

## Recommended Follow-On Prompts

- "Now explain which of the top growers also improved profitability."
- "Show the same peer group but sort by efficiency ratio instead of assets."
- "Call out any warnings or missing data that affect the ranking."
- "Run a health assessment for the lowest-ranked bank in that peer group."
- "Which of those flagged banks have deteriorating capital trends?"
- "Compare the health scores of the top 5 and bottom 5 banks in that group."
- "What does the management overlay say about the weakest bank?"
- "Show the pre-failure financials for any bank that was flagged critical."
