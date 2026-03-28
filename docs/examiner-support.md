---
title: FDIC Examiner Support
nav_group: prompting
kicker: Skill
summary: A Claude Code skill that guides examiners through layering qualitative knowledge onto a public-data CAMELS proxy baseline.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---

The `/fdic-examiner-overlay` command is a Claude Code skill that guides an experienced bank examiner or financial analyst through enriching a `public_camels_proxy_v1` baseline with qualitative knowledge not available from public Call Report data.

This is a **Claude Code skill**, not an MCP tool. Skills are guided analyst workflows that run inside Claude Code only. MCP tools (like `fdic_analyze_bank_health`) work in any MCP client. This skill builds on those tools to provide a structured, multi-step workflow with bounded adjustments and provenance separation.

## What It Does

1. Fetches a `public_camels_proxy_v1` baseline via `fdic_analyze_bank_health`
2. Presents the baseline and asks which domains you want to overlay
3. Collects structured inputs for each selected domain
4. Computes bounded score adjustments with an analyst confirmation gate
5. Produces a seven-section blended output with explicit provenance separation

## Overlay Domains

Five overlay domains are available in v1. Capital is excluded because it is already the most rules-based component of the proxy and qualitative capital overlay risks overstating supervisory certainty.

| Domain | What the proxy sees | What the examiner adds |
|--------|--------------------|-----------------------|
| `management` | Algorithmic overlay (`normal` / `watch` / `elevated_concern`) inferred from component ratings and trend patterns | Tenure stability, board governance, internal controls, risk management effectiveness, succession planning, supervisory history |
| `asset_quality` | NCL ratio, net charge-offs, reserve coverage, noncurrent assets | Concentration risk, underwriting quality, classified asset trends, allowance adequacy |
| `earnings` | ROA, ROE, NIM, efficiency ratio | Earnings sustainability, revenue diversification, expense management |
| `liquidity_funding` | Loan-to-deposit ratio, core deposits, brokered deposits, cash ratio, borrowed funds | Contingency funding plans, contingent borrowing capacity, depositor concentration, funding stability |
| `sensitivity` | Rate risk proxy from long-term assets and volatile liabilities | IRR model results (EVE/NII), hedging effectiveness, rate environment exposure |

## How Adjustments Work

### Evidence magnitude

Each field response maps to an evidence magnitude: how strong the basis is for adjustment in the analyst's chosen direction.

| Magnitude | Meaning |
|-----------|---------|
| 0.00 | No adjustment basis |
| 0.25 | Moderate basis |
| 0.50 | Strong basis |

Magnitudes are defined per-field, not in a global table, because the same word can mean different things in different domains.

### Direction and confidence

- **`upgrade`**: The proxy underrates the domain and the examiner has evidence of strength. Adjustment is positive.
- **`downgrade`**: The proxy overrates the domain and the examiner has evidence of weakness. Adjustment is negative.
- **`confirm`**: The examiner reviewed the domain and agrees with the proxy. No score change. Still requires evidence for the audit trail.

Confidence caps the maximum adjustment:

| Confidence | Maximum adjustment |
|------------|--------------------|
| `low` | ±0.50 |
| `medium` | ±0.75 |
| `high` | ±1.00 |

### Severe overrides

Certain field responses produce a minimum adjustment floor that cannot be diluted by averaging. These apply to downgrade direction only:

| Field | Response | Minimum floor |
|-------|----------|---------------|
| `supervisory_issues_history` | `enforcement_action` | 0.50 |
| `internal_controls` | `deficient` | 0.50 |
| `contingency_funding` | `absent` | 0.50 |
| `irr_model_results` | `exceeding_limits` | 0.50 |
| `allowance_adequacy` | `inadequate` | 0.50 |

### Management is a separate path

Management does not produce a component score adjustment. It modifies the management overlay state:

- **`confirm`**: No change to overlay. Records the worksheet for audit trail.
- **`downgrade`**: If raw magnitude &ge; 0.25, elevates overlay one level (`normal` &rarr; `watch`, `watch` &rarr; `elevated_concern`). Two-level escalation only if confidence is `high` AND at least one management severe override is present. `elevated_concern` caps the final band down by one level.
- **`upgrade`**: May de-escalate the overlay level if the proxy produced `watch` or `elevated_concern`, the analyst provides `high` confidence with concrete evidence, and no severe override fields are triggered. Cannot boost the institution above the quantitative baseline.

