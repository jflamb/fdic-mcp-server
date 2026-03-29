---
name: fdic-portfolio-surveillance
description: >
  Comprehensive single-universe surveillance workflow from public FDIC data.
  Screens a defined cohort (state, asset range, or CERT list), ranks institutions
  by emerging risk and relative health, and produces a decision-ready watchlist
  with escalation drivers. Use when the user asks to screen, triage, rank, or
  build a watchlist for a group of FDIC-insured institutions.
---

# FDIC Portfolio Surveillance

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not produce output before completing Phase 3.

---

## When to Activate

Activate when the user asks to:
- Screen, triage, or surveil a group of institutions
- Build a watchlist for a state, asset tier, or peer cohort
- Rank banks by risk, health, or deterioration across a portfolio
- Identify which institutions in a universe warrant immediate attention
- Compare emerging risk signals across a population of banks

Do **not** activate for single-institution deep dives — use the `fdic-bank-deep-dive` skill instead.

---

## Inputs

| Parameter | Required | Default | Description |
|---|---|---|---|
| Universe definition | Yes | — | State (two-letter code), asset range (`asset_min` / `asset_max` in $thousands), or explicit CERT list |
| `repdte` | No | Most recent quarter with published data | Report date in `YYYYMMDD` format |
| `start_repdte` | No | Same quarter one year prior to `repdte` | Comparison start date for trend analysis |
| Ranking emphasis | No | Most concerning overall | Focus area: `capital`, `earnings`, `funding`, `growth`, or `overall` |
| Limit | No | 25 | Maximum institutions to return in the ranked watchlist |

---

## Dependency Table

| Tool | Tier | Purpose | On Failure |
|---|---|---|---|
| `fdic_search_institutions` | **Hard** | Build the screening universe roster | **Hard-stop.** Cannot determine cohort. |
| `fdic_detect_risk_signals` | **Hard** | Surface critical and warning-level signals per institution | **Hard-stop.** Cannot rank by risk. |
| `fdic_compare_peer_health` | **Hard** | Rank institutions by proxy composite and component scores | **Hard-stop.** Cannot produce peer-relative health context. |
| `fdic_compare_bank_snapshots` | **Hard** | Confirm trends via two-point financial comparison | **Hard-stop.** Cannot validate trend persistence. |
| `fdic_analyze_bank_health` | **Soft** | Detailed CAMELS-proxy assessment for escalated institutions | Note "detailed assessment unavailable" for that institution; preserve watchlist placement. |
| `fdic_analyze_funding_profile` | **Context** | Funding composition for escalated institutions flagged with funding-domain signals | Note "funding follow-up unavailable"; preserve triage result. |
| `fdic_analyze_credit_concentration` | **Context** | Credit concentration for escalated institutions flagged with credit-domain signals | Note "credit concentration follow-up unavailable"; preserve triage result. |
| `fdic_ubpr_analysis` | **Context** | UBPR-equivalent ratios for escalated institutions needing earnings or efficiency context | Note "UBPR analysis unavailable"; preserve triage result. |
| `fdic_regional_context` | **Soft** | Macro/regional economic backdrop for the universe | Omit the Regional Context section or replace with a brief note; do not affect bank-level rankings. |

---

## Phase 1 — Universe Construction

### Step 1: Build the institution roster

Call `fdic_search_institutions` with the user's universe definition.

- **State-based:** `filters: "STALP:<XX> AND ACTIVE:1"`, `fields: "CERT,NAME,ASSET,DEP,STALP,BKCLASS,ACTIVE"`, `sort_by: "ASSET"`, `sort_order: "DESC"`, `limit: 500`
- **Asset-based:** `filters: "ACTIVE:1 AND ASSET:[<min> TO <max>]"`, same fields and sort
- **CERT list:** `filters: "CERT:(<cert1> OR <cert2> OR ...)"`, same fields

Record the total count and the list of CERTs. This is the **screening universe**.

If the tool returns zero results or errors, **hard-stop** and report the failure to the user.

### Step 2: Derive date parameters

If the user did not provide `repdte`, omit it from downstream calls (tools default to the most recent published quarter). If the user did not provide `start_repdte`, omit it (snapshot comparison defaults to one year prior).

Record the effective `repdte` and `start_repdte` from the first tool response that returns them. These are the **date basis** for the report and must be stated in the output header.

---

## Phase 2 — Risk Screening and Ranking

Run the following three calls. They may be executed in parallel since they are independent.

### Step 3: Detect risk signals

Call `fdic_detect_risk_signals` with the universe parameters.

- **State-based:** `state: "<XX>"`
- **Asset-based:** `asset_min`, `asset_max`
- **CERT list:** `certs: [<cert1>, <cert2>, ...]`

Set `limit` to at least the universe size (up to 100) so all flagged institutions are captured. Set `min_severity: "warning"`.

