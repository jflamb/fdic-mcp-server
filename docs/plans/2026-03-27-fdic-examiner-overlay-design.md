# FDIC Examiner Overlay Skill — Design Specification

> **Version:** 1.0 (March 2026)
> **Status:** Approved for implementation
> **Phase:** 1 of 2 (Claude Code skill; MCP tool promotion planned after field-set stabilization)

## Overview

A Claude Code skill that layers qualitative analyst knowledge onto a `public_camels_proxy_v1` baseline. Produces a blended assessment with explicit provenance separating public-data findings from examiner overlay inputs.

The skill discovers the right input shape through guided analyst interaction. Once the field set and scoring rules stabilize, the proven schema promotes into an MCP tool (Phase 2).

## Skill Identity

- **Name:** `fdic-examiner-overlay`
- **Type:** Rigid (workflow steps, caveats, and audit trail are non-negotiable)
- **Trigger:** User asks to overlay examiner knowledge onto bank analysis, enrich a proxy assessment with qualitative inputs, produce an examination-style blended assessment, or explicitly invokes `/fdic-examiner-overlay`
- **Not triggered by:** General bank health questions, peer comparisons, risk screening, or any workflow without analyst-provided qualitative inputs

## Workflow

### Step 1: Fetch Baseline

- Ask for CERT (and optional repdte)
- Call `fdic_analyze_bank_health`
- Use `structuredContent.proxy` as the quantitative baseline, plus top-level institution/context fields from the full tool result (identity, report date, data staleness, legacy composite, text caveats)

### Step 2: Present Baseline Summary

Show:
- Institution name, CERT, city, state
- Report date, data staleness
- Overall band and score
- Each component score and label
- Management overlay level
- Capital classification (PCA category)
- Risk signals (count by severity)
- Data quality flags

Frame as: "This is the public-data baseline. Where do you have examiner knowledge to add?"

### Step 3: Domain Selection

Ask: "Which domains do you want to overlay?"

v1 options:
- `management`
- `asset_quality`
- `earnings`
- `liquidity_funding`
- `sensitivity`

Capital is excluded in v1. It is already the most rules-based part of the proxy, and qualitative capital overlay risks slipping into confidential supervisory territory.

Multiple selection allowed. Unselected domains pass through unchanged and are recorded as such in the audit trail.

### Step 4: Structured Input Collection

For each selected domain, ask domain-specific questions (see Domain-Specific Inputs below).

Each input requires:
- **assessment:** the analyst's qualitative finding
- **direction:** `upgrade` | `downgrade` | `confirm`
- **confidence:** `low` | `medium` | `high`
- **evidence:** short basis statement (required, never optional)
- **source_date:** optional — when the information was current

`confirm` means the analyst reviewed the domain, agrees with the proxy, and produces no score change. Still requires evidence. This is the "no overlay" escape hatch within a selected domain.

For `upgrade` direction: evidence must be tied to concrete factors, not a general positive sentiment. The skill should prompt for specific evidence if the initial statement is vague.

Normalize all inputs into an internal worksheet.

### Step 5: Compute Overlay Adjustments

Apply bounded adjustment rules (see Adjustment Rules below).

### Step 6: Analyst Confirmation Gate

Show a compact summary: each domain's baseline score → proposed adjusted score, with direction, evidence, and any severe overrides that fired.

Ask: "Confirm these adjustments, or revise any domain?"
- If revise: return to Step 4 for that domain
- If confirm: proceed to output

Record the confirmation in the structured appendix.

### Step 7: Produce Blended Output

Six human-readable sections plus a structured appendix. See Output Format below.

**Hard caveat rule (non-negotiable):** The narrative must always visually and textually distinguish:
- "Public data indicate..." (proxy baseline findings)
- "Examiner overlay:" (analyst-provided inputs)
- "Blended interpretation:" (combined assessment)

These three layers must never be merged into undifferentiated prose. Each paragraph or finding must be attributed to its source layer.

