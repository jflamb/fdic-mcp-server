# Bank Deep Dive Skill Design

**Date:** 2026-03-29
**Status:** Draft
**Skill file:** `.claude/commands/fdic-bank-deep-dive.md`

## Overview

A comprehensive single-institution analysis report generated from public FDIC data. Chains 9 MCP tools into a fixed 10-section narrative report covering health assessment, financial performance, peer benchmarking, credit concentration, funding profile, securities portfolio, franchise footprint, and economic context.

Serves multiple roles with a single skill: board directors (self-assessment), credit analysts (counterparty risk), fintech partnership managers (sponsor bank evaluation), deposit brokers (placement screening), M&A analysts (target profiling), investors (equity research), compliance officers (CRA context), and journalists/researchers (general bank analysis).

## Skill Metadata

```yaml
---
name: fdic-bank-deep-dive
description: >
  Comprehensive single-institution analysis report from public FDIC data.
  Produces a narrative covering health assessment, financial performance,
  peer benchmarking, credit concentration, funding profile, securities
  portfolio, franchise footprint, and economic context. Use when the user
  asks to "analyze a bank," "deep dive on an institution," "tell me
  everything about [bank name]," or needs counterparty due diligence,
  sponsor bank evaluation, board prep, or general bank research. Accepts
  a bank name or FDIC certificate number.
# NOTE: The MCP tool ID prefix (UUID) is session-specific and must be
# verified at runtime.
allowed_tools: [
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_search_institutions",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_get_institution",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_bank_health",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_ubpr_analysis",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_peer_group_analysis",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_credit_concentration",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_funding_profile",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_securities_portfolio",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_franchise_footprint",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_regional_context"
]
---
```

**Skill type:** RIGID — fixed section order, fixed tool chain with a fixed dependency structure, every section always present in the output. Sections degrade gracefully when tools return partial data or fail; the report structure is never truncated.

## Relationship to Examiner Overlay

The examiner overlay (`/fdic-examiner-overlay`) is an interactive, multi-turn workflow that collects qualitative examiner judgment and blends it with public data. It requires domain expertise to use and produces a blended assessment with three-layer provenance attribution.

The Bank Deep Dive is the public-data-only counterpart. It is fully automated (no qualitative inputs), uses a single source layer (no provenance blending needed), and produces a self-contained narrative report. The two skills are complementary: the Deep Dive can serve as a starting point before an examiner decides whether to apply the overlay.

## Input Gate

### Step 1: Collect Input

Prompt the user:

> "Which institution would you like to analyze? Provide a bank name or FDIC certificate number, and optionally a report date (YYYYMMDD)."

### Step 2: Resolve to CERT

**Path A — CERT provided directly:**

Call `fdic_get_institution` with the CERT. Present the identity confirmation regardless of match quality:

> "I found **[name]** (CERT [cert]) in [city], [state] — $[assets] in total assets. Is this the institution you mean?"

If the institution is inactive (ACTIVE: 0), warn that financials will be historical and proceed only on confirmation. If not found, stop and report.

**Path B — Bank name provided:**

Use a tiered search strategy:

1. **Exact quoted search (active):** `NAME:"[user input]" AND ACTIVE:1`. If results are returned, move to candidate ranking.
2. **Loose token-based search (active fallback):** If zero results from the exact search, retry with a looser token-based name search, still filtered to `ACTIVE:1`. If the user included geographic hints (state names, city names, abbreviations), fold those into the filter (e.g., add `STALP` or `STNAME` constraints).
3. **Inactive fallback:** If zero active results after both passes, retry the exact and loose searches without the `ACTIVE:1` filter. If inactive matches are found, present them with an explicit warning that financials will be historical. The user must confirm before proceeding.
4. **Zero results after all passes:** Stop. Ask the user to refine or provide CERT directly.

**Candidate ranking:** Rank results by:

- Exact name match (strongest signal)
- Location consistency with any geographic hints the user provided
- Asset size (tiebreaker only, not identity proof)

**Always confirm the selected institution**, even if there is a single strong match:

> "I found **[name]** (CERT [cert]) in [city], [state] — $[assets] in total assets. Is this the institution you mean?"

If 2-5 plausible candidates exist, present a numbered disambiguation list ranked by the criteria above:

