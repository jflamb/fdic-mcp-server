---
name: fdic-failure-forensics
description: >
  Retrospective failure-forensics workflow for a single FDIC-insured institution.
  Reconstructs the pre-failure financial timeline from public FDIC data, identifies
  the earliest visible warning signals, and explains likely drivers of deterioration.
  Use when the user asks to analyze a bank failure, reconstruct what happened before
  a bank failed, review a failed institution for training or pattern recognition,
  or perform a post-mortem on a specific FDIC failure event.
---

# FDIC Failure Forensics

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not produce any report output before completing Phase 3.

---

## When to Activate

Activate when the user asks to:
- Analyze or reconstruct a bank failure
- Review what public data showed before a specific institution failed
- Perform a post-mortem or forensic review of a failed bank
- Identify early warning signals that preceded a failure
- Study a failed institution for training, pattern recognition, or case-study purposes

Do **not** activate for:
- Active institution deep dives — use the `fdic-bank-deep-dive` skill instead
- Multi-institution surveillance or screening — use the `fdic-portfolio-surveillance` skill instead

---

## Inputs

| Parameter | Required | Default | Description |
|---|---|---|---|
| Institution identity | Yes | — | Failed bank name or FDIC CERT number |
| Pre-failure report date | No | Last quarter-end before failure date | The most recent Call Report quarter before the failure |
| Lookback window | No | 8 quarters | Number of quarters before the pre-failure report date to include in the timeline |
| Focus area | No | Overall failure narrative | Optional: `funding`, `credit`, `earnings`, or `overall` |

---

## Dependency Table

| Tool | Tier | Purpose | On Failure |
|---|---|---|---|
| `fdic_search_institutions` | **Hard** | Resolve institution identity and confirm CERT | **Hard-stop.** Cannot identify the institution. |
| `fdic_get_institution_failure` | **Hard** | Retrieve failure record (date, resolution type, cost, acquirer) | **Hard-stop.** Cannot confirm this is a failed institution. |
| `fdic_search_financials` | **Hard** | Build the quarter-by-quarter pre-failure financial timeline | **Hard-stop.** Cannot reconstruct the deterioration path. |
| `fdic_detect_risk_signals` | **Hard** | Surface risk signals visible in the last reported quarter | **Hard-stop.** Cannot identify public-data warning signals. |
| `fdic_analyze_bank_health` | **Soft** | CAMELS-proxy assessment for the last reported quarter | Note "Detailed health assessment unavailable"; continue with raw financial and risk-signal evidence. |
| `fdic_search_history` | **Soft** | Structural events (mergers, charter changes) in the lookback window | Omit structural context; note the omission. |
| `fdic_analyze_funding_profile` | **Context** | Funding composition when deterioration implicates funding stress | Note "Funding follow-up unavailable"; preserve narrative. |
| `fdic_analyze_credit_concentration` | **Context** | Credit concentration when deterioration implicates credit risk | Note "Credit concentration follow-up unavailable"; preserve narrative. |
| `fdic_regional_context` | **Soft** | Macro/regional economic backdrop during the pre-failure period | Omit regional context section or replace with a brief note. |

---

## Phase 1 — Institution Resolution and Failure Confirmation

### Step 1: Resolve to CERT

Follow the same resolution logic as the `fdic-bank-deep-dive` skill:

**Path A — CERT provided directly:**
1. Call `fdic_search_institutions` with `filters: "CERT:<cert>"` and `fields: "CERT,NAME,CITY,STALP,ASSET,DEP,BKCLASS,ACTIVE,REPDTE,ESTYMD"`.
2. Present the identity confirmation to the user.

**Path B — Bank name provided:**
1. Search with `filters: "NAME:\"<name>\""`, limit 10. Include inactive institutions — do not filter by `ACTIVE:1` since the target is likely inactive.
2. If multiple candidates, present a disambiguation list.
3. Wait for user confirmation.

**Zero results:** Stop. Ask the user to refine their search or provide a CERT number.

### Step 2: Confirm failure

Call `fdic_get_institution_failure` with the confirmed `cert`.

If the tool returns no failure record, **hard-stop:**

> "CERT [number] ([name]) does not have a failure record in FDIC data. This workflow is designed for failed institutions only. For active institution analysis, use the deep-dive workflow."

If the failure record is returned, extract and record:
- `FAILDATE` — the failure date
- `RESTYPE` / `RESTYPE1` — resolution type
- `COST` — estimated cost to the DIF ($thousands)
- `QBFASSET` — total assets at failure ($thousands)
- `QBFDEP` — total deposits at failure ($thousands)
- `BIDNAME` — acquiring institution (if purchase & assumption)
- `CHCLASS` — charter class at failure