### Overall recomputation

Adjusted component scores are weighted using the same formula as the proxy:

| Component | Weight |
|-----------|--------|
| Capital | 0.30 (unchanged, excluded from overlay) |
| Asset Quality | 0.25 |
| Earnings | 0.20 |
| Liquidity/Funding | 0.15 |
| Sensitivity | 0.10 |

The adjusted overall score maps to bands using the same thresholds: &ge;3.25 strong, &ge;2.50 satisfactory, &ge;1.75 weak, else high risk. If the management overlay is `elevated_concern`, the final band is demoted one level.

## Output Format

The skill produces seven sections:

| Section | Contents |
|---------|----------|
| 1. Public Proxy Baseline | Institution identity, report date, staleness, overall band/score, component scores, management overlay, risk signals |
| 2. Examiner Overlay Inputs | Per-domain: direction, confidence, evidence, source date, field responses |
| 3. Overlay Adjustments | Per-domain: baseline score, raw adjustment, confidence cap, final adjustment, adjusted score |
| 4. Blended Assessment | Adjusted component scores, overall score/band, change from baseline |
| 5. Caveats | Data quality flags, mandatory provenance separation, domain-specific caveats |
| 6. Exam Narrative | Structured paragraphs attributed to source layer (see below) |
| 7. Structured Worksheet | Machine-readable JSON appendix for audit trail and MCP tool promotion |

### Provenance separation in the narrative

Every paragraph in the exam narrative must be attributed to its source layer. The three layers are never merged into undifferentiated prose:

- **"Public data indicate..."** &mdash; findings derived from the proxy baseline
- **"Examiner overlay:"** &mdash; analyst-provided qualitative inputs
- **"Blended interpretation:"** &mdash; combined assessment drawing on both sources

## Walkthrough: Community Bank With Management Concerns

This example shows a typical session. The analyst has recently examined a community bank and wants to enrich the public-data assessment with findings not visible from Call Report data.

### Step 1 &mdash; Invoke the skill and fetch baseline

```text
/fdic-examiner-overlay
```

> "Which institution would you like to assess?"

```text
CERT 12345
```

The skill calls `fdic_analyze_bank_health` and presents the baseline:

```
Public Data Baseline

Institution: First Community Bank (CERT 12345), Springfield, IL
Report Date: 20241231 | Data Staleness: current

Overall: satisfactory (2.88/4.0)

| Component         | Score | Label        | Key Flag            |
|-------------------|-------|--------------|---------------------|
| Capital           | 4.00  | Strong       | PCA: well_capitalized |
| Asset Quality     | 3.00  | Satisfactory |                     |
| Earnings          | 2.50  | Satisfactory |                     |
| Liquidity/Funding | 2.75  | Satisfactory |                     |
| Sensitivity Proxy | 2.50  | Satisfactory |                     |

Management Overlay: normal
Risk Signals: 1 (0 critical, 1 warning: margin_compression)
```

### Step 2 &mdash; Select domains to overlay

> "Which domains do you have examiner knowledge to add?"

```text
management, asset_quality
```

### Step 3 &mdash; Provide management overlay inputs

> "For management, would you like to upgrade, downgrade, or confirm?"

```text
downgrade
```

> "Confidence level?"

```text
high
```

> "Evidence basis?"

```text
CEO resigned in Q3 2024. No documented succession plan. Board has two
vacancies with no timeline for filling. Two open MRAs from the most
recent safety-and-soundness exam related to BSA/AML program deficiencies.
```

The skill then asks the six management field questions:

- `mgmt_tenure_stability`: `significant_disruption`
- `board_governance`: `material_concerns`
- `internal_controls`: `needs_improvement`
- `risk_management`: `adequate`
- `succession_planning`: `absent`
- `supervisory_issues_history`: `open_mras`

### Step 4 &mdash; Provide asset quality overlay inputs

> "For asset quality, would you like to upgrade, downgrade, or confirm?"

