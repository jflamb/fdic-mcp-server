---
title: Prompting Guide
nav_group: user
kicker: User Docs
summary: Write prompts that state the right dataset, date basis, geography, and comparison logic so the server can choose the right tool reliably.
breadcrumbs:
  - title: Overview
    url: /
  - title: User Docs
    url: /user-guide/
---

This server works best when prompts are explicit about the dataset, time basis, geography, and ranking criteria.

## Prompting Principles

- Name the institution, state, or peer group clearly.
- State the date basis when using quarterly or annual FDIC data.
- Ask for ranking criteria explicitly when comparing institutions.
- Prefer one analysis question per prompt unless you want the model to chain tools.
- Distinguish between quarterly financial data and annual branch deposit data.

## Date Rules

- You can describe dates naturally in prompts. The model or tool layer may translate them into `REPDTE` values behind the scenes when needed.
- Financial and demographics queries use `REPDTE` in `YYYYMMDD` format at the tool/query level.
- Summary queries use `YEAR` rather than `REPDTE`.
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

## Copy-Paste Analysis Prompts

These prompts are intentionally narrow enough to return a clear answer in one pass, while still requiring deeper server-side analysis.

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
## Repo Shortcuts

For maintainer-oriented issue triage in agentic environments, you can use two repo-specific prompt shorthands:

- `/issue-batch <label>` to generate and review the proposed batches before choosing execution scope
- `/issue-batch-run <label>` to generate the batches and then work through them sequentially using the repo working norms

Example:

```text
/issue-batch bug
```

Expected agent behavior:

- Run `npm run issues:batch -- --label bug`
- Review the generated markdown brief
- Propose or execute one coherent batch at a time using the repo working norms in `AGENTS.md`

Execution-mode example:

```text
/issue-batch-run bug
```

Expected agent behavior:

- Run `npm run issues:batch -- --label bug`
- Review the generated markdown brief and confirm the first coherent batch
- For each batch, follow the working norms in `AGENTS.md`: restate acceptance criteria, refresh from `main`, create a dedicated branch, update `tasks/todo.md` for non-trivial work, implement root-cause fixes with tests, validate, open a PR, watch checks, merge when green, then continue to the next batch unless the user asks to stop

This is a repository convention rather than a GitHub or Codex built-in command. It works because the agent instructions in `AGENTS.md` define how the shorthand should be expanded.
