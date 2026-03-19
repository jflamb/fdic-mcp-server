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

If your MCP host shows tool activity, you may also see the model choose one or more FDIC BankFind tools behind the scenes. The public docs focus on prompt wording and result quality rather than response-format details.
