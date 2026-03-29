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
# verified at runtime. The tools below follow the pattern:
# mcp__<server-uuid>__<tool_name>
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

# /fdic-bank-deep-dive

## Skill Type: RIGID

This workflow has a fixed section order, a fixed tool chain with a fixed dependency structure, and every section is always present in the output. Sections degrade gracefully when tools return partial data or fail — the report structure is never truncated.

You MUST follow every step in order. You MUST NOT skip sections. You MUST NOT proceed to the tool chain without a confirmed CERT and validated report date.

All data in this report comes from public FDIC data and, where available, FRED macroeconomic data. There is no per-paragraph provenance attribution — every data point is public. Disclaimers appear at the top and bottom of the report only.

---

## Step 1: Collect Input

Ask the user:

> "Which institution would you like to analyze? Provide a bank name or FDIC certificate number, and optionally a report date (YYYYMMDD)."

---

## Step 2: Resolve to CERT

You must resolve the user's input to a confirmed FDIC Certificate Number before proceeding.

### Path A — CERT provided directly

If the user provides a numeric CERT:

1. Call `fdic_get_institution` with the provided `cert`.
2. If found, present the identity confirmation:
   > "I found **[NAME]** (CERT [CERT]) in [CITY], [STATE] — $[ASSET]K in total assets. Is this the institution you mean?"
3. If the institution is inactive (ACTIVE: 0), add a warning:
   > "Note: This institution is inactive. Financial data will be historical. Do you want to proceed?"
4. Proceed only after the user confirms.
5. If the CERT is not found, stop: "No FDIC-insured institution found with CERT [number]. Please check the number and try again."

### Path B — Bank name provided

Use a tiered search strategy. Always confirm the final selection with the user.

**Tier 1 — Exact quoted search (active only):**

Call `fdic_search_institutions` with filter `NAME:"[user input]" AND ACTIVE:1`, limit 10.

If results are returned, move to **Candidate Ranking** below.

**Tier 2 — Loose token-based search (active only):**

If Tier 1 returned zero results, retry with a looser token-based name search, still filtered to `ACTIVE:1`. If the user included geographic hints (state names, city names, two-letter abbreviations), fold those into the filter using `STALP` or `STNAME` constraints. Limit 10.

If results are returned, move to **Candidate Ranking** below.

**Tier 3 — Inactive fallback:**

If Tiers 1 and 2 both returned zero results, retry the Tier 1 and Tier 2 searches without the `ACTIVE:1` filter. If inactive matches are found, present them with an explicit warning:

> "No active institutions matched '[input]'. I found inactive matches — financial data will be historical."

Move to **Candidate Ranking** below.

**Zero results after all tiers:**

Stop. Ask the user to refine their search or provide a CERT number directly:

> "No FDIC-insured institution found matching '[input]'. Please try a different name, add a state or city, or provide the CERT number directly."

### Candidate Ranking

When search results are returned, rank candidates by:
1. Exact name match (strongest signal)
2. Location consistency with any geographic hints the user provided
3. Asset size (tiebreaker only — not identity proof)

**Single candidate or clear top match — always confirm:**

> "I found **[NAME]** (CERT [CERT]) in [CITY], [STATE] — $[ASSET]K in total assets. Is this the institution you mean?"

**2-5 plausible candidates — present a disambiguation list:**

> "I found multiple matches for '[input]':
> 1. **[NAME]** (CERT [CERT]) — [CITY], [STATE] — $[ASSET]K
> 2. **[NAME]** (CERT [CERT]) — [CITY], [STATE] — $[ASSET]K
> ...
>
> Which institution would you like to analyze?"

**More than 5 matches:**

> "I found more than 5 matches for '[input]'. Please narrow your search by adding a state, city, or providing the CERT number directly."

### Stop Conditions

Do NOT proceed past this step unless:
- A specific institution has been identified and confirmed by the user
- If inactive, the user has explicitly confirmed they want to proceed with historical data

Store the confirmed `cert` for all subsequent tool calls.

---

## Step 3: Validate Report Date

If the user provided a report date (`repdte`), validate it before proceeding:

