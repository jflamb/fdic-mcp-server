<!-- ⚠️ GENERATED FILE — DO NOT EDIT MANUALLY
     Source: extensions/workflows/fdic-failure-forensics/
     Generator: scripts/extensions/build-adapters.mjs
     Edit the canonical extension definition and re-run: npm run extensions:build -->

# FDIC Failure Forensics

> **Kind:** Workflow (Gemini Agent Guide)

Retrospective failure-forensics workflow for a single FDIC-insured institution. Reconstructs the pre-failure financial timeline from public FDIC data, identifies the earliest visible warning signals, and explains likely drivers of deterioration.

# FDIC Failure Forensics Workflow

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not produce any report output before completing Phase 3.

## Composition

This workflow uses:
- **Persona:** `fdic-skill-builder` — enforces FDIC data rules, dependency-tier modeling, and three-outcome-state discipline
- **Tools:** `fdic-core-mcp` + `fdic-analysis-mcp` — full FDIC data retrieval and analysis surface

## When to Activate

- Analyze or reconstruct a bank failure
- Review what public data showed before a specific institution failed
- Perform a post-mortem or forensic review of a failed bank
- Identify early warning signals that preceded a failure

Do **not** activate for active institution deep dives or multi-institution screening.

## Phase 1 — Institution Resolution and Failure Confirmation

### Step 1: Resolve to CERT

**Path A — CERT provided:** `fdic_search_institutions` with `filters: "CERT:<cert>"`.
**Path B — Name provided:** Search with `filters: "NAME:\"<name>\""`, limit 10, include inactive. If multiple candidates, present disambiguation list and wait.
**Zero results:** Stop and ask the user to refine or provide a CERT.

### Step 2: Confirm failure

Call `fdic_get_institution_failure` with confirmed cert.
If no failure record: **hard-stop.** Suggest using a deep-dive workflow instead.
Extract: FAILDATE, RESTYPE, COST, QBFASSET, QBFDEP, BIDNAME, CHCLASS.

### Step 3: Derive date parameters

- `last_repdte`: last quarter-end on or before FAILDATE
- `lookback_start`: quarter-end N quarters before last_repdte (default N=8)

**Hard Boundary:** Do NOT proceed without confirmed CERT with failure record and validated dates.

## Phase 2 — Data Collection

### Step 4: Financial timeline (Hard)
`fdic_search_financials` — cert, fields: CERT,REPDTE,ASSET,DEP,NETINC,ROA,ROE,NETNIM,EQ,LNLSNET, sort_by: REPDTE DESC, limit: lookback+2. Zero records = **hard-stop**.

### Step 5: Risk signals (Hard)
`fdic_detect_risk_signals` — certs: [cert], repdte: last_repdte, quarters: lookback, min_severity: warning. Zero signals = analytically significant finding.

### Step 6: Health assessment (Soft)
`fdic_analyze_bank_health` — cert, repdte, quarters. Failure → note and continue.

### Step 7: Structural history (Soft)
`fdic_search_history` — cert, limit 20, sort PROCDATE DESC. Failure → note and continue.

### Step 8: Domain follow-up (Conditional)
- Funding stress OR deposits down >15% → `fdic_analyze_funding_profile`
- Credit signals OR net loans up >20% with declining earnings → `fdic_analyze_credit_concentration`

### Step 9: Regional context (Soft)
`fdic_regional_context` — cert, repdte. Failure → omit section.

## Phase 3 — Report Assembly

Fixed 8-section order. Core sections (1-5, 8) always present. Sections 6-7 only if data collected.

1. **Institution Identification** — name, CERT, location, assets/deposits at failure
2. **Failure Event Summary** — FAILDATE, RESTYPE, acquirer, DIF cost, date range
3. **Pre-Failure Financial Timeline** — quarterly table + trend narrative, inflection point
4. **Earliest Warning Signals** — signals by severity, proxy summary if available; absence = key finding
5. **Likely Failure Drivers** — every statement tagged [Observed], [Inferred], or [Unknown from public data]
6. **Domain Analysis** (conditional) — funding and/or credit concentration
7. **Regional Context** (if available)
8. **Caveats and Limitations** — data source, temporal gap, proxy disclaimer, retrospective framing

