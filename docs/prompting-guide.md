---
title: Prompting Guide
nav_group: prompting
kicker: Patterns
summary: Write prompts that state the right data type, date basis, geography, and comparison logic so the model can answer reliably.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---

This server works best when prompts are explicit about the dataset, time basis, geography, and ranking criteria. This page covers prompt patterns and conventions. For copyable examples, see [Usage Examples]({{ '/usage-examples/' | relative_url }}).

## Prompting Principles

- **Name the institution, state, or peer group clearly.** Ambiguous prompts produce ambiguous results.
- **State the date basis** when using quarterly or annual FDIC data.
- **Ask for ranking criteria explicitly** when comparing institutions (e.g., "rank by ROA" not "find the best banks").
- **Prefer one analysis question per prompt** unless you want the model to chain tools.
- **Distinguish between quarterly and annual data** — they have different cadences and date fields.

## Date and Data Cadence Rules

Understanding the data cadence is essential for well-formed prompts.

| Dataset | Cadence | Date Field | Example |
|---------|---------|------------|---------|
| Call Reports (financials) | Quarterly | `REPDTE` (YYYYMMDD) | `20241231` for Q4 2024 |
| Demographics | Quarterly | `REPDTE` (YYYYMMDD) | `20241231` for Q4 2024 |
| Summary data | Annual | `YEAR` | `2024` |
| Summary of Deposits (SOD) | Annual (June 30) | `YEAR` | `2024` = as of June 30, 2024 |

**Dollar amounts** are in thousands unless otherwise noted. **Publication lag** is approximately 90 days after the reporting period.

### Date rules for prompts

- You can describe dates naturally ("December 31, 2024" or "Q4 2024"). The model translates to `REPDTE` format.
- Financial and demographics prompts use quarterly dates. Specify quarter-end dates: `0331`, `0630`, `0930`, `1231`.
- Summary and SOD prompts use annual dates. SOD data is always as of June 30.
- **Do not mix quarterly and annual data** in a single prompt unless the prompt acknowledges the different date bases. For example: "Show quarterly financials for 2024 and also the June 2024 SOD deposits — note these reflect different reporting periods."

## Sample Prompts by Category

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

### Quarterly financials

```text
Show quarterly financials for CERT 3511 during 2024, sorted newest first.
```

Tools used: `fdic_search_financials`

What to expect: Up to four quarterly Call Report records (Q1–Q4) with balance sheet, income, capital, and ratio data.

### Annual summary data

```text
Show annual summary data for CERT 628 from 2018 through 2024.
```

Tools used: `fdic_search_summary`

What to expect: Yearly aggregate snapshots — a different dataset from quarterly financials.

### Branch-level deposits

```text
Show all branch deposit totals for CERT 3511 from the 2024 Summary of Deposits report.
```

Tools used: `fdic_search_sod`

What to expect: Branch-by-branch deposit balances as of June 30, 2024.

### Snapshot comparison across time

```text
Compare active North Carolina banks between December 31, 2022 and December 31, 2024. Rank by deposit growth percentage, return the top 10.
```

Tools used: `fdic_compare_bank_snapshots`

What to expect: A ranked comparison showing growth and profitability changes across the two dates.

### Peer group benchmarking

```text
Build a peer group for CERT 29846 as of December 31, 2024 and rank it on ROA, efficiency ratio, and loan-to-deposit ratio.
```

Tools used: `fdic_peer_group_analysis`

What to expect: The subject ranked against auto-derived peers with percentile positions and peer medians.

### Health assessment

```text
Run a full health assessment for CERT 3511 with 8 quarters of trend history.
```

Tools used: `fdic_analyze_bank_health`

What to expect: A `public_camels_proxy_v1` assessment with composite and component ratings, capital categorization, management overlay, trend analysis, and risk signals. This is an analytical proxy — not an official CAMELS rating.

### Risk screening with follow-through

```text
Scan all active banks in Wyoming for risk signals. For any bank with critical signals, also run a full health assessment.
```

Tools used: `fdic_detect_risk_signals`, `fdic_analyze_bank_health`

What to expect: A severity-ranked list of flagged institutions, with follow-up health assessments for the most concerning.

## Multi-Tool Analysis Patterns

These prompts intentionally chain multiple tools for deeper analysis:

```text
Compare active North Carolina banks between December 31, 2021 and June 30, 2025. Rank by deposit growth, top 10, and call out which also improved ROA.
```

```text
Build a peer group for CERT 29846, then compare the bank to peer medians on ROA, efficiency, and loan-to-deposit.
```

```text
Which bank failures since 2008 had the highest losses? For the top 3, show their pre-failure financials and risk signals.
```

For structured multi-tool workflows without manual orchestration, consider the [Claude Code skills]({{ '/skills/' | relative_url }}).

## The Public Off-Site Proxy Model

The health and risk tools share a `public_camels_proxy_v1` analytical engine:

- **`fdic_analyze_bank_health`** returns a full proxy assessment (overall band, component scores, risk signals, trend insights).
- **`fdic_compare_peer_health`** returns per-institution summary scores plus a full proxy for the highlighted subject.
- **`fdic_detect_risk_signals`** returns per-institution risk signals generated by the proxy engine.

These outputs are analytical proxies based on public FDIC data — **not** official CAMELS ratings, confidential supervisory conclusions, or investment advice. Management (M) is inferred from patterns, not examination findings. Sensitivity (S) uses proxy metrics.

## Prompting Pitfalls

- **"Find the best banks"** — too vague. Say what "best" means (highest ROA, strongest capital, etc.).
- **"Use latest branch data and latest financials"** — can mix annual and quarterly sources unintentionally.
- **"Compare all banks"** — may be too broad. Add geography or peer filters.
- **"What happened last quarter?"** — specify the quarter-end date explicitly.

## Recommended Follow-On Prompts

After an initial analysis, these follow-ups deepen insight:

- "Which of the top growers also improved profitability?"
- "Show the same peer group but sort by efficiency ratio instead."
- "Run a health assessment for the lowest-ranked bank in that peer group."
- "What does the management overlay say about the weakest bank?"
- "Compare the health scores of the top 5 and bottom 5 in that group."
