---
title: "FDIC Examiner Support"
nav_group: skills
kicker: Skill
summary: A Claude Code skill that guides examiners through layering qualitative knowledge onto a public-data CAMELS proxy baseline.
breadcrumbs:
  - title: Overview
    url: /
  - title: Skills
    url: /skills/
---

The `/fdic-examiner-overlay` command guides an experienced bank examiner or financial analyst through enriching a `public_camels_proxy_v1` baseline with qualitative knowledge not available from public Call Report data.

This is a **Claude Code skill**, not an MCP tool. It requires Claude Code with the plugin installed. If you are using another MCP client, you can run `fdic_analyze_bank_health` to get the public-data baseline, but the structured overlay workflow is only available through this skill.

## When to Use It

- You have examiner-grade qualitative knowledge (examination findings, classified asset details, management assessments) that you want to systematically layer onto a public-data baseline.
- You need a blended assessment with clear provenance separation between public-data findings and examiner inputs.
- You want bounded, auditable score adjustments rather than ad-hoc narrative overlay.

## When Not to Use It

- **You only need the public-data baseline**: Use `fdic_analyze_bank_health` directly.
- **You want a comprehensive institution report**: Run [Bank Deep Dive]({{ '/skills/bank-deep-dive/' | relative_url }}) first, then use this skill to overlay examiner knowledge on the health assessment.
- **You are screening a portfolio**: Use [Portfolio Surveillance]({{ '/skills/portfolio-surveillance/' | relative_url }}) for population-level screening.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Institution identity | Yes | Bank name or FDIC CERT number |
| Overlay domains | Interactive | Selected during the session from: `management`, `asset_quality`, `earnings`, `liquidity_funding`, `sensitivity` |
| Per-domain inputs | Interactive | Direction (upgrade/downgrade/confirm), confidence level, evidence basis, and domain-specific field responses |

Capital is excluded from overlay in v1 because it is already the most rules-based component of the proxy.

## Example Session

**Step 1** — Invoke the skill:

```text
/fdic-examiner-overlay
```

The skill asks which institution to assess, fetches the public-data baseline via `fdic_analyze_bank_health`, and presents the CAMELS-proxy scores.

**Step 2** — Select domains to overlay:

```text
management, asset_quality
```

**Step 3** — Provide inputs for each domain. The skill asks structured questions: direction, confidence, evidence, and domain-specific fields (e.g., management tenure stability, board governance, internal controls).

**Step 4** — Review proposed adjustments. The skill shows baseline scores, raw adjustments, confidence caps, and final adjusted scores. You confirm or revise.

**Step 5** — Receive the blended output with seven sections and explicit provenance separation.

## What Output to Expect

| Section | Contents |
|---------|----------|
| 1. Public Proxy Baseline | Institution identity, report date, overall band/score, component scores, management overlay, risk signals |
| 2. Examiner Overlay Inputs | Per-domain: direction, confidence, evidence, source date, field responses |
| 3. Overlay Adjustments | Per-domain: baseline score, raw adjustment, confidence cap, final adjustment, adjusted score |
| 4. Blended Assessment | Adjusted component scores, overall score/band, change from baseline |
| 5. Caveats | Data quality flags, mandatory provenance separation, domain-specific caveats |
| 6. Exam Narrative | Structured paragraphs attributed to source layer |
| 7. Structured Worksheet | Machine-readable JSON appendix for audit trail |

### Provenance Separation

Every paragraph in the exam narrative is attributed to its source:

- **"Public data indicate..."** — findings from the proxy baseline
- **"Examiner overlay:"** — analyst-provided qualitative inputs
- **"Blended interpretation:"** — combined assessment drawing on both sources

The three layers are never merged into undifferentiated prose.

## How Adjustments Work

### Evidence Magnitude

Each field response maps to an evidence magnitude (0.00 = no basis, 0.25 = moderate, 0.50 = strong) that quantifies the strength of the adjustment basis.