## Domain-Specific Inputs

### Management

The proxy has no direct management score — only an algorithmic overlay. This is the domain with the largest gap between public data and examination knowledge.

| Field | Prompt | Responses |
|-------|--------|-----------|
| `mgmt_tenure_stability` | "How would you characterize senior management tenure and stability?" | `stable` / `recent_turnover` / `significant_disruption` |
| `board_governance` | "Any board or governance concerns? (independence, expertise, engagement, conflicts)" | `no_concerns` / `minor_concerns` / `material_concerns` |
| `internal_controls` | "Internal audit and control environment findings?" | `satisfactory` / `needs_improvement` / `deficient` |
| `risk_management` | "How effective is the institution's risk management framework?" | `effective` / `adequate` / `inadequate` |
| `succession_planning` | "Is there a credible succession plan for key positions?" | `documented` / `informal` / `absent` |
| `supervisory_issues_history` | "Any recent enforcement actions, MRAs, or exam-history flags?" | `clean` / `open_mras` / `enforcement_action` |

### Asset Quality

The proxy scores NCL ratio, net charge-offs, reserve coverage, and noncurrent assets. The examiner adds what aggregate ratios cannot show.

| Field | Prompt | Responses |
|-------|--------|-----------|
| `concentration_risk` | "Any material loan concentration concerns? (CRE, single-borrower, sector)" | `no_concerns` / `moderate` / `elevated` |
| `underwriting_quality` | "How would you assess recent underwriting standards?" | `sound` / `loosening` / `weak` |
| `classified_asset_trend` | "Direction of classified/criticized assets since last exam?" | `improving` / `stable` / `deteriorating` |
| `allowance_adequacy` | "Is the allowance (ALLL/ACL) adequate relative to identified risk?" | `adequate` / `marginally_adequate` / `inadequate` |

Note: `classified_asset_trend` reflects confidential supervisory information. The skill must flag this in the caveats section.

### Earnings

The proxy scores ROA, ROE, NIM, efficiency ratio. The examiner adds sustainability and quality context.

| Field | Prompt | Responses |
|-------|--------|-----------|
| `earnings_sustainability` | "Are current earnings levels sustainable, or driven by one-time items / nonrecurring support?" | `sustainable` / `partially_nonrecurring` / `largely_nonrecurring` |
| `revenue_diversification` | "How concentrated is the revenue base?" | `diversified` / `moderately_concentrated` / `highly_concentrated` |
| `expense_management` | "Is management actively controlling operating expenses?" | `well_managed` / `adequate` / `poorly_managed` |

### Liquidity / Funding

The proxy scores L/D ratio, core deposits, brokered deposits, cash ratio, borrowed funds. The examiner adds depth.

| Field | Prompt | Responses |
|-------|--------|-----------|
| `contingency_funding` | "Is there a tested contingency funding plan?" | `tested` / `documented_untested` / `absent` |
| `contingent_borrowing_capacity` | "Available borrowing capacity (FHLB, Fed discount window, unencumbered collateral, tested line availability)?" | `ample` / `adequate` / `constrained` |
| `depositor_concentration` | "Top-10 depositor concentration concern?" | `no_concern` / `moderate` / `elevated` |
| `funding_stability` | "Overall assessment of funding stability beyond what ratios show?" | `stable` / `adequate` / `vulnerable` |

### Sensitivity

The proxy has `rate_risk_proxy_elevated` and NIM trends. The examiner adds model-based context.

| Field | Prompt | Responses |
|-------|--------|-----------|
| `irr_model_results` | "EVE/NII shock results — within policy limits?" | `within_limits` / `approaching_limits` / `exceeding_limits` |
| `hedging_effectiveness` | "Any material hedging or derivatives positions? Effective?" | `not_applicable` / `effective` / `ineffective` |
| `rate_environment_exposure` | "Directional exposure to the current rate environment?" | `well_positioned` / `neutral` / `adversely_exposed` |

