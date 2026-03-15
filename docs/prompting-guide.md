---
title: Prompting Guide
---

# Prompting Guide

This server works best when prompts are explicit about the dataset, time basis, geography, and ranking criteria.

## Prompting Principles

- Name the institution, state, or peer group clearly.
- State the date basis when using quarterly or annual FDIC data.
- Ask for ranking criteria explicitly when comparing institutions.
- Prefer one analysis question per prompt unless you want the model to chain tools.
- Distinguish between quarterly financial data and annual branch deposit data.

## Date Rules

- Financial, summary, and demographics queries use `REPDTE` in `YYYYMMDD` format.
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
Compare North Carolina banks between 20211231 and 20250630 and rank them by deposit growth percentage.
```

Peer analysis:

```text
Build a peer group for CERT 29846 at 20241231 and tell me where it ranks on ROA, ROE, and efficiency ratio.
```

## Prompting Pitfalls

- "Find the best banks" is too vague. Say what "best" means.
- "Use latest branch data and latest financials" can mix annual and quarterly sources unintentionally.
- "Compare all banks" may be too broad for the FDIC API limits. Add geography or peer filters.

## Prompting For Better Analysis

Ask for:

- a specific state or list of CERTs
- a start and end report date
- a metric such as `asset_growth_pct`, `roa_change`, or `efficiency_ratio`
- whether you want a single snapshot comparison or a quarterly time series

## Recommended Follow-On Prompts

- "Now explain which of the top growers also improved profitability."
- "Show the same peer group but sort by efficiency ratio instead of assets."
- "Call out any warnings or missing data that affect the ranking."