1. **Format check:** Must be exactly 8 digits in `YYYYMMDD` format.
2. **Quarter-end check:** The month/day portion must be one of: `0331`, `0630`, `0930`, `1231`.
3. **If invalid:** Suggest the most recent completed quarter-end *before* the given date.
   - To compute: find the quarter-end that is on or before the given date, but never a future quarter-end.
   - Example: `20250115` → suggest `20241231` (not `20250331`, which would be in the future relative to mid-January)
   - Example: `20250815` → suggest `20250630`
   - Present the suggestion:
     > "Report dates must be quarter-end dates (March 31, June 30, September 30, or December 31). Did you mean [YYYYMMDD]?"
   - Wait for confirmation before proceeding.

If the user did not provide a report date, omit `repdte` from all subsequent tool calls. The tools will default to the latest available quarter.

### SOD Year Derivation

For the franchise footprint section (Step 8 of the tool chain), derive the SOD year deterministically from the analysis date:

- Use the most recent SOD year where June 30 of that year does **not** exceed the confirmed analysis date.
- `repdte=20251231` → SOD year 2025 (June 30, 2025 ≤ Dec 31, 2025)
- `repdte=20250331` → SOD year 2024 (June 30, 2024 ≤ March 31, 2025; June 30, 2025 would exceed it)
- If `repdte` is omitted, omit the `year` argument from `fdic_franchise_footprint` and let the tool default to the most recent available SOD year.

Store the confirmed `repdte` (or null) and derived `sod_year` (or null) for all subsequent tool calls.

### Hard Boundary

**Do NOT proceed to Step 4 (tool chain) without:**
- A confirmed CERT (from Step 2)
- A validated `repdte` or explicit omission (from this step)

---

## Step 4: Execute Tool Chain

Execute the following tools in order. Steps 1-3 are **hard dependencies** — if any fails, stop the report and tell the user what went wrong. Steps 4-9 are **soft/context dependencies** — execute them all after the hard dependencies succeed. Steps 4-9 have no dependencies on each other and can run concurrently where the runtime supports it.

### Hard Dependencies (must succeed)

| Tool Chain Step | Tool | Report Section |
|----------------|------|---------------|
| 1 | `fdic_get_institution` with `cert` | Section 1: Institution Profile |
| 2 | `fdic_analyze_bank_health` with `cert`, `repdte` (if provided) | Section 2: Health Assessment |
| 3 | `fdic_ubpr_analysis` with `cert`, `repdte` (if provided) | Section 3: Financial Performance |

If any of these three calls fails, stop immediately:

> "The report cannot be generated. [Tool name] failed: [brief normalized description]. Please verify the CERT number and report date, or try again later."

Do NOT expose raw error messages or tool internals. Use normalized descriptions:
- "Institution data could not be retrieved"
- "Health assessment data is unavailable for the selected report date"
- "Financial performance data is unavailable for the selected report date"

### Soft and Context Dependencies (degrade gracefully)

| Tool Chain Step | Tool | Report Section | Notes |
|----------------|------|---------------|-------|
| 4 | `fdic_peer_group_analysis` with `cert`, `repdte` (if provided) | Section 4: Peer Benchmarking | May return thin peer sets |
| 5 | `fdic_analyze_credit_concentration` with `cert`, `repdte` (if provided) | Section 5: Credit & Concentration | May show zeros for non-lenders |
| 6 | `fdic_analyze_funding_profile` with `cert`, `repdte` (if provided) | Section 6: Funding & Liquidity | Brokered deposit data may be unavailable |
| 7 | `fdic_analyze_securities_portfolio` with `cert`, `repdte` (if provided) | Section 7: Securities Portfolio | AFS/HTM breakdown unavailable; may show minimal holdings |
| 8 | `fdic_franchise_footprint` with `cert`, `year` (derived SOD year, or omit) | Section 8: Geographic Franchise | Annual SOD data — different temporal basis |
| 9 | `fdic_regional_context` with `cert`, `repdte` (if provided) | Section 9: Economic Context | Depends on FRED API availability |

### Degradation Rules

For each soft/context dependency, handle three states:

**Full data:** Render the section normally using the section template below.

**Structural immateriality:** The data is legitimately zero or minimal because of the institution's business model (e.g., a pure lender with near-zero securities, a non-lending trust company). Narrate this as a **real finding about the institution**, not a data gap. Example: "This institution maintains a minimal securities portfolio, consistent with its lending-focused business model."