## Adjustment Rules

### Per-field magnitude mapping

Each field response maps to an **evidence magnitude** — the strength of basis for adjustment in the analyst's chosen direction. Direction is separate from magnitude.

**Three tiers (per-field, not global):**

| Magnitude | Meaning | Example |
|-----------|---------|---------|
| 0.00 | No adjustment basis | `stable`, `no_concerns`, `satisfactory`, `effective` |
| 0.25 | Moderate basis | `recent_turnover`, `minor_concerns`, `needs_improvement`, `adequate` |
| 0.50 | Strong basis | `significant_disruption`, `material_concerns`, `deficient`, `inadequate` |

Each domain defines its own per-field mapping. The same word (e.g., "adequate") can map to different magnitudes in different fields.

### Severe overrides

Certain field responses produce a **minimum adjustment floor** for the domain. The domain adjustment is at least the floor, even if the mean of other fields would produce a smaller number.

Severe overrides apply only to downgrade direction.

| Field | Response | Floor |
|-------|----------|-------|
| `supervisory_issues_history` | `enforcement_action` | 0.50 |
| `internal_controls` | `deficient` | 0.50 |
| `contingency_funding` | `absent` | 0.50 |
| `irr_model_results` | `exceeding_limits` | 0.50 |
| `allowance_adequacy` | `inadequate` | 0.50 |

Not severe overrides (by design): `open_mras`, `material_concerns`, `adequate` (in any context). These are too ambiguous for a floor.

**v1.1 candidates** (add only if analyst sessions demonstrate the need):
- `classified_asset_trend`: add `severe_deterioration` enum + severe override
- `risk_management`: add `materially_deficient` enum + severe override

### Non-management domain adjustment

```
field_magnitudes = [per-field magnitude values]

direction_multiplier:
    upgrade:   +1
    downgrade: -1
    confirm:    0

raw_adjustment = mean(field_magnitudes) * direction_multiplier

# Severe override floor (downgrade only)
if direction == "downgrade" and any severe override fires:
    raw_adjustment = min(raw_adjustment, -severe_floor)

confidence_cap:
    low:    0.50
    medium: 0.75
    high:   1.00

domain_adjustment = clamp(raw_adjustment, -confidence_cap, +confidence_cap)

adjusted_component_score = clamp(
    baseline_component_score + domain_adjustment,
    1.0,
    4.0
)
```

### Management domain — separate overlay path

Management does not produce a component score adjustment. It modifies the management overlay state.

**confirm:** No change to overlay. Worksheet recorded for audit trail.

**downgrade:**
- Raw magnitude computed same as other domains: `mean(field_magnitudes)`
- If raw magnitude ≥ 0.25: elevate overlay by one level (`normal` → `watch`, `watch` → `elevated_concern`)
- Two-level escalation (`normal` → `elevated_concern`) only if: confidence is `high` AND at least one management severe override is present (`enforcement_action` or `deficient` internal controls)
- `elevated_concern` caps the final band down by one level (same as existing proxy behavior)
- If the proxy already produced `elevated_concern`, a management downgrade reinforces it (no double-cap, but flagged in the narrative)

**upgrade:**
- May remove a proxy-generated `caps_band` flag if:
  - The proxy overlay was `watch` or `elevated_concern`
  - AND the analyst provides `high` confidence
  - AND evidence is tied to concrete factors (not vague positive sentiment)
  - AND no severe override fields are triggered
- Cannot boost the institution above the quantitative baseline — only restores what the algorithmic overlay penalized
- If the proxy overlay was `normal`, upgrade has no effect

### Overall score recomputation

