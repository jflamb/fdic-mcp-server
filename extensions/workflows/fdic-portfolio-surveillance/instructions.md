# FDIC Portfolio Surveillance Workflow

## Skill Type: RIGID

Follow every phase in order. Do not produce output before completing Phase 3.

## Composition

This workflow uses:
- **Persona:** `fdic-skill-builder` — enforces FDIC data rules and three-outcome-state discipline
- **Tools:** `fdic-core-mcp` + `fdic-analysis-mcp` — full FDIC data and analysis surface

## When to Activate

- Screen, triage, or surveil a group of institutions
- Build a watchlist for a state, asset tier, or peer cohort
- Rank banks by risk, health, or deterioration across a portfolio

Do **not** activate for single-institution deep dives.

## Phase 1 — Universe Construction

### Step 1: Build the institution roster
`fdic_search_institutions` with universe parameters:
- State: `filters: "STALP:<XX> AND ACTIVE:1"`, fields: CERT,NAME,ASSET,DEP,STALP,BKCLASS,ACTIVE, sort: ASSET DESC, limit: 500
- Asset range: `filters: "ACTIVE:1 AND ASSET:[<min> TO <max>]"`
- CERT list: `filters: "CERT:(<cert1> OR <cert2> OR ...)"`

Zero results = **hard-stop**.

### Step 2: Derive date parameters
Record effective repdte and start_repdte from first tool response.

## Phase 2 — Risk Screening (parallel)

### Step 3: Risk signals — `fdic_detect_risk_signals`, min_severity: warning
### Step 4: Peer health — `fdic_compare_peer_health`, sort_by: composite
### Step 5: Snapshots — `fdic_compare_bank_snapshots` for trend confirmation

## Phase 3 — Triage

**Escalate:** critical signal OR proxy band high_risk/weak OR composite 3+ OR 3+ warnings OR persistent adverse trend.
**Monitor:** 1-2 warnings without critical OR component 3+ in any dimension OR rapid growth + warning.
**No Immediate Concern:** no signals, strong proxy, all components 1-2.

Rank within tiers by severity. Every Escalate/Monitor institution gets explicit driver text.

## Phase 4 — Follow-Through (top 3 Escalate)

- `fdic_analyze_bank_health` for each
- Domain follow-up based on signals (funding/credit/earnings)
- `fdic_regional_context` once for the universe

## Phase 5 — Report Assembly

1. **Universe Definition** — parameters, count, date basis
2. **Screening Summary** — quantitative overview
3. **Ranked Watchlist** — Escalate/Monitor/No Immediate Concern tables with driver text
4. **Escalated Institution Follow-Through** — highlights and next steps
5. **Caveats** — date basis, proxy disclaimer, peer limitations, staleness