## Output Rules

- Neutral, forensic, supervisory-safe tone
- Every Section 5 statement must be tagged
- Exact dates always
- Three outcome states: No data / Not applicable / Tool failure
- "the data showed" not "the bank should have"
- No supervisory impersonation

## FDIC Data Context

# FDIC Date Basis Rules

FDIC data uses different date conventions depending on the dataset. Extensions must respect these differences and state the date basis explicitly when mixing sources.

| Data Source | Date Field | Format | Cadence | Derivation |
|---|---|---|---|---|
| Financials / UBPR | `REPDTE` | `YYYYMMDD` | Quarterly (0331, 0630, 0930, 1231) | Pass `repdte` param or omit for latest |
| SOD (branch/deposit) | `YEAR` | `YYYY` | Annual (as of June 30) | Most recent year where June 30 <= analysis date |
| Institution profile | n/a | n/a | Current only | `fdic_get_institution` is not date-scoped |
| Demographics | `REPDTE` | `YYYYMMDD` | Quarterly | Same as financials |
| Failures | `FAILDATE` | `YYYY-MM-DD` | Event-based | Not periodic |

## Rules

1. **Inactive institution `repdte` derivation:** The institution record contains a `REPDTE` field in `MM/DD/YYYY` format. Convert to `YYYYMMDD` before passing to financial tools. Do not use today's date.

2. **Absolute date statements:** Output that mixes data from different date bases must state the basis date for each section. Never write "as of the latest period" without specifying which period.

3. **Quarter-end alignment:** Valid quarter-end dates are March 31, June 30, September 30, and December 31. Any `repdte` value must align to one of these dates.

4. **Staleness warning:** If the effective report date is more than 120 days before the analysis date, the output must include an explicit staleness caveat.

---

# FDIC Units Convention

FDIC financial amounts are reported in **thousands of dollars** ($K) unless explicitly noted otherwise.

## Rules

1. **Default unit:** All monetary fields from FDIC APIs (ASSET, DEP, NETINC, EQ, LNLSNET, COST, QBFASSET, etc.) are in thousands of dollars.

2. **Percentage fields:** ROA, ROE, and NETNIM (Net Interest Margin) are reported as percentages.

3. **Presentation:** When presenting dollar amounts, preserve the $K convention. If converting to full dollars or millions for readability, state the conversion explicitly.

4. **Do not assume conversions.** If a field's unit is unclear, state the raw value and note the ambiguity rather than guessing the unit.

---

# FDIC CERT Identity Rules

The `CERT` field is the stable institution identifier across all FDIC datasets.

## Resolution Rules

1. **Ambiguous name resolution is unresolved until CERT is confirmed.** If a search returns multiple candidates, the institution is not yet identified. Do not pass names downstream — wait until the user has confirmed a specific CERT.

2. **CERT-first lookups:** When a CERT is provided directly, use `fdic_search_institutions` with `filters: "CERT:<cert>"` to confirm identity.

3. **Name-based lookups:** Search with `filters: "NAME:\"<name>\""`. If multiple candidates, present a disambiguation list and wait for user confirmation.

4. **Inactive institution handling:** Always check the `ACTIVE` field. If `ACTIVE: 0`:
   - Warn the user explicitly before proceeding.
   - Derive the historical `repdte` from the institution's `REPDTE` field.
   - SOD data may be absent for the last year — degrade gracefully.
   - Do not treat absence of recent financial data as an error.

5. **Zero results:** Stop and ask the user to refine their search or provide a CERT number.

---

# Repo Tool Contracts

Extensions must respect the MCP tool contracts exposed by this repository.