```
adjusted_overall = sum(adjusted_component_score[d] * weight[d])
    C = 0.30 (unchanged baseline, excluded from v1 overlay)
    A = 0.25 (adjusted if overlaid)
    E = 0.20 (adjusted if overlaid)
    L = 0.15 (adjusted if overlaid)
    S = 0.10 (adjusted if overlaid)

adjusted_band = map_score_to_band(adjusted_overall)
    >= 3.25 = strong
    >= 2.50 = satisfactory
    >= 1.75 = weak
    else    = high_risk

# Management overlay cap
if management_overlay_level == "elevated_concern":
    adjusted_band = demote_one_level(adjusted_band)
```

## Output Format

### Sections 1–6: Human-Readable

```
## 1. Public Proxy Baseline

Institution: [name] (CERT [cert]), [city], [state]
Report Date: [repdte] | Data Staleness: [staleness]

Overall: [band] ([score]/4.0)
  Capital:           [score] - [label]  (PCA: [category])
  Asset Quality:     [score] - [label]
  Earnings:          [score] - [label]
  Liquidity/Funding: [score] - [label]
  Sensitivity Proxy: [score] - [label]

Management Overlay: [level]
Risk Signals: [count] ([critical] critical, [warning] warning)

Source: public_camels_proxy_v1 — public off-site proxy,
        not official CAMELS


## 2. Examiner Overlay Inputs

Domains overlaid: [list]
Domains unchanged: [list]

### [Domain Name]
Direction: [upgrade|downgrade|confirm]
Confidence: [low|medium|high]
Evidence: [basis statement]
Source date: [date or "not specified"]

  [field_name]: [response] (magnitude: [value])
  [field_name]: [response] (magnitude: [value])
  ...

(repeated per overlaid domain)


## 3. Overlay Adjustments

| Domain | Baseline | Raw Adj | Severe Floor | Conf Cap | Final Adj | Adjusted |
|--------|----------|---------|--------------|----------|-----------|----------|
| ...    | ...      | ...     | ...          | ...      | ...       | ...      |

Management overlay: [baseline_level] → [adjusted_level]
Conflicts: [any flagged, or "none"]


## 4. Blended Assessment

Overall: [adjusted_band] ([adjusted_score]/4.0)
  Capital:           [unchanged] - [label]
  Asset Quality:     [adjusted]  - [label]  [← examiner overlay]
  Earnings:          [adjusted]  - [label]  [← examiner overlay]
  Liquidity/Funding: [adjusted]  - [label]
  Sensitivity Proxy: [adjusted]  - [label]

Management Overlay: [adjusted_level]
Change from baseline: [band unchanged | band moved from X to Y]


## 5. Caveats

- This assessment combines public FDIC data with examiner-provided
  qualitative inputs. It is not an official CAMELS rating.
- Public data indicate [proxy-derived findings]. Examiner overlay
  provides [analyst-provided context]. The blended interpretation
  reflects both sources and should not be cited as either alone.
- [Domain-specific caveats, e.g., "classified_asset_trend input
  reflects confidential supervisory information"]
- Data quality: [any gaps or staleness flags from proxy baseline]


## 6. Exam Narrative

[Structured paragraphs, each attributed to source layer]

**Public data indicate** [institution name] reported [key metrics
and proxy findings]...

**Examiner overlay:** Based on [evidence], [analyst finding about
domain]...

**Blended interpretation:** Considering both public financial data
and examiner assessment, [combined finding]...

(repeated per overlaid domain, then a concluding overall paragraph)
```

### Section 7: Structured Worksheet (machine-readable appendix)