**Data unavailable:** The tool failed or returned incomplete results. Render the section header and date basis line, then a single normalized message. Do NOT expose raw tool internals. Use messages like:
- "Peer benchmarking data could not be retrieved for this institution."
- "Insufficient peer institutions for meaningful comparison."
- "Credit concentration data is unavailable for the selected report date."
- "Funding profile data is unavailable for the selected report date."
- "Securities portfolio data is unavailable for the selected report date."
- "Franchise footprint data is unavailable. Annual SOD data may not yet be published for the derived year."
- "Macro context is unavailable. The FRED economic data service did not return data for the institution's region."

After all tool calls complete (or degrade), proceed to Step 5 to render the report.

### Date Basis Transparency

Each section in the report must explicitly state its temporal basis:
- Quarterly financial sections (1-7): "As of report date `[YYYYMMDD]`" (or "As of most recent available quarter" if repdte was omitted)
- Franchise footprint (8): "Using annual SOD data as of June 30, `[YEAR]`"
- Economic context (9): "Macro context referenced to `[YYYYMMDD]`, using trailing two-year FRED series when available"

---

## Step 5: Render Report

Generate the report with the following structure. Every section is always present. Do NOT skip sections. Do NOT reorder sections.

### Report Header

Start the report with:

```
# Bank Deep Dive: [Institution Name]
*Generated [current date] from public data sources*

> This report is generated from public FDIC data and, where available,
> FRED macroeconomic data using the public_camels_proxy_v1 analytical
> model. It is not an official CAMELS rating, supervisory assessment,
> or investment recommendation. Monetary amounts are reported in
> thousands of dollars unless otherwise noted.
```

---

### Section 1: Institution Profile

*Tool data:* `fdic_get_institution` result

Present the identity block in this fixed format:

```
## 1. Institution Profile

**[NAME]** (CERT [CERT])
[CITY], [STATE] | Charter: [BKCLASS] | Regulator: [REGAGNT]
Established: [ESTYMD] | Holding Company: [NAMHCR]
Total Assets: $[ASSET]K | Total Deposits: $[DEP]K | Offices: [OFFICES]
```

**Holding company:** Show the "Holding Company:" line only if `NAMHCR` is present and non-empty in the tool response. Omit the entire line for independent institutions.

**Narrative:** One paragraph covering charter type, regulatory framework, size context (community bank if assets < $10B, regional if $10B-$100B, large if > $100B), and holding company relationship if applicable. Factual orientation only — no interpretive judgment.

---

### Section 2: Health Assessment

*Tool data:* `fdic_analyze_bank_health` result

```
## 2. Health Assessment
*As of report date [YYYYMMDD]*
```

Present the proxy assessment summary table:

| Component | Score | Rating | Key Flag |
|-----------|-------|--------|----------|
| Capital | [score] | [label] | PCA: [capital_classification] |
| Asset Quality | [score] | [label] | |
| Earnings | [score] | [label] | |
| Liquidity/Funding | [score] | [label] | |
| Sensitivity Proxy | [score] | [label] | |
| **Overall** | [proxy_score] | **[proxy_band]** | |

Extract scores and labels from `structuredContent.proxy.components` and overall from `structuredContent.proxy.proxy_score` / `structuredContent.proxy.proxy_band`.

**Risk signals:** Summarize by severity count: "[N] risk signals ([X] critical, [Y] warning, [Z] info)". List any critical signals by name.

**Trend insights:** Report available trend observations from the proxy assessment. Phrase as observations ("Asset quality scores have improved over the trailing four quarters") rather than guaranteed per-component trend lines.

**Narrative:** Interpret the overall health picture — what is strong, what is under pressure, what the trend trajectory suggests. Reference specific component scores and risk signals.

---

### Section 3: Financial Performance

*Tool data:* `fdic_ubpr_analysis` result

```
## 3. Financial Performance
*As of report date [YYYYMMDD]*
```

**Key ratios table:**

| Metric | Value | YoY Change |
|--------|-------|------------|
| ROA | [roa]% | [yoy_change] |
| ROE | [roe]% | [yoy_change] |
| Net Interest Margin | [nim]% | [yoy_change] |
| Efficiency Ratio | [efficiency]% | [yoy_change] |
| Pretax ROA | [pretax_roa]% | [yoy_change] |