Present the failure confirmation:

> "**[NAME]** (CERT [CERT]) failed on [FAILDATE]. Resolution: [RESTYPE]. Estimated DIF cost: $[COST]K. Acquirer: [BIDNAME or 'None — payoff']. Proceeding with failure forensics."

### Step 3: Derive date parameters

**Pre-failure report date (`last_repdte`):**

If the user provided a specific pre-failure report date, validate it (must be `YYYYMMDD`, must be a quarter-end, must be before or equal to the failure date).

If not provided, derive the last quarter-end on or before the failure date:
- Failure `3/10/2023` → `last_repdte` = `20221231`
- Failure `7/28/2023` → `last_repdte` = `20230630`
- Failure `11/3/2023` → `last_repdte` = `20230930`

**Lookback start date (`lookback_start`):**

Compute the quarter-end that is `N` quarters before `last_repdte`, where `N` is the user's lookback window (default 8).

- `last_repdte` = `20221231`, lookback = 8 → `lookback_start` = `20201231`

Record: `last_repdte`, `lookback_start`, and `lookback_quarters`.

### Hard Boundary

Do NOT proceed to Phase 2 without:
- A confirmed CERT with a confirmed failure record
- A validated `last_repdte` and `lookback_start`

---

## Phase 2 — Data Collection

### Step 4: Build the pre-failure financial timeline

Call `fdic_search_financials` with:
- `cert: <cert>`
- `fields: "CERT,REPDTE,ASSET,DEP,NETINC,ROA,ROE,NETNIM,EQ,LNLSNET"`
- `sort_by: "REPDTE"`, `sort_order: "DESC"`
- `limit: <lookback_quarters + 2>` (buffer for edge cases)

Filter results to quarters between `lookback_start` and `last_repdte` inclusive. Record the quarter-by-quarter time series.

If zero financial records are returned, **hard-stop:**

> "No financial data found for CERT [cert] in the lookback window [lookback_start] to [last_repdte]. The institution may not have reported Call Report data for this period."

### Step 5: Detect risk signals

Call `fdic_detect_risk_signals` with:
- `certs: [<cert>]`
- `repdte: <last_repdte>`
- `quarters: <lookback_quarters>`
- `min_severity: "warning"`

Record all flagged signals (code, severity, category, message).

If the tool returns zero flagged signals, record this as a finding — it means the public-data proxy did not detect warning-level signals at the last reported quarter. This is analytically significant (the failure may have been driven by factors not visible in quarterly Call Report data).

If the tool errors, **hard-stop.**

### Step 6: Detailed health assessment (soft)

Call `fdic_analyze_bank_health` with:
- `cert: <cert>`
- `repdte: <last_repdte>`
- `quarters: <lookback_quarters>`

If the call succeeds, record:
- Proxy overall score and band
- Component scores (C, A, E, L, S)
- Risk signals from the proxy engine
- Trend insights

If the call fails, note: "Detailed health assessment unavailable for the pre-failure quarter." Continue with raw financial timeline and risk-signal data.

### Step 7: Structural event history (soft)

Call `fdic_search_history` with:
- `cert: <cert>`
- `limit: 20`
- `sort_by: "PROCDATE"`, `sort_order: "DESC"`

Filter to events within the lookback window. Record any mergers, charter changes, or other structural events.

If the call fails, note: "Structural event history unavailable." Omit this context from the report.

### Step 8: Domain-specific follow-up (conditional, context-tier)

Invoke domain tools **only when the risk signals or financial timeline implicate that domain:**

- **Funding stress signals present** OR deposits declined > 15% in the lookback window → call `fdic_analyze_funding_profile` with `cert`, `repdte: <last_repdte>`
- **Credit signals present** (e.g., `credit_deterioration`, `credit_deterioration_trending`, or `reserve_coverage_low` from `fdic_detect_risk_signals`) OR net loans (`LNLSNET`) grew > 20% while earnings declined in the lookback window → call `fdic_analyze_credit_concentration` with `cert`, `repdte: <last_repdte>`

If neither domain is implicated, skip these calls.

If a domain tool fails, note: "[Domain] follow-up unavailable." Preserve the narrative.

### Step 9: Regional context (soft)

Call `fdic_regional_context` with:
- `cert: <cert>`
- `repdte: <last_repdte>`

If unavailable, omit the regional context or write: "Regional economic context unavailable; macro conditions were not factored into the failure analysis."

---

## Phase 3 — Analysis and Report Assembly

Produce the report in the following fixed section order. Core sections (1–5, 8) are always present and degrade gracefully when data is unavailable. Enrichment sections (6, 7) are included only when the corresponding data was collected in Phase 2 — omit them entirely rather than rendering empty placeholders.