```json
{
  "cert": 12345,
  "repdte": "20241231",
  "model": "fdic_examiner_overlay_v1",
  "official_status": "blended public-data proxy with examiner overlay, not official CAMELS",
  "analyst_confirmed": true,
  "proxy_baseline": {
    "overall_score": 3.45,
    "overall_band": "strong",
    "components": {
      "capital": { "score": 4.0, "label": "Strong" },
      "asset_quality": { "score": 3.0, "label": "Satisfactory" },
      "earnings": { "score": 3.25, "label": "Strong" },
      "liquidity_funding": { "score": 2.75, "label": "Satisfactory" },
      "sensitivity_proxy": { "score": 2.5, "label": "Satisfactory" }
    },
    "management_overlay": { "level": "normal", "caps_band": false }
  },
  "overlaid_domains": ["management", "asset_quality"],
  "unselected_domains": ["earnings", "liquidity_funding", "sensitivity"],
  "excluded_domains": ["capital"],
  "overlay_inputs": [
    {
      "domain": "management",
      "direction": "downgrade",
      "confidence": "high",
      "evidence": "CEO departed Q3, no succession plan, two open MRAs",
      "source_date": "2024-11-15",
      "fields": {
        "mgmt_tenure_stability": {
          "response": "significant_disruption",
          "magnitude": 0.50,
          "severe_override": false
        },
        "board_governance": {
          "response": "minor_concerns",
          "magnitude": 0.25,
          "severe_override": false
        },
        "internal_controls": {
          "response": "needs_improvement",
          "magnitude": 0.25,
          "severe_override": false
        },
        "risk_management": {
          "response": "adequate",
          "magnitude": 0.25,
          "severe_override": false
        },
        "succession_planning": {
          "response": "absent",
          "magnitude": 0.50,
          "severe_override": false
        },
        "supervisory_issues_history": {
          "response": "open_mras",
          "magnitude": 0.25,
          "severe_override": false
        }
      },
      "raw_magnitude": 0.333,
      "severe_overrides_triggered": [],
      "effect": "overlay elevated from normal to watch"
    }
  ],
  "adjustments": {
    "component_scores": {
      "capital": { "baseline": 4.0, "adjustment": 0.0, "adjusted": 4.0 },
      "asset_quality": { "baseline": 3.0, "adjustment": -0.38, "adjusted": 2.62 },
      "earnings": { "baseline": 3.25, "adjustment": 0.0, "adjusted": 3.25 },
      "liquidity_funding": { "baseline": 2.75, "adjustment": 0.0, "adjusted": 2.75 },
      "sensitivity_proxy": { "baseline": 2.5, "adjustment": 0.0, "adjusted": 2.5 }
    },
    "management_overlay": {
      "baseline_level": "normal",
      "adjusted_level": "watch",
      "caps_band": false,
      "reason": "raw magnitude 0.333 >= 0.25 threshold, elevated one level"
    },
    "overall": {
      "baseline_score": 3.45,
      "adjusted_score": 3.36,
      "baseline_band": "strong",
      "adjusted_band": "strong"
    }
  },
  "caveats": [
    "Blended assessment combines public FDIC data with examiner-provided qualitative inputs",
    "Not an official CAMELS rating or confidential supervisory conclusion"
  ]
}
```

## MCP Tool Promotion Criteria (Phase 2)

The skill promotes to an MCP tool when:

1. The field set has been stable across 10+ analyst sessions without additions or removals
2. The scoring rules have not required manual override in the last 5 sessions
3. The structured appendix schema has not changed in the last 5 sessions
4. At least two analysts have used the workflow and confirmed the field set is sufficient
5. The severe override set is confirmed as complete (no new overrides needed)

At that point, the structured appendix JSON becomes the MCP tool input/output schema with minimal adaptation.

## Future Skill Family

Once this skill proves the pattern, subsequent overlays follow the same architecture:

| Skill | Primary gap addressed |
|-------|----------------------|
| `fdic-examiner-overlay` (this) | Management + general domain overlays |
| `liquidity-funding-depth` | Contingency funding, borrowing capacity, depositor concentration |
| `interest-rate-sensitivity-overlay` | EVE/NII model results, deposit beta assumptions |
| `concentration-risk-context` | CRE/sector/borrower concentration detail |
| `exam-narrative-generator` | Standalone narrative from any blended assessment |

Each uses the same workflow pattern: baseline → domain selection → structured input → bounded adjustment → confirmation → blended output with provenance.
