# FDIC Portfolio Surveillance

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not produce output before completing Phase 3.

## When to Activate

Activate when the user asks to:
- Screen, triage, or surveil a group of institutions
- Build a watchlist for a state, asset tier, or peer cohort
- Rank banks by risk, health, or deterioration across a portfolio
- Identify which institutions in a universe warrant immediate attention

Do **not** activate for single-institution deep dives.

## Phase 1 — Universe Construction

### Step 1: Build the institution roster

Call `fdic_search_institutions` with the user's universe definition:
- **State-based:** `filters: "STALP:<XX> AND ACTIVE:1"`, fields: "CERT,NAME,ASSET,DEP,STALP,BKCLASS,ACTIVE", sort_by: "ASSET", sort_order: "DESC", limit: 500
- **Asset-based:** `filters: "ACTIVE:1 AND ASSET:[<min> TO <max>]"`
- **CERT list:** `filters: "CERT:(<cert1> OR <cert2> OR ...)"`

If zero results, **hard-stop.**

### Step 2: Derive date parameters

If repdte not provided, omit from downstream calls. Record the effective dates from the first tool response.

## Phase 2 — Risk Screening and Ranking

Run Steps 3-5 in parallel.

### Step 3: Detect risk signals
Call `fdic_detect_risk_signals` with universe parameters. Set min_severity: "warning".

### Step 4: Compare peer health
Call `fdic_compare_peer_health` with matching parameters. Sort by composite.

### Step 5: Compare snapshots for trend confirmation
Call `fdic_compare_bank_snapshots` with matching parameters.

## Phase 3 — Triage and Categorization

### Step 6: Merge and classify

**Escalate** — Any of: critical signal, proxy band high_risk/weak, composite 3+, 3+ warnings, persistent adverse trend.

**Monitor** — Any of: 1-2 warnings without critical, component rated 3+ in any dimension, rapid growth with warning.

**No Immediate Concern** — No signals, strong proxy band, all components 1-2.

### Step 7: Build the ranked watchlist

Within each tier, rank by severity. Each Escalate/Monitor institution gets explicit driver text.

## Phase 4 — Targeted Follow-Through (Escalated Only)

Top 3 escalated institutions get detailed analysis:
- `fdic_analyze_bank_health` for each
- Domain-specific follow-up based on signal type (funding/credit/earnings)
- Optional `fdic_regional_context`

## Phase 5 — Report Assembly

### Section 1: Universe Definition
Screening parameters, institution count, date basis.

### Section 2: Screening Summary
Quantitative overview: totals, signal distribution, tier distribution.

### Section 3: Ranked Watchlist
Structured table grouped by Escalate/Monitor/No Immediate Concern.

### Section 4: Escalated Institution Follow-Through
Health assessment highlights, domain findings, recommended next steps.

### Section 5: Caveats / Date Basis
Date basis, proxy disclaimer, peer limitations, staleness, regional context gaps.

## Output Rules

- Supervisory-safe, neutral, decision-oriented tone.
- Explicit driver text for every Escalate/Monitor institution.
- Screening identifies where attention should go — not a full narrative per institution.
- Three outcome states: No data / Not applicable / Tool failure.
- Date basis transparency for mixed sources.
