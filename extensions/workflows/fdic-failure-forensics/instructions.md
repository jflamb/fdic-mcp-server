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