> "I found multiple matches for '[input]':
> 1. **[name]** (CERT [cert]) — [city], [state] — $[assets]
> 2. **[name]** (CERT [cert]) — [city], [state] — $[assets]
> ...
>
> Which institution would you like to analyze?"

If more than 5 matches, ask the user to narrow with state, city, or CERT.

**Stop conditions:**

- Zero results from search — stop, ask user to refine
- Institution found but inactive — warn, proceed only with user confirmation
- Search fails (API error) — report error, stop
- User provides neither name nor CERT — re-prompt

### Step 3: Validate report date

If the user provided a `repdte`, validate before proceeding:

- Must be exactly 8 digits in `YYYYMMDD` format
- Must be a quarter-end date: month/day must be one of `0331`, `0630`, `0930`, `1231`
- If invalid, suggest the most recent completed quarter-end before the given date (e.g., `20250115` suggests `20241231`, not `20250331`)

If no `repdte` provided, omit from all subsequent tool calls (tools default to latest available quarter).

**Hard boundary:** Do not proceed to the tool chain without a confirmed CERT and a validated (or omitted) `repdte`.

## Tool Chain & Dependency Structure

After the input gate confirms CERT and optional `repdte`, the skill executes a fixed tool chain. Tool chain steps 1-3 (institution profile, health assessment, financial performance) are hard dependencies that must succeed. Tool chain steps 4-9 execute independently after the hard-dependency stage completes and can run concurrently where the runtime supports it.

### Dependency tiers

| Step | Tool | Section | Tier |
|------|------|---------|------|
| 1 | `fdic_get_institution` | 1. Institution Profile | Hard — failure stops the report |
| 2 | `fdic_analyze_bank_health` | 2. Health Assessment | Hard — failure stops the report |
| 3 | `fdic_ubpr_analysis` | 3. Financial Performance | Hard — failure stops the report |
| 4 | `fdic_peer_group_analysis` | 4. Peer Benchmarking | Soft — degrades gracefully |
| 5 | `fdic_analyze_credit_concentration` | 5. Credit & Concentration | Soft — degrades gracefully |
| 6 | `fdic_analyze_funding_profile` | 6. Funding & Liquidity | Soft — degrades gracefully |
| 7 | `fdic_analyze_securities_portfolio` | 7. Securities Portfolio | Soft — degrades gracefully |
| 8 | `fdic_franchise_footprint` | 8. Geographic Franchise | Context — annual SOD data, may lag |
| 9 | `fdic_regional_context` | 9. Economic Context | Context — depends on FRED availability |
| — | *(synthesized)* | 10. Risk Summary & Outlook | Adapts to collected data |

### Degradation rules

**Hard dependencies (steps 1-3):** If any fails, stop the report and tell the user what went wrong. These are the minimum viable report.

**Soft dependencies (steps 4-7):** Always attempt. If a tool returns partial data, render the section with what is available and note the gap. If a tool fails entirely, render the section header with a normalized user-facing message. Distinguish three states:

- **Full data:** Render normally.
- **Structural immateriality:** The data is legitimately zero or minimal because of the institution's business model (e.g., a pure lender with near-zero securities). Narrate as a real finding, not a data gap.
- **Data unavailable:** The tool failed or returned incomplete data. Use normalized error messaging (e.g., "data unavailable for the selected report date," "insufficient peer institutions for meaningful comparison"). Do not expose raw tool internals.

**Context dependencies (steps 8-9):** Always attempt. Same three-state degradation model. Section 9 falls back to a limited narrative based on the institution's primary state and geographic footprint when FRED data is unavailable — no improvisation from undefined sources.

### Date basis transparency

When the report mixes data from different temporal bases, each section explicitly states its basis:

- Quarterly financial sections: "As of report date `YYYYMMDD`"
- Franchise footprint: "Using annual SOD data as of June 30, `YEAR`"
- Economic context: "Macro context referenced to `YYYYMMDD`, using trailing two-year FRED series when available"

### SOD year derivation

The franchise footprint tool requires an annual `year` argument. Derive it deterministically from the analysis date:

- Use the most recent SOD year where June 30 of that year does not exceed the confirmed analysis date.
- Example: `repdte=20251231` uses SOD year 2025 (June 30, 2025 ≤ Dec 31, 2025).
- Example: `repdte=20250331` uses SOD year 2024 (June 30, 2024 ≤ March 31, 2025; June 30, 2025 would exceed the analysis date).
- When `repdte` is omitted (defaulting to latest available quarter), omit the `year` argument and let the tool default to the most recent available SOD year.