## General Rules

1. **Skills orchestrate; servers compute.** Extensions must not re-implement logic that belongs in a tool. If a derived value is needed, call the tool that computes it.

2. **Do not describe tool behavior you cannot observe.** If you need a tool to return a new field, the server tool must be updated first.

3. **Field names are case-sensitive.** Use exact field names from `src/fdicEndpointMetadata.ts`.

4. **Output path fidelity:** Extensions referencing `structuredContent` paths must use verified paths from actual tool responses, not guesses.

## Dependency Tiers

Every tool in an extension's workflow must have an assigned tier:

| Tier | Definition | On Failure |
|---|---|---|
| **Hard** | Output cannot be produced without this data | Stop and report the error |
| **Soft** | Output degrades but remains useful | Omit the section; note the omission |
| **Context** | Enriches output; not load-bearing | Silently omit if unavailable |


## Operating Policies

# Temporal Accuracy Policy

Extensions must produce temporally accurate output. Time-related ambiguity erodes trust.

## Rules

1. **Use exact dates.** Never write "recently" or "as of the latest period" without specifying the exact date.

2. **State date basis per section.** If output mixes quarterly financial data and annual SOD data, each section header must state its date basis.

3. **Staleness caveat.** If the effective report date is more than 120 days before the analysis date, include an explicit staleness warning.

4. **Quarter derivation.** When computing quarter-end dates from calendar dates:
   - Jan 1 – Mar 31 → `YYYYMMDD` ending `0331`
   - Apr 1 – Jun 30 → `YYYYMMDD` ending `0630`
   - Jul 1 – Sep 30 → `YYYYMMDD` ending `0930`
   - Oct 1 – Dec 31 → `YYYYMMDD` ending `1231`

5. **Cross-date-basis transparency.** Convert relative dates ("same quarter one year prior") to absolute dates in output.

---

# Graceful Degradation Policy

Extensions must degrade gracefully when data or tools are unavailable.

## Three Outcome States

Distinguish these in output — they have different meanings and must never be collapsed:

| State | Meaning | Correct Representation |
|---|---|---|
| **No data** | The API returned zero records for this metric | "No data available for [metric]" |
| **Not applicable** | The metric structurally does not apply | "Not applicable — [reason]" |
| **Tool failure** | The tool returned an error or timed out | "Tool error — [tool name]" |

## Tier-Based Degradation

- **Hard dependency fails:** Stop. Report the error. Do not produce partial output.
- **Soft dependency fails:** Omit the section. Note the omission explicitly.
- **Context dependency fails:** Silently omit or note briefly. Preserve all analytical results.

## Rules

1. Never use "n/a" as a catch-all that merges all three outcome states.
2. Never render empty placeholder sections for omitted content — omit entirely.
3. When a soft dependency fails, the remaining output must still form a coherent narrative.

---

# Source Attribution Policy

Extensions must clearly attribute data sources and analytical methods.

## Rules

1. **Proxy disclaimer.** Any output that includes health scores, CAMELS-proxy ratings, or component ratings must include: "These are derived from the `public_camels_proxy_v1` analytical engine using public FDIC data. They are not official CAMELS ratings and do not reflect confidential supervisory information."

2. **Data source statement.** Every report must state its data source (e.g., "FDIC Call Report data," "FDIC Failure Records," "Summary of Deposits").

3. **No supervisory impersonation.** Do not imply official findings, privileged exam conclusions, or confidential determinations.

4. **Observed vs. Inferred labeling.** When making analytical statements:
   - **[Observed]** — Directly visible in the public data
   - **[Inferred]** — Analytical conclusion drawn from observed data
   - **[Unknown from public data]** — Cannot be determined from available data

5. **Hindsight discipline.** Write "the data showed" not "the bank should have." Retrospective analysis is reconstruction, not prediction.

6. **Report footer.** Include a standard footer attributing the data source and analytical model.