---

### Report Header

```
# Failure Forensics: [Institution Name]
*Generated [current date] from public FDIC data*

> This report reconstructs publicly available financial indicators preceding
> an FDIC-insured institution's failure. It is a retrospective analytical
> exercise, not a causal determination. Public Call Report data cannot capture
> liquidity runs, market sentiment, off-balance-sheet exposures, or
> confidential supervisory findings. All monetary amounts are in thousands
> of dollars unless otherwise noted.
```

---

### Section 1: Institution Identification

```
## 1. Institution Identification

**[NAME]** (CERT [CERT])
[CITY], [STATE] | Charter: [CHCLASS] | Established: [ESTYMD]
Total Assets at Failure: $[QBFASSET]K
Total Deposits at Failure: $[QBFDEP]K
```

Use institution profile data from Step 1 and failure record data from Step 2.

---

### Section 2: Failure Event Summary

```
## 2. Failure Event Summary
```

Present in this fixed format:

| Field | Value |
|---|---|
| Failure Date | [FAILDATE] |
| Resolution Type | [RESTYPE description] |
| Acquirer | [BIDNAME or "None — depositor payoff"] |
| Estimated DIF Cost | $[COST]K |
| Assets at Failure | $[QBFASSET]K |
| Last Reported Quarter | [last_repdte in YYYY-MM-DD format] |
| Lookback Window | [lookback_start] to [last_repdte] ([N] quarters) |

**Resolution type narrative:** Briefly explain the resolution mechanism (purchase and assumption vs. payoff) and identify the acquirer if applicable.

---

### Section 3: Pre-Failure Financial Timeline

```
## 3. Pre-Failure Financial Timeline
*Quarterly Call Report data from [lookback_start] to [last_repdte]*
```

**Timeline table:**

| Quarter | Assets ($K) | Deposits ($K) | Net Income ($K) | ROA (%) | ROE (%) | NIM (%) | Equity ($K) | Loans ($K) |
|---|---|---|---|---|---|---|---|---|
| [REPDTE] | [ASSET] | [DEP] | [NETINC] | [ROA] | [ROE] | [NETNIM] | [EQ] | [LNLSNET] |

Sort chronologically (earliest to latest).

**Trend narrative:** Describe the trajectory over the lookback window:
- Balance sheet trajectory: asset growth or contraction, deposit inflows or outflows
- Earnings trajectory: ROA/ROE trend, NIM compression or expansion
- Capital trajectory: equity changes, leverage direction
- Loan portfolio trajectory: growth, contraction, or composition shifts

Identify the **inflection point** — the quarter where deterioration became visible in the data, if one exists. If the financial data shows a gradual decline, state that. If the data appears stable through the last reported quarter, state that explicitly — this is an analytically important finding.

---

### Section 4: Earliest Warning Signals

```
## 4. Earliest Warning Signals
*Risk signals detected at [last_repdte]*
```

**If signals were detected:**

List each signal with its severity, category, and message. Group by severity (critical first, then warning, then info).

| Signal | Severity | Category | Description |
|---|---|---|---|
| [code] | [severity] | [category] | [message] |

**If the health assessment is available**, add the proxy summary:

- Proxy overall band: [band] (score: [score])
- Weakest components: [list components rated 3 or worse]
- Trend flags: [summarize trend insights]

**If no warning signals were detected:**

State this explicitly:

> "The public_camels_proxy_v1 model did not detect warning-level risk signals at the last reported quarter ([last_repdte]). This suggests that the factors driving this failure were either (a) not captured in quarterly Call Report data, (b) emerged between the last report date and the failure date, or (c) manifested in dimensions (liquidity runs, market confidence, off-balance-sheet exposures) that public financial ratios cannot observe."

This is a key forensic finding, not a gap to apologize for.

**If focus area was specified**, emphasize signals and metrics relevant to that domain.

---

### Section 5: Likely Failure Drivers

```
## 5. Likely Failure Drivers
*Analytical inference — not official supervisory findings*
```

Synthesize evidence from the financial timeline, risk signals, health assessment, and domain-specific analyses into a narrative of likely failure drivers.

**Structure:**

1. **Primary driver(s)** — The most probable cause(s) based on public data evidence. Each driver must cite specific metrics or signals from preceding sections.

2. **Contributing factors** — Secondary conditions that likely amplified the primary driver(s).

3. **What the data does not explain** — Explicitly acknowledge gaps. Common examples:
   - Deposit run timing and velocity (not visible in quarterly data)
   - Market confidence triggers (social media, analyst reports, news)
   - Off-balance-sheet exposures or contingent liabilities
   - Supervisory actions or consent orders (confidential)
   - Management decisions between the last report date and failure