## Section Templates

Every section follows a consistent pattern: **heading, date basis, key metrics (table or identity block), narrative interpretation.** The narrative within each section adapts to the data — a bank with critical risk signals gets different treatment than one with a clean assessment.

### Section 1: Institution Profile

**Tool:** `fdic_get_institution`

Identity block (fixed format):

```
## 1. Institution Profile

**[Name]** (CERT [cert])
[City], [State] | Charter: [class] | Regulator: [regulator]
Established: [date] | Holding Company: [name] (if available)
Total Assets: $[amount] | Total Deposits: $[amount] | Offices: [count]
```

Holding company is conditional: show if `NAMHCR` is present in the tool response, omit the field if the institution is independent or the field is empty.

Brief narrative paragraph covering charter type, regulatory framework, size context (community bank / regional / large), and holding company relationship if applicable. Factual orientation only — no interpretive judgment in this section.

### Section 2: Health Assessment

**Tool:** `fdic_analyze_bank_health`

```
## 2. Health Assessment
*As of report date [YYYYMMDD]*
```

Proxy assessment summary table:

| Component | Score | Rating | Key Flag |
|-----------|-------|--------|----------|
| Capital | | | PCA: [category] |
| Asset Quality | | | |
| Earnings | | | |
| Liquidity/Funding | | | |
| Sensitivity Proxy | | | |
| **Overall** | | **[band]** | |

Risk signals summary (count by severity). Trend insights from the proxy assessment (phrased as available trend observations, not guaranteed per-component trend lines).

Narrative interpreting the overall health picture: what is strong, what is under pressure, what the trend trajectory suggests.

### Section 3: Financial Performance

**Tool:** `fdic_ubpr_analysis`

```
## 3. Financial Performance
*As of report date [YYYYMMDD]*
```

Key ratios table:

| Metric | Value | YoY Change |
|--------|-------|------------|
| ROA | | |
| ROE | | |
| Net Interest Margin | | |
| Efficiency Ratio | | |
| Pretax ROA | | |

Additional coverage: loan mix breakdown, capital adequacy ratios (Tier 1 leverage, Tier 1 risk-based, equity ratio), liquidity snapshot (loan-to-deposit, core deposit ratio), and YoY growth rates (assets, loans, deposits).

Narrative interprets profitability trends, margin dynamics, efficiency, and growth trajectory. **This section is standalone operating performance — no peer-relative language.** Benchmarking context lives in Section 4.

### Section 4: Peer Benchmarking

**Tool:** `fdic_peer_group_analysis`

```
## 4. Peer Benchmarking
*As of report date [YYYYMMDD] | Peer set: [count] institutions ([charter class], [asset range])*
```

**Peer-set quality disclosure:** If the peer set is thin (fewer than 10 institutions), note explicitly: *"Thin peer cohort — rankings should be interpreted with caution."* If auto-broadened from default criteria, state the broadening parameters. If peer set is robust, state the count and criteria without caveat.

Rankings table:

| Metric | Value | Rank | Percentile | Peer Median |
|--------|-------|------|------------|-------------|
| Total Assets | | | | |
| ROA | | | | |
| ROE | | | | |
| NIM | | | | |
| Efficiency Ratio | | | | |
| Equity Capital Ratio | | | | |
| Loan-to-Deposit Ratio | | | | |

**n/a handling:** If rank or percentile is unavailable for a specific metric (denominator differences, missing peer values), show "n/a" in the table. The narrative does not interpret metrics with unavailable rankings.

Narrative highlights where the institution stands out (top/bottom quartile), where it is in line with peers, and notable divergences.

### Section 5: Credit & Concentration

**Tool:** `fdic_analyze_credit_concentration`

```
## 5. Credit & Concentration
*As of report date [YYYYMMDD]*
```

Loan portfolio composition table (CRE, C&I, consumer, residential, agricultural shares). CRE and construction concentration relative to total capital, with comparison to interagency guidance thresholds (300% CRE, 100% construction).

**Threshold framing:** Interagency guidance thresholds are screening indicators, not automatic adverse judgments. A bank can exceed 300% CRE concentration and be well-managed if other conditions (risk management practices, historical performance, capital levels) support it. The narrative contextualizes threshold exceedances rather than treating them mechanically.

For non-lending institutions or those with structurally low loan balances, narrate as a business model characteristic, not a data limitation.

### Section 6: Funding & Liquidity

**Tool:** `fdic_analyze_funding_profile`

```
## 6. Funding & Liquidity
*As of report date [YYYYMMDD]*
```

Deposit composition (core, brokered, foreign shares), wholesale funding reliance, FHLB advances relative to assets, cash ratio.

Narrative interprets funding stability, flags brokered deposit reliance or wholesale funding concentration, and contextualizes the institution's liquidity position. Distinguishes between "brokered deposit data unavailable" (degradation) and "zero brokered deposits" (real finding about the institution's funding model).

### Section 7: Securities Portfolio

**Tool:** `fdic_analyze_securities_portfolio`

```
## 7. Securities Portfolio
*As of report date [YYYYMMDD]*
```

Securities relative to total assets and capital, MBS concentration within the portfolio. Note that AFS/HTM breakdown is not available from the FDIC API.

Narrative interprets portfolio size and concentration risk. For institutions with minimal securities holdings, frame as a structural characteristic of the business model rather than a data limitation.

### Section 8: Geographic Franchise

**Tool:** `fdic_franchise_footprint`

```
## 8. Geographic Franchise
*Using annual SOD data as of June 30, [YEAR]*
```

**Reconciliation warning:** Annual SOD deposit totals are branch-level figures as of June 30 and may not reconcile exactly to quarterly balance-sheet deposits reported in other sections of this report.

Total branch count, deposit total, and market count. Market-by-market breakdown sorted by deposits (top markets with branch count, deposit total, and share of institution's deposits).

Narrative describes geographic concentration or diversification, identifies primary markets, and notes any single-market dependency.

### Section 9: Economic Context

**Tool:** `fdic_regional_context`

```
## 9. Economic Context
*Macro context referenced to [YYYYMMDD], using trailing two-year FRED series when available*
```

State and national unemployment rates with trend, federal funds rate and rate environment classification. Narrative assessment of how the macro environment affects the institution's operating conditions given its geographic footprint and business model.

**FRED unavailable fallback:** If FRED data is unavailable, the section falls back to a limited narrative based on the institution's primary state and geographic footprint, without macro time series. The limitation is stated explicitly. No improvisation from undefined sources.

### Section 10: Risk Summary & Outlook

**No tool — synthesized from all preceding sections.**

```
## 10. Risk Summary & Outlook
```

Structure:

1. **Strengths** — 2-3 bullet points on what is working well (drawn from health scores, peer standings, funding stability, etc.)
2. **Risks & Watchpoints** — 2-3 bullet points on areas of concern (risk signals, concentration issues, funding pressures, peer underperformance, adverse macro trends)
3. **Outlook narrative** — A short paragraph synthesizing the overall picture: stable trajectory, improving, or facing headwinds. Conditional on evidence from preceding sections. No speculative catalyst language unsupported by the tools.

The synthesis adapts to data quality. If context sections (8-9) degraded, the outlook acknowledges the gaps rather than speculating past available data.

## Report Envelope

### Header (before Section 1)

```
# Bank Deep Dive: [Institution Name]
*Generated [current date] from public data sources*

> This report is generated from public FDIC data and, where available,
> FRED macroeconomic data using the public_camels_proxy_v1 analytical
> model. It is not an official CAMELS rating, supervisory assessment,
> or investment recommendation. Monetary amounts are reported in
> thousands of dollars unless otherwise noted.
```

### Footer (after Section 10)

```
---
*Source: FDIC BankFind Suite API, FRED | Analytical model: public_camels_proxy_v1*
*This report reflects publicly available data as of the dates noted in each section.*
*It is not an official regulatory assessment and should not be used as the sole basis for financial decisions.*
```

No per-paragraph attribution. Every data point comes from the same source layer (public data). Per-paragraph tagging would be noise.

## Output & Save

**Default:** Report renders inline in the conversation.

**Optional save:** If the user asks to save, write the report as a markdown file:

- With `repdte`: `[CERT]-deep-dive-[repdte].md`
- Without `repdte`: `[CERT]-deep-dive-latest.md`

Saved to the current working directory.
