---
title: Usage Examples
nav_group: user
kicker: User Docs
summary: Copyable prompts and expected tool behavior for institution search, financial retrieval, snapshot comparison, and peer analysis.
breadcrumbs:
  - title: Overview
    url: /
  - title: User Docs
    url: /user-guide/
---

The examples below are phrased as natural-language prompts, followed by the expected MCP tool direction.

## Search Institutions

Prompt:

```text
Find active FDIC-insured banks in North Carolina with more than $1 billion in assets.
```

Expected tool:

- `fdic_search_institutions`

Expected filter shape:

```text
STNAME:"North Carolina" AND ACTIVE:1 AND ASSET:[1000000 TO *]
```

## Look Up A Known CERT

Prompt:

```text
Get institution details for CERT 3511.
```

Expected tool:

- `fdic_get_institution`

## Review Bank Failures

Prompt:

```text
List the 10 costliest bank failures since January 1, 2000.
```

Expected tool:

- `fdic_search_failures`

Expected parameters:

```text
filters: FAILDATE:[2000-01-01 TO *]
sort_by: COST
sort_order: DESC
limit: 10
```

## Pull Quarterly Financials

Prompt:

```text
Show quarterly financials for CERT 3511 during 2023.
```

Expected tool:

- `fdic_search_financials`

Expected parameters:

```text
cert: 3511
filters: REPDTE:[20230101 TO 20231231]
```

## Compare Growth Across Two Dates

Prompt:

```text
Compare North Carolina banks between 20211231 and 20250630 and rank them by asset growth.
```

Expected tool:

- `fdic_compare_bank_snapshots`

Expected parameters:

```text
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
sort_by: asset_growth
sort_order: DESC
```

## Run A Time-Series Analysis

Prompt:

```text
Analyze North Carolina banks from 20211231 through 20250630 and identify sustained asset-growth streaks.
```

Expected tool:

- `fdic_compare_bank_snapshots`

Expected parameters:

```text
state: North Carolina
start_repdte: 20211231
end_repdte: 20250630
analysis_mode: timeseries
sort_by: asset_growth_pct
sort_order: DESC
```

## Build A Peer Group

Prompt:

```text
Build a peer group for CERT 29846 at 20241231 and rank it against peers on ROA and efficiency ratio.
```

Expected tool:

- `fdic_peer_group_analysis`

Expected parameters:

```text
cert: 29846
repdte: 20241231
```

## Response Model

All tools return:

- human-readable text in `content`
- machine-readable data in `structuredContent`

Use the machine-readable payload for follow-on automation or tool chaining.