**Additional coverage (as available from tool results):**
- **Loan mix:** Real estate, commercial, consumer, agricultural shares
- **Capital adequacy:** Tier 1 leverage ratio, Tier 1 risk-based ratio, equity-to-assets ratio
- **Liquidity snapshot:** Loan-to-deposit ratio, core deposit ratio
- **YoY growth rates:** Asset growth, loan growth, deposit growth

**Narrative:** Interpret profitability trends, margin dynamics, efficiency, and growth trajectory. This section is standalone operating performance — do NOT use peer-relative language like "above average" or "below median." Benchmarking context belongs in Section 4.

---

### Section 4: Peer Benchmarking

*Tool data:* `fdic_peer_group_analysis` result

```
## 4. Peer Benchmarking
*As of report date [YYYYMMDD] | Peer set: [peer_count] institutions ([charter_classes], $[asset_min]K–$[asset_max]K)*
```

**Peer-set quality disclosure:**
- If peer count < 10: Add italic note: *"Thin peer cohort — rankings should be interpreted with caution."*
- If the tool auto-broadened the peer criteria: State the broadening parameters (e.g., "Peer criteria broadened from default asset range to achieve minimum cohort size.")
- If peer count ≥ 10 and no broadening: State count and criteria without caveat.

**Rankings table:**

| Metric | Value | Rank | Percentile | Peer Median |
|--------|-------|------|------------|-------------|
| Total Assets | | | | |
| ROA | | | | |
| ROE | | | | |
| NIM | | | | |
| Efficiency Ratio | | | | |
| Equity Capital Ratio | | | | |
| Loan-to-Deposit Ratio | | | | |

Populate from `structuredContent.rankings`. If rank or percentile is unavailable for a specific metric (denominator differences, missing peer values), show "n/a" in that cell.

**Narrative:** Highlight where the institution stands out (top or bottom quartile), where it is in line with peers, and notable divergences. Do NOT interpret metrics that show "n/a" for rank/percentile.

---

### Section 5: Credit & Concentration

*Tool data:* `fdic_analyze_credit_concentration` result

```
## 5. Credit & Concentration
*As of report date [YYYYMMDD]*
```

**Loan portfolio composition** (from tool results):
- CRE share, C&I share, consumer share, residential share, agricultural share
- CRE concentration relative to total capital (compare to 300% interagency guidance threshold)
- Construction concentration relative to total capital (compare to 100% interagency guidance threshold)
- Loan-to-asset ratio

**Threshold framing rule:** Interagency guidance thresholds (300% CRE, 100% construction) are screening indicators, not automatic adverse judgments. The narrative MUST contextualize any exceedance rather than treating it mechanically. A bank can exceed these thresholds and be well-managed if risk management practices, historical performance, and capital levels support it.

**Structural immateriality:** For non-lending institutions or those with structurally low loan balances, narrate the low loan portfolio as a characteristic of the institution's business model, not a data limitation. Example: "As a trust-focused institution, [Name] maintains a minimal loan portfolio, with the majority of assets held in securities and cash equivalents."

**Narrative:** Interpret portfolio mix, flag concentration risks per supervisory guidance with appropriate context, and note the overall credit risk posture.

---

### Section 6: Funding & Liquidity

*Tool data:* `fdic_analyze_funding_profile` result

```
## 6. Funding & Liquidity
*As of report date [YYYYMMDD]*
```

**Key metrics** (from tool results):
- Core deposit share, brokered deposit share, foreign deposit share
- Wholesale funding reliance (as % of assets)
- FHLB advances relative to assets
- Cash ratio

**Data distinction rule:** Distinguish between "brokered deposit data unavailable" (tool returned incomplete data — degradation) and "zero brokered deposits" (the institution does not use brokered funding — real finding). The same applies to foreign deposits and wholesale funding.

**Narrative:** Interpret funding stability, flag brokered deposit reliance or wholesale funding concentration if present, and contextualize the institution's liquidity position.

---

### Section 7: Securities Portfolio

*Tool data:* `fdic_analyze_securities_portfolio` result