Record for each flagged institution: CERT, name, critical count, warning count, signal codes, and the proxy summary band.

### Step 4: Compare peer health

Call `fdic_compare_peer_health` with matching parameters.

- **State-based:** `state: "<XX>"`
- **Asset-based:** `asset_min`, `asset_max`
- **CERT list:** `certs: [<cert1>, <cert2>, ...]`

Set `limit` to at least the universe size (up to 100). Default `sort_by: "composite"`.

Record for each institution: CERT, name, proxy score, proxy band, composite rating, component ratings (C/A/E/L/S), and flags.

### Step 5: Compare snapshots for trend confirmation

Call `fdic_compare_bank_snapshots` with matching parameters.

- **State-based:** `state: "<state name>"` (full name, not abbreviation)
- **Asset-based:** The snapshot tool does not accept `asset_min` / `asset_max` directly. Use the CERT list collected from Step 1 instead: `certs: [<cert1>, <cert2>, ...]`. If the CERT list exceeds 100, truncate to the top 100 by asset size and note the truncation in the report.
- **CERT list:** `certs: [<cert1>, <cert2>, ...]`
- Provide `start_repdte` and `end_repdte` if the user specified them.

Use `sort_by` matching the user's ranking emphasis:
- `overall` or unspecified → `asset_growth_pct` (DESC)
- `capital` → `roe_change` (ASC, to surface capital erosion)
- `earnings` → `roa_change` (ASC)
- `funding` → `deposits_to_assets_change` (ASC)
- `growth` → `asset_growth_pct` (DESC)

Set `limit` to at least the universe size (up to 100).

Record for each institution: asset growth %, deposit growth %, ROA change, ROE change, and insight tags.

---

## Phase 3 — Triage and Categorization

### Step 6: Merge and classify

Merge the results from Steps 3–5 by CERT. Classify each institution into one of three tiers:

**Escalate** — Any institution meeting one or more of:
- Any critical-severity risk signal (capital undercapitalized, earnings loss, reserve coverage low)
- Proxy band of `high_risk` or `weak`
- Composite rating of 3 or worse
- Three or more warning-severity signals
- Persistent adverse trend: ROA declining AND asset growth negative or flat

**Monitor** — Any institution meeting one or more of:
- One or two warning-severity signals without critical signals
- Component rating of 3 or worse in any single CAMELS component
- Rapid asset growth (>15% over the comparison period) combined with any warning signal
- Proxy band of `satisfactory` with any component rated 3+

**No Immediate Concern** — Institutions with:
- No critical or warning signals
- Proxy band of `strong`
- All component ratings 1 or 2
- No adverse trend indicators

### Step 7: Build the ranked watchlist

Within each tier, rank institutions by severity:
1. **Escalate:** Sort by critical signal count descending, then warning count descending, then proxy score ascending (lower proxy score = weaker institution; the proxy model maps 4.0 = strong, 1.0 = high risk).
2. **Monitor:** Sort by warning count descending, then worst component rating descending (higher component rating = worse; CAMELS components use 1 = Strong through 5 = Unsatisfactory).
3. **No Immediate Concern:** Sort by proxy score descending (higher proxy score = stronger institution).

Apply the user's `limit` to bound the total output. If the limit is smaller than the Escalate + Monitor population, prioritize Escalate institutions first.

For each institution in the Escalate and Monitor tiers, write a short **driver text** (1–2 sentences) summarizing the primary reason(s) for placement. Use explicit reason codes, not opaque scores:
- "Capital erosion: Tier 1 leverage at X%, classified as undercapitalized"
- "Earnings loss: ROA at -X% with efficiency ratio at Y%"
- "Funding stress: brokered deposits at X% of total deposits"
- "Credit deterioration: noncurrent loans at X%, trending adverse for N quarters"
- "Rapid growth with weakening profitability: asset growth of X% while ROA declined Y pp"
- "Repeated adverse trend signals: [list domains]"

---

## Phase 4 — Targeted Follow-Through (Escalated Institutions Only)

Limit follow-through calls to the **top 3 most material Escalate-tier institutions** by default, or fewer if the Escalate tier is smaller. The user may override this limit.

### Step 8: Detailed health assessment

For each targeted institution, call `fdic_analyze_bank_health` with `cert: <cert>` and `repdte: <repdte>` (using the effective report date established in Step 2). If the user did not specify a `repdte`, omit it to let the tool default — but all follow-through calls must use the same date basis as the screening workflow.

If the call fails, note "Detailed assessment data unavailable for [name] (CERT <cert>)" and preserve the institution's watchlist placement.

### Step 9: Domain-specific follow-up (conditional)

Call domain-specific tools **only when the institution's risk signals implicate that domain**. Pass `cert` and `repdte` (the same effective report date) to each call:

- **Funding signals present** (funding_stress, wholesale_funding_elevated, funding_ltd_stretched) → call `fdic_analyze_funding_profile` with `cert`, `repdte`
- **Credit signals present** (credit_deterioration, credit_deterioration_trending, reserve_coverage_low) → call `fdic_analyze_credit_concentration` with `cert`, `repdte`
- **Earnings signals present** (earnings_loss, earnings_pressure, margin_compression) → call `fdic_ubpr_analysis` with `cert`, `repdte`

If a domain tool fails, note "[domain] follow-up could not be completed for [name]" and preserve the triage result.

### Step 10: Regional context (optional)

Call `fdic_regional_context` once for the universe (using `state` or the first institution's CERT), passing `repdte` if established.

If unavailable, omit the Regional Context section or write: "Regional economic context unavailable; macro conditions were not factored into institution-level rankings."

---

## Phase 5 — Report Assembly

Produce the report in the following fixed section order:

### Section 1: Universe Definition

State the screening universe parameters, institution count, and effective date basis.

```
Universe: [state / asset range / CERT list description]
Institutions screened: [N]
Financial data as of: [REPDTE in YYYY-MM-DD format]
Comparison period: [start_repdte] to [end_repdte]
```

If the report mixes data from different date bases (e.g., quarterly financials and annual SOD data), state each basis explicitly.

### Section 2: Screening Summary

Provide a brief quantitative overview:
- Total institutions screened
- Institutions with critical signals
- Institutions with warning signals
- Institutions with no signals
- Distribution across Escalate / Monitor / No Immediate Concern tiers

### Section 3: Ranked Watchlist

Present the watchlist as a structured table or grouped list:

**Escalate**

| Rank | Institution | CERT | Assets ($K) | Proxy Band | Critical | Warning | Primary Drivers |
|---|---|---|---|---|---|---|---|
| 1 | Name | CERT | Amount | band | count | count | Driver text |

**Monitor**

Same structure.

**No Immediate Concern** (include only if the user requests full population coverage or the limit allows)

Same structure, abbreviated.

### Section 4: Escalated Institution Follow-Through

For each institution that received follow-through analysis in Phase 4, provide a concise summary:

- Health assessment highlights (composite rating, worst components, trend direction)
- Domain follow-up findings (if applicable)
- Recommended next step: "Full deep-dive analysis recommended" or "Continue monitoring with [specific focus]"

If follow-through was limited to a subset, state: "Follow-through analysis was performed for the top [N] escalated institutions. Remaining escalated institutions retain their watchlist classification pending further review."

### Section 5: Caveats / Date Basis

Always include:

1. **Date basis statement:** "Financial data sourced from FDIC Call Reports as of [REPDTE]. Snapshot comparison covers [start] to [end]."
2. **Proxy disclaimer:** "All health scores and component ratings are derived from the `public_camels_proxy_v1` analytical engine using public FDIC data. These are not official CAMELS ratings and do not reflect confidential supervisory information."
3. **Peer limitation (if applicable):** If the peer set was thin (<10 institutions) or partially mismatched, state: "Peer comparisons are limited due to [reason] — interpret relative rankings with caution."
4. **Data staleness (if applicable):** If the report date is more than 120 days old, note this explicitly.
5. **Regional context gap (if applicable):** Note if macro context was unavailable.

---

## Output Rules

- **Tone:** Supervisory-safe, neutral, decision-oriented. Describe public-data signals and triage implications. Do not imply official CAMELS ratings or confidential supervisory conclusions.
- **Reason codes over scores:** Every institution in Escalate or Monitor must have explicit driver text. Do not rely on opaque numeric scores alone.
- **Screening vs. deep-dive:** This workflow identifies where attention should go next. It is not a full narrative report on every institution. Keep per-institution text concise.
- **Bounded output:** Default to a concise format suitable for portfolio review. Do not produce full-population detail unless explicitly requested.
- **Three outcome states:** Distinguish "No data," "Not applicable," and "Tool failure" per the FDIC Skill Builder rules. Never collapse these into a generic "n/a."
- **Date basis transparency:** If quarterly financial data and annual branch/geographic context are both referenced, state the date basis clearly for each and do not present them as if they are from the same reporting period.

---

## Error Handling Summary

| Condition | Action |
|---|---|
| Hard-dependency tool fails | Hard-stop. Report the error. Do not produce partial output. |
| Soft-dependency tool fails | Omit the section. Note the omission explicitly in the report. |
| Context-dependency tool fails | Silently omit or note briefly. Preserve all triage results. |
| Universe returns zero institutions | Report "No institutions matched the screening criteria" and stop. |
| Peer set < 10 institutions | Produce the report but add a caveat that peer comparisons are limited. |
| Report date > 120 days stale | Add a staleness warning in Caveats. |
| Mixed date bases | State each date basis explicitly in Universe Definition and Caveats. |