```text
confirm
```

> "Confidence level?"

```text
medium
```

> "Evidence basis?"

```text
Loan review completed in November 2024 confirmed reserve levels
are appropriate. No material change in classified asset levels.
The proxy's satisfactory rating aligns with examination findings.
```

The analyst answers the four asset quality fields, all mapping to the first tier (no adjustment basis). Direction is `confirm`, so no score change regardless.

### Step 5 &mdash; Review proposed adjustments

```
Proposed Adjustments

| Domain        | Baseline | Direction | Raw Adj | Severe | Final Adj | Adjusted |
|---------------|----------|-----------|---------|--------|-----------|----------|
| asset_quality | 3.00     | confirm   | 0.00    | N      | 0.00      | 3.00     |

Management overlay: normal -> watch
  Reason: raw magnitude 0.33 >= 0.25, elevated one level

Overall: satisfactory (2.88) -> satisfactory (2.88)
  (score unchanged; management overlay moved to watch but does not cap band)
```

> "Confirm these adjustments, or revise any domain?"

```text
Confirm
```

### Step 6 &mdash; Blended output

The skill produces all seven sections. The exam narrative separates provenance:

> **Public data indicate** First Community Bank reported satisfactory financial ratios across all components as of December 31, 2024, with a well-capitalized PCA classification and one warning-level risk signal for margin compression...
>
> **Examiner overlay:** Based on the Q3 2024 CEO departure, two board vacancies, absence of a documented succession plan, and two open BSA/AML-related MRAs, the management overlay is elevated from normal to watch...
>
> **Blended interpretation:** The institution's quantitative profile remains satisfactory, but management stability and governance concerns warrant heightened monitoring. The elevated management overlay does not cap the overall band at this level but signals that deterioration in other components under current management conditions could accelerate the institution toward a weaker posture...

The structured JSON worksheet (Section 7) captures every input, magnitude, adjustment computation, and caveat for the audit trail.

## Key Points For Effective Use

- **Start from the baseline.** Review the proxy output before deciding which domains to overlay. The proxy may already capture concerns you would have flagged.
- **Use `confirm` freely.** If the proxy is adequate in a domain, select it and confirm with evidence. That records your review in the audit trail without forcing a score change.
- **Evidence is required.** Vague statements like "management seems weak" will be re-prompted. Tie overlays to specific, observable factors.
- **Adjustments are bounded.** No single domain overlay can move a score by more than ±1.0, and low-confidence inputs are further capped. The skill cannot produce extreme swings from a few qualitative inputs.
- **Capital is excluded in v1.** It is already the most rules-based component of the proxy. Qualitative capital overlay risks overstating supervisory certainty.
- **Some inputs reflect confidential information.** Fields like `classified_asset_trend` and `supervisory_issues_history` may contain confidential supervisory information. The skill marks these in the caveats section. The blended output should be handled according to your institution's information-sharing policies.

## Planned Overlay Skills

The examiner overlay is the first in a planned family of analyst skills. Each follows the same pattern: structured input, bounded adjustment, provenance-separated output.

| Skill | Status | Domain |
|-------|--------|--------|
| `fdic-examiner-overlay` | v1 available | Management, asset quality, earnings, liquidity/funding, sensitivity |
| `fdic-liquidity-funding-depth` | Planned | Contingency funding, borrowing capacity, depositor concentration |
| `fdic-interest-rate-sensitivity-overlay` | Planned | EVE/NII results, hedging, repricing exposure |
| `fdic-concentration-risk-context` | Planned | CRE, sector, single-borrower, geographic concentration |
| `fdic-exam-narrative-generator` | Planned | Examination-quality narrative from proxy and overlay outputs |

## Promotion Path

The examiner overlay skill is designed to stabilize its field set and scoring rules through analyst use before being promoted into a programmatic MCP tool. The promotion criteria are:

1. Field enums produce consistent analyst responses across multiple users
2. The scoring rules do not require frequent manual overrides
3. The structured worksheet JSON shape is stable across sessions
4. At least two overlay domains have been validated through real examination workflows

Until those criteria are met, the skill remains a conversational workflow rather than a frozen tool contract.