```
## 7. Securities Portfolio
*As of report date [YYYYMMDD]*
```

**Key metrics** (from tool results):
- Securities relative to total assets
- Securities relative to capital
- MBS concentration within the portfolio
- Note: AFS/HTM breakdown is not available from the FDIC API.

**Structural immateriality:** For institutions with minimal securities holdings, frame as a structural characteristic. Example: "This institution maintains a minimal securities portfolio at [X]% of total assets, consistent with its lending-focused business model. Securities concentration risk is not a material factor."

**Narrative:** Interpret portfolio size and concentration risk. For institutions with significant holdings, discuss MBS concentration and potential interest-rate exposure.

---

### Section 8: Geographic Franchise

*Tool data:* `fdic_franchise_footprint` result

```
## 8. Geographic Franchise
*Using annual SOD data as of June 30, [YEAR]*
```

**Reconciliation warning** (always include): *"Note: Annual SOD deposit totals are branch-level figures as of June 30 and may not reconcile exactly to quarterly balance-sheet deposits reported in other sections of this report."*

**Key metrics** (from tool results):
- Total branch count
- Total deposits (SOD basis)
- Number of markets (MSAs)
- Market-by-market breakdown (top markets sorted by deposits): market name, branch count, deposit total, share of institution's total deposits

**Narrative:** Describe geographic concentration or diversification, identify primary markets, and note any single-market dependency (e.g., if one MSA holds > 50% of deposits).

---

### Section 9: Economic Context

*Tool data:* `fdic_regional_context` result

```
## 9. Economic Context
*Macro context referenced to [YYYYMMDD], using trailing two-year FRED series when available*
```

**When FRED data is available:**
- State unemployment rate and trend (improving / stable / deteriorating)
- National unemployment rate and trend
- Federal funds rate and rate environment classification
- Narrative: How the macro environment affects this institution's operating conditions given its geographic footprint and business model.

**When FRED data is unavailable (fallback):**

Render the section with:

> *FRED economic data is currently unavailable. This section provides limited context based on the institution's geographic footprint without macro time series.*

Then provide a brief narrative based solely on the institution's primary state and geographic footprint (from Section 1 and Section 8 data). Do NOT improvise macro data from undefined sources. Do NOT speculate about economic conditions without FRED data to support the claims.

---

### Section 10: Risk Summary & Outlook

*No tool — synthesized from all preceding sections.*

```
## 10. Risk Summary & Outlook
```

**Structure (always follow this order):**

1. **Strengths** — 2-3 bullet points drawn from evidence in preceding sections. Examples: strong capital position, above-peer profitability, stable funding base, improving asset quality trend, well-diversified franchise.

2. **Risks & Watchpoints** — 2-3 bullet points drawn from evidence in preceding sections. Examples: critical risk signals, CRE concentration exceeding guidance thresholds, declining NIM trend, brokered deposit reliance, thin peer cohort, single-market franchise dependency, adverse macro trends.

3. **Outlook** — A short paragraph (3-5 sentences) synthesizing the overall picture. Is the institution on a stable trajectory, improving, or facing headwinds? What conditions would change the assessment?

**Evidence-bounded rule:** Every strength, risk, and outlook statement MUST be traceable to a specific finding in the preceding sections. Do NOT introduce new analysis, speculative catalyst language, or forward-looking claims unsupported by the data. If context sections (8-9) degraded, the outlook MUST acknowledge the gaps rather than speculating past available data.

---

### Report Footer

End the report with:

```
---
*Source: FDIC BankFind Suite API, FRED | Analytical model: public_camels_proxy_v1*
*This report reflects publicly available data as of the dates noted in each section.*
*It is not an official regulatory assessment and should not be used as the sole basis for financial decisions.*
```

---

## Step 6: Optional Save

The report renders inline in the conversation by default. Do NOT automatically save to a file.

If the user asks to save the report, write it as a markdown file:

- If `repdte` was provided: `[CERT]-deep-dive-[repdte].md` (e.g., `3511-deep-dive-20251231.md`)
- If `repdte` was omitted: `[CERT]-deep-dive-latest.md` (e.g., `3511-deep-dive-latest.md`)

Save to the current working directory. Confirm the filename and path to the user after saving.