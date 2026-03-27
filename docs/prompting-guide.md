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

## Good Prompt Patterns

Institution search:

```text
Find active banks in Texas with total assets above $5 billion.
```

Single-institution lookup:

```text
Get the FDIC institution record for CERT 3511.
```

Quarterly financial history:

```text
Show Bank of America quarterly financial data for 2024, sorted newest first.
```

Snapshot comparison:

```text
Compare North Carolina banks between December 31, 2021 and June 30, 2025 and rank them by deposit growth percentage.
```

Peer analysis:

```text
Build a peer group for CERT 29846 as of December 31, 2024 and tell me where it ranks on ROA, ROE, and efficiency ratio.
```

Bank health assessment:

```text
Run a CAMELS-style health assessment for CERT 3511 as of December 31, 2024 with 8 quarters of trend data.
```

Risk signal scan:

```text
Scan active banks in Wyoming for risk signals. Flag any critical or warning-level concerns.
```

## Copy-Paste Analysis Prompts

These prompts are intentionally narrow enough to return a clear answer in one pass, while still requiring deeper comparison work.

Snapshot analysis with profitability follow-through:

```text
Compare active North Carolina banks between December 31, 2021 and June 30, 2025. Rank them by deposit growth percentage, return the top 10, and call out which of those top growers also improved ROA and reduced office counts.
```

Peer analysis with explicit comparison points:

```text
Build a peer group for CERT 29846 as of December 31, 2024. Report its rank and percentile for total assets, ROA, efficiency ratio, and loan-to-deposit ratio, then compare the bank to peer medians on those same metrics.
```

Time-series analysis with warning-aware output:

```text
Analyze Texas banks from December 31, 2022 through December 31, 2024 using time-series mode. Identify institutions with sustained asset-growth streaks, then among those flag any bank that also had a multi-quarter ROA decline. Limit the answer to the five clearest examples and include any warnings that affect interpretation.
```

Focused branch-versus-balance-sheet question:

```text
Compare South Carolina banks between December 31, 2021 and June 30, 2025. Find banks with positive asset growth and lower office counts, then rank them by deposits-per-office improvement and summarize whether the growth looks branch-supported or mainly balance-sheet driven.
```

Bank health deep-dive with peer context:

```text
Run a CAMELS-style health assessment for CERT 3511 as of December 31, 2024 using 8 quarters of trend history. Summarize the composite and component ratings, highlight any deteriorating trends, and list all risk signals. Then compare its CAMELS scores against peer banks in the same state and asset range.
```

Risk signal screening with follow-through:

```text
Scan all active banks in Wyoming for risk signals at the latest available quarter. Show only critical and warning-level flags. For any bank with critical signals, also run a full health assessment and explain what is driving the concern.
```

## Public Off-Site Proxy Model

The health and risk tools now produce a `public_camels_proxy_v1` model in their structured output. When using these tools:

- Ask for the "overall assessment band" to get the strong/satisfactory/weak/high_risk classification
- Ask for "capital classification" to see PCA-style categorization
- Ask about "risk signals" to see standardized signal codes with severity levels
- Ask for "peer percentiles" when comparing against a peer group

These outputs are analytical proxies based on public FDIC data — not official supervisory conclusions.

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
- "Compare the CAMELS scores of the top 5 and bottom 5 banks in that group."