### Direction and Confidence

- **Upgrade**: Proxy underrates the domain; examiner has evidence of strength.
- **Downgrade**: Proxy overrates the domain; examiner has evidence of weakness.
- **Confirm**: Examiner agrees with the proxy. No score change, but evidence is recorded for the audit trail.

Confidence caps the maximum adjustment: low (&#177;0.50), medium (&#177;0.75), high (&#177;1.00).

### Severe Overrides

Certain field responses produce a minimum adjustment floor that cannot be diluted (downgrade only): enforcement actions, deficient internal controls, absent contingency funding, IRR limits exceeded, or inadequate allowance. Each carries a 0.50 minimum floor.

### Management Path

Management does not produce a component score adjustment. Instead, it modifies the management overlay state (`normal` / `watch` / `elevated_concern`). At `elevated_concern`, the final overall band is demoted one level.

### Recomputation

Adjusted component scores are weighted (Capital 0.30, Asset Quality 0.25, Earnings 0.20, Liquidity 0.15, Sensitivity 0.10) and mapped to bands using the same thresholds as the proxy.

## Overlay Domains

| Domain | What the Proxy Sees | What the Examiner Adds |
|--------|--------------------|-----------------------|
| Management | Algorithmic overlay from component ratings and trends | Tenure stability, governance, controls, risk management, succession, supervisory history |
| Asset Quality | NCL ratio, charge-offs, reserve coverage, noncurrent assets | Concentration risk, underwriting quality, classified trends, allowance adequacy |
| Earnings | ROA, ROE, NIM, efficiency ratio | Sustainability, diversification, expense management |
| Liquidity/Funding | Loan-to-deposit, core deposits, brokered deposits, cash ratio | Contingency plans, borrowing capacity, depositor concentration, stability |
| Sensitivity | Rate risk proxy from long-term assets and volatile liabilities | IRR model results (EVE/NII), hedging effectiveness, rate exposure |

## Key Caveats

- **Claude Code only**: The interactive overlay workflow is not available in other MCP clients.
- **Examiner knowledge required**: The skill collects specific, structured inputs. Vague evidence will be re-prompted.
- **Bounded adjustments**: No single domain can move a score by more than &#177;1.0. Low-confidence inputs are further capped.
- **Confidential inputs**: Fields like classified asset trends and supervisory history may contain confidential supervisory information. The caveats section marks these. Handle the blended output according to your institution's information-sharing policies.
- **Capital excluded**: Capital overlay is not available in v1.
- **Proxy baseline**: The starting point is a public-data analytical proxy, not an official CAMELS rating.

## Planned Overlay Skills

| Skill | Status | Domain |
|-------|--------|--------|
| `fdic-examiner-overlay` | v1 available | Management, asset quality, earnings, liquidity/funding, sensitivity |
| `fdic-liquidity-funding-depth` | Planned | Contingency funding, borrowing capacity, depositor concentration |
| `fdic-interest-rate-sensitivity-overlay` | Planned | EVE/NII results, hedging, repricing exposure |
| `fdic-concentration-risk-context` | Planned | CRE, sector, single-borrower, geographic concentration |
| `fdic-exam-narrative-generator` | Planned | Examination-quality narrative from proxy and overlay outputs |

## Promotion Path

The examiner overlay is designed to stabilize through analyst use before potential promotion to a programmatic MCP tool. Promotion criteria: stable field enums, consistent scoring, stable worksheet JSON shape, and validation through real examination workflows.

## Under the Hood

The skill orchestrates one MCP tool:

| Tool | Purpose |
|------|---------|
| `fdic_analyze_bank_health` | Fetch the `public_camels_proxy_v1` baseline for the target institution |

All other computation (evidence magnitudes, adjustment caps, severe overrides, recomputation) happens within the skill's conversational logic, not through additional MCP tool calls.
