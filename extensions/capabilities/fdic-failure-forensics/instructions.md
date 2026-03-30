# FDIC Failure Forensics

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not produce any report output before completing Phase 3.

## When to Activate

Activate when the user asks to:
- Analyze or reconstruct a bank failure
- Review what public data showed before a specific institution failed
- Perform a post-mortem or forensic review of a failed bank
- Identify early warning signals that preceded a failure
- Study a failed institution for training, pattern recognition, or case-study purposes

Do **not** activate for:
- Active institution deep dives
- Multi-institution surveillance or screening

## Phase 1 — Institution Resolution and Failure Confirmation

### Step 1: Resolve to CERT

**Path A — CERT provided directly:**
1. Call `fdic_search_institutions` with `filters: "CERT:<cert>"` and `fields: "CERT,NAME,CITY,STALP,ASSET,DEP,BKCLASS,ACTIVE,REPDTE,ESTYMD"`.
2. Present the identity confirmation to the user.

**Path B — Bank name provided:**
1. Search with `filters: "NAME:\"<name>\""`, limit 10. Include inactive institutions.
2. If multiple candidates, present a disambiguation list.
3. Wait for user confirmation.

**Zero results:** Stop. Ask the user to refine their search or provide a CERT number.

### Step 2: Confirm failure

Call `fdic_get_institution_failure` with the confirmed `cert`.

If no failure record, **hard-stop:**
> "CERT [number] ([name]) does not have a failure record in FDIC data. This workflow is designed for failed institutions only."

Extract: FAILDATE, RESTYPE, COST, QBFASSET, QBFDEP, BIDNAME, CHCLASS.

### Step 3: Derive date parameters

**Pre-failure report date (`last_repdte`):** Derive the last quarter-end on or before the failure date.

**Lookback start date (`lookback_start`):** Compute the quarter-end N quarters before `last_repdte`.

### Hard Boundary

Do NOT proceed to Phase 2 without:
- A confirmed CERT with a confirmed failure record
- A validated `last_repdte` and `lookback_start`

## Phase 2 — Data Collection

### Step 4: Build the pre-failure financial timeline

Call `fdic_search_financials` with cert, fields: "CERT,REPDTE,ASSET,DEP,NETINC,ROA,ROE,NETNIM,EQ,LNLSNET", sort_by: "REPDTE", sort_order: "DESC", limit: lookback_quarters + 2.

Filter results to quarters between `lookback_start` and `last_repdte` inclusive.

If zero records, **hard-stop.**

### Step 5: Detect risk signals

Call `fdic_detect_risk_signals` with certs: [cert], repdte: last_repdte, quarters: lookback_quarters, min_severity: "warning".

Zero signals is analytically significant — record it as a finding.

### Step 6: Detailed health assessment (soft)

Call `fdic_analyze_bank_health` with cert, repdte: last_repdte, quarters: lookback_quarters.

If fails, note "Detailed health assessment unavailable" and continue.

### Step 7: Structural event history (soft)

Call `fdic_search_history` with cert, limit: 20, sort_by: "PROCDATE", sort_order: "DESC".

If fails, note "Structural event history unavailable."

### Step 8: Domain-specific follow-up (conditional)

- **Funding stress** → call `fdic_analyze_funding_profile`
- **Credit signals** → call `fdic_analyze_credit_concentration`

Only invoke when signals implicate the domain.

### Step 9: Regional context (soft)

Call `fdic_regional_context` with cert, repdte: last_repdte.

## Phase 3 — Analysis and Report Assembly

Produce the report in fixed section order. Core sections (1-5, 8) always present. Enrichment sections (6, 7) included only when data was collected.

### Report Header
Title, generation date, standard disclaimer about public data limitations.

### Section 1: Institution Identification
Name, CERT, location, charter, establishment date, assets/deposits at failure.

### Section 2: Failure Event Summary
Failure date, resolution type, acquirer, DIF cost, assets at failure, last reported quarter, lookback window.

### Section 3: Pre-Failure Financial Timeline
Quarter-by-quarter table (Assets, Deposits, Net Income, ROA, ROE, NIM, Equity, Loans). Trend narrative identifying inflection points.

### Section 4: Earliest Warning Signals
Risk signals grouped by severity. Health assessment proxy summary if available. Absence of signals is a key forensic finding.

### Section 5: Likely Failure Drivers
Primary drivers, contributing factors, and data gaps. Every statement tagged as [Observed], [Inferred], or [Unknown from public data].

### Section 6: Domain Analysis (conditional)
Funding profile and/or credit concentration summaries when invoked.

### Section 7: Regional Context (if available)
State/national unemployment, federal funds rate, macro relationship to failure.

### Section 8: Caveats and Limitations
Data source, temporal gap, proxy disclaimer, retrospective framing, staleness, domain gaps.

### Report Footer
Standard attribution footer.

## Output Rules

- **Tone:** Neutral, forensic, supervisory-safe.
- **Observed vs. Inferred:** Every analytical statement in Section 5 must be tagged.
- **Exact dates:** Always use exact dates.
- **Three outcome states:** Distinguish "No data," "Not applicable," and "Tool failure."
- **Hindsight discipline:** Write "the data showed" not "the bank should have."
- **No supervisory impersonation.**