**Labeling rule:** Every statement must be tagged as one of:
- **[Observed]** — Directly visible in the public data (e.g., "Securities/assets reached 56% at Q4 2022 [Observed]")
- **[Inferred]** — Analytical conclusion drawn from observed data (e.g., "The heavy securities concentration likely created significant unrealized losses as rates rose in 2022 [Inferred]")
- **[Unknown from public data]** — Cannot be determined from Call Report data (e.g., "The speed and scale of the deposit outflow in March 2023 [Unknown from public data]")

---

### Section 6: Domain Follow-Up (conditional)

Include this section only if domain-specific tools were invoked in Step 8.

```
## 6. Domain Analysis
```

**Funding Profile** (if invoked):
Summarize deposit composition, wholesale funding reliance, brokered deposit dependency, and how these relate to the failure narrative.

**Credit Concentration** (if invoked):
Summarize loan portfolio composition, CRE/construction concentrations relative to capital, and how these relate to the failure narrative.

If neither domain tool was invoked, omit this section entirely — do not include an empty placeholder.

---

### Section 7: Regional Context (if available)

```
## 7. Regional Context
*Macro conditions during the pre-failure period*
```

If FRED data is available, summarize:
- State and national unemployment trends
- Federal funds rate environment
- How macro conditions relate to the institution's failure trajectory

If unavailable:
> "Regional economic context unavailable from FRED. Macro conditions were not incorporated into this analysis."

---

### Section 8: Caveats / Limits of Public Data

```
## 8. Caveats and Limitations
```

Always include all of the following:

1. **Data source:** "This analysis uses publicly available FDIC Call Report data, FDIC failure records, and the `public_camels_proxy_v1` analytical engine. No confidential supervisory information was used."

2. **Temporal gap:** "The last reported quarter was [last_repdte]. The failure occurred on [FAILDATE]. Events between these dates — including deposit outflows, market reactions, and supervisory actions — are not captured in this analysis."

3. **Proxy disclaimer:** "All health scores and component ratings are derived from public FDIC data. These are not official CAMELS ratings and do not reflect confidential supervisory findings."

4. **Retrospective framing:** "This report is a retrospective reconstruction, not a predictive claim. Identifying signals in hindsight does not imply that failure was foreseeable at the time from public data alone."

5. **Data staleness** (if applicable): If `last_repdte` is more than 120 days before the failure date, note the gap explicitly.

6. **Domain gaps** (if applicable): Note any domain tools that were unavailable or not invoked.

---

### Report Footer

```
---
*Source: FDIC BankFind Suite API, FDIC Failure Records | Analytical model: public_camels_proxy_v1*
*This report reflects publicly available data as of the dates noted in each section.*
*It is a retrospective analytical exercise and should not be cited as an official failure determination.*
```

---

## Output Rules

- **Tone:** Neutral, forensic, supervisory-safe. Describe public-data observations and clearly labeled inferences. Do not overclaim causal certainty.
- **Observed vs. Inferred:** Every analytical statement in Section 5 must be tagged. This is non-negotiable.
- **Exact dates:** Always use exact dates. Never write "recently" or "as of the latest period" without specifying which period.
- **Three outcome states:** Distinguish "No data," "Not applicable," and "Tool failure" per the FDIC Skill Builder rules. Never collapse these into a generic "n/a."
- **Hindsight discipline:** Do not write "the bank should have" or "this clearly showed." Write "the data showed" and "this is consistent with."
- **Bounded output:** Default to a concise forensic narrative suitable for case-study review. Expand only if the user explicitly requests a longer reconstruction.
- **No supervisory impersonation:** Do not imply official findings, privileged exam conclusions, or confidential root-cause determinations unless the user separately provides such information and explicitly asks it to be incorporated.

---

## Error Handling Summary

| Condition | Action |
|---|---|
| Hard-dependency tool fails | Hard-stop. Report the error. Do not produce partial output. |
| Soft-dependency tool fails | Omit the section. Note the omission explicitly in the report. |
| Context-dependency tool fails | Silently omit or note briefly. Preserve all analytical results. |
| Institution not found | Report "No institution matched" and stop. |
| No failure record | Report "No failure record found for CERT [N]" and stop. Suggest the deep-dive skill. |
| No financial data in lookback window | Hard-stop. Report the data gap. |
| No risk signals detected | Report as a finding (analytically significant). Continue. |
| Temporal gap > 120 days between last report and failure | Add explicit staleness caveat. |
| Mixed date bases | State each date basis explicitly in Section headers and Caveats. |
