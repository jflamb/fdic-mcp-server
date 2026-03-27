---
title: Usage Examples
nav_group: prompting
kicker: Prompting
summary: Copyable prompts for institution search, financial retrieval, snapshot comparison, and peer analysis, plus what a good answer should cover.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---

The examples below are phrased as natural-language prompts, followed by the kind of answer you should expect.

## Search Institutions

Prompt:

```text
Find active FDIC-insured banks in North Carolina with more than $1 billion in assets.
```

What a good answer should do:

- Focus on active North Carolina institutions above the requested asset threshold.

## Look Up A Known CERT

Prompt:

```text
Get institution details for CERT 3511.
```

What a good answer should do:

- Return the institution record for the requested CERT.

## Review Bank Failures

Prompt:

```text
List the 10 costliest bank failures since January 1, 2000.
```

What a good answer should do:

- Return the largest failure-cost examples since the requested date in descending order.

## Pull Quarterly Financials

Prompt:

```text
Show quarterly financials for CERT 3511 during 2023.
```

What a good answer should do:

- Return quarterly financial records for the requested bank over the requested year.

## Compare Growth Across Two Dates

Prompt:

```text
Compare North Carolina banks between 20211231 and 20250630 and rank them by asset growth.
```

What a good answer should do:

- Compare the same state-level bank roster across the two dates and rank by asset growth.

## Run A Time-Series Analysis

Prompt:

```text
Analyze North Carolina banks from 20211231 through 20250630 and identify sustained asset-growth streaks.
```

What a good answer should do:

- Look across the full date range and identify banks with repeated or sustained growth, not just a one-date change.

## Build A Peer Group

Prompt:

```text
Build a peer group for CERT 29846 at 20241231 and rank it against peers on ROA and efficiency ratio.
```

What a good answer should do:

- Build a comparable peer set for the requested bank and report where it ranks on the requested metrics.

## Analyze Bank Health

Prompt:

```text
Run a CAMELS-style health assessment for CERT 3511 as of December 31, 2024 with 8 quarters of trend data.
```

What a good answer should do:

- Return composite and component ratings (Capital, Asset Quality, Earnings, Liquidity, Sensitivity) with individual metric scores.
- Show trend analysis for key metrics across prior quarters.
- Flag any risk signals at critical or warning level.
- Note that this is an analytical assessment, not an official regulatory rating.

## Compare Peer Health

Prompt:

```text
Compare CAMELS health scores for all active banks in Wyoming, sorted by composite rating.
```

What a good answer should do:

- Score each institution using CAMELS-style analysis.
- Rank institutions by composite rating (or a specific component if requested).
- Show component breakdowns and flag any institutions with concerning scores.

## Detect Risk Signals

Prompt:

```text
Scan active banks in North Carolina with under $500 million in assets for risk signals. Show critical and warning flags only.
```

What a good answer should do:

- Screen the matched institutions for early warning indicators.
- Categorize signals by severity (critical, warning) and CAMELS category (capital, earnings, liquidity, etc.).
- Rank flagged institutions by severity count so the most concerning appear first.

If your MCP host shows tool activity, you may also see the model choose one or more FDIC BankFind tools behind the scenes. The public docs focus on prompt wording and result quality rather than response-format details.
