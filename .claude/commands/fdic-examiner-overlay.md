---
name: fdic-examiner-overlay
description: Guided examiner workflow that layers qualitative analyst knowledge onto a public_camels_proxy_v1 baseline. Produces a blended assessment with explicit provenance separating public-data findings from examiner overlay inputs. Use when the analyst wants to enrich a bank health assessment with examination-grade qualitative context.
# NOTE: The MCP tool ID prefix (UUID) is session-specific and must be verified at runtime.
# The fdic_analyze_bank_health tool follows the pattern: mcp__<server-uuid>__fdic_analyze_bank_health
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob", "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_bank_health"]
---

# /fdic-examiner-overlay

## Skill Type: RIGID

This workflow is non-negotiable in structure. You MUST follow every step in order.
You MUST NOT skip the confirmation gate. You MUST NOT merge provenance layers in the narrative.

Every paragraph or finding in the final output must be attributed to its source layer:
- **Public data indicate...** — proxy baseline findings
- **Examiner overlay:** — analyst-provided inputs
- **Blended interpretation:** — combined assessment

These three layers must NEVER be merged into undifferentiated prose.

---

## Step 1: Fetch Baseline

Ask the analyst:
> "Which institution would you like to assess? Provide the CERT number, and optionally a report date (YYYYMMDD)."

Once you have the CERT (and optional repdte):

1. Call the `fdic_analyze_bank_health` MCP tool with the provided `cert` and `repdte` (or omit repdte for the default latest quarter).
2. From the tool result, extract:
   - `structuredContent.proxy` — the full `ProxyAssessment` object (quantitative baseline)
   - `structuredContent.institution` — identity fields (name, city, state, charter_class, total_assets, report_date, data_staleness)
   - `structuredContent.risk_signals` — legacy risk signal list
   - `content[0].text` — the human-readable text summary (for reference)
3. Store these as the **baseline** for the remainder of the workflow.

If the tool call fails or returns no data, report the error and stop. Do not proceed without a valid baseline.

---

## Step 2: Present Baseline Summary

Present the baseline to the analyst in this exact format:

---

### Public Data Baseline

**Institution:** [name] (CERT [cert]), [city], [state]
**Report Date:** [repdte] | **Data Staleness:** [staleness]

**Overall:** [band] ([score]/4.0)

| Component | Score | Label | Key Flag |
|-----------|-------|-------|----------|
| Capital | [score] | [label] | PCA: [category] |
| Asset Quality | [score] | [label] | |
| Earnings | [score] | [label] | |
| Liquidity/Funding | [score] | [label] | |
| Sensitivity Proxy | [score] | [label] | |

**Management Overlay:** [level] ([reason_codes if any])
**Risk Signals:** [count] ([critical] critical, [warning] warning, [info] info)
**Data Quality:** [gaps_count] gaps; [staleness]

*Source: public_camels_proxy_v1 — public off-site proxy, not official CAMELS*

---

Then ask:
> "This is the public-data baseline. Which domains do you have examiner knowledge to add? Options: **management**, **asset_quality**, **earnings**, **liquidity_funding**, **sensitivity**. You may select multiple, or none."

---

## Step 3: Domain Selection

The analyst selects which domains to overlay. Valid v1 domains:
- `management`
- `asset_quality`
- `earnings`
- `liquidity_funding`
- `sensitivity`

**Capital is excluded in v1.** If the analyst asks to overlay capital, explain: "Capital is excluded from the examiner overlay in v1. It is already the most rules-based component of the proxy and is well-covered by PCA thresholds. Qualitative capital overlay risks slipping into confidential supervisory territory and overstating supervisory certainty."

**Rules:**
- Multiple domains may be selected.
- If the analyst selects zero domains, end the workflow: "No overlay domains selected. The public-data baseline stands as-is."
- Record `overlaid_domains` and `unselected_domains` for the audit trail.
- `excluded_domains` is always `["capital"]` in v1.

Proceed to Step 4 for the first selected domain.

---

## Step 4: Structured Input Collection

For each selected domain, collect inputs in this order:

### 4a. Ask for direction, confidence, and evidence

First, ask for direction:
> "For **[domain_name]**, would you like to **upgrade**, **downgrade**, or **confirm** the proxy assessment?"

- `upgrade` means the analyst believes the proxy understates the institution's condition in this domain.
- `downgrade` means the analyst believes the proxy overstates the institution's condition in this domain.
- `confirm` means the analyst reviewed the domain, agrees with the proxy, and produces no score change. Still requires evidence. This is the "no overlay" escape hatch within a selected domain.

Then ask for confidence:
> "What is your confidence level? **low**, **medium**, or **high**?"

Then ask for evidence:
> "What is the evidence basis for this overlay? (Required — provide a short statement of the factual basis.)"

For `upgrade` direction: if the evidence statement is vague or lacks concrete factors (e.g., "things look good," "management seems solid"), prompt once more:
> "Can you tie this to specific observable factors (e.g., recent exam findings, board actions, documented improvements, measurable changes)?"

Then ask for source date (optional):
> "When was this information current? (date, or skip if not applicable)"

### 4b. Ask domain-specific field questions

Present each field question in order. The analyst responds with one of the listed options. Accept reasonable synonyms and normalize to the canonical response value.

#### Management fields

| Field | Question | Options |
|-------|----------|---------|
| `mgmt_tenure_stability` | "How would you characterize senior management tenure and stability?" | `stable` / `recent_turnover` / `significant_disruption` |
| `board_governance` | "Any board or governance concerns? (independence, expertise, engagement, conflicts)" | `no_concerns` / `minor_concerns` / `material_concerns` |
| `internal_controls` | "Internal audit and control environment findings?" | `satisfactory` / `needs_improvement` / `deficient` |
| `risk_management` | "How effective is the institution's risk management framework?" | `effective` / `adequate` / `inadequate` |
| `succession_planning` | "Is there a credible succession plan for key positions?" | `documented` / `informal` / `absent` |
| `supervisory_issues_history` | "Any recent enforcement actions, MRAs, or exam-history flags?" | `clean` / `open_mras` / `enforcement_action` |

#### Asset Quality fields

| Field | Question | Options |
|-------|----------|---------|
| `concentration_risk` | "Any material loan concentration concerns? (CRE, single-borrower, sector)" | `no_concerns` / `moderate` / `elevated` |
| `underwriting_quality` | "How would you assess recent underwriting standards?" | `sound` / `loosening` / `weak` |
| `classified_asset_trend` | "Direction of classified/criticized assets since last exam?" | `improving` / `stable` / `deteriorating` |
| `allowance_adequacy` | "Is the allowance (ALLL/ACL) adequate relative to identified risk?" | `adequate` / `marginally_adequate` / `inadequate` |

**Confidential data flag:** The `classified_asset_trend` field reflects confidential supervisory information. Record this for inclusion in the caveats section of the final output.

#### Earnings fields

| Field | Question | Options |
|-------|----------|---------|
| `earnings_sustainability` | "Are current earnings levels sustainable, or driven by one-time items / nonrecurring support?" | `sustainable` / `partially_nonrecurring` / `largely_nonrecurring` |
| `revenue_diversification` | "How concentrated is the revenue base?" | `diversified` / `moderately_concentrated` / `highly_concentrated` |
| `expense_management` | "Is management actively controlling operating expenses?" | `well_managed` / `adequate` / `poorly_managed` |

#### Liquidity/Funding fields

| Field | Question | Options |
|-------|----------|---------|
| `contingency_funding` | "Is there a tested contingency funding plan?" | `tested` / `documented_untested` / `absent` |
| `contingent_borrowing_capacity` | "Available borrowing capacity (FHLB, Fed discount window, unencumbered collateral, tested line availability)?" | `ample` / `adequate` / `constrained` |
| `depositor_concentration` | "Top-10 depositor concentration concern?" | `no_concern` / `moderate` / `elevated` |
| `funding_stability` | "Overall assessment of funding stability beyond what ratios show?" | `stable` / `adequate` / `vulnerable` |

#### Sensitivity fields

| Field | Question | Options |
|-------|----------|---------|
| `irr_model_results` | "EVE/NII shock results — within policy limits?" | `within_limits` / `approaching_limits` / `exceeding_limits` |
| `hedging_effectiveness` | "Any material hedging or derivatives positions? Effective?" | `not_applicable` / `effective` / `ineffective` |
| `rate_environment_exposure` | "Directional exposure to the current rate environment?" | `well_positioned` / `neutral` / `adversely_exposed` |

### 4c. Map responses to magnitudes

After collecting all field responses for a domain, map each response to an evidence magnitude using these per-field tables. The magnitude represents the strength of basis for adjustment, not the direction (direction is captured separately).

**Management magnitude mapping:**

| Field | 0.00 (no basis) | 0.25 (moderate basis) | 0.50 (strong basis) |
|-------|-----|------|------|
| `mgmt_tenure_stability` | `stable` | `recent_turnover` | `significant_disruption` |
| `board_governance` | `no_concerns` | `minor_concerns` | `material_concerns` |
| `internal_controls` | `satisfactory` | `needs_improvement` | `deficient` |
| `risk_management` | `effective` | `adequate` | `inadequate` |
| `succession_planning` | `documented` | `informal` | `absent` |
| `supervisory_issues_history` | `clean` | `open_mras` | `enforcement_action` |

**Asset Quality magnitude mapping:**

| Field | 0.00 (no basis) | 0.25 (moderate basis) | 0.50 (strong basis) |
|-------|-----|------|------|
| `concentration_risk` | `no_concerns` | `moderate` | `elevated` |
| `underwriting_quality` | `sound` | `loosening` | `weak` |
| `classified_asset_trend` | `improving` | `stable` | `deteriorating` |
| `allowance_adequacy` | `adequate` | `marginally_adequate` | `inadequate` |

**Earnings magnitude mapping:**

| Field | 0.00 (no basis) | 0.25 (moderate basis) | 0.50 (strong basis) |
|-------|-----|------|------|
| `earnings_sustainability` | `sustainable` | `partially_nonrecurring` | `largely_nonrecurring` |
| `revenue_diversification` | `diversified` | `moderately_concentrated` | `highly_concentrated` |
| `expense_management` | `well_managed` | `adequate` | `poorly_managed` |

**Liquidity/Funding magnitude mapping:**

| Field | 0.00 (no basis) | 0.25 (moderate basis) | 0.50 (strong basis) |
|-------|-----|------|------|
| `contingency_funding` | `tested` | `documented_untested` | `absent` |
| `contingent_borrowing_capacity` | `ample` | `adequate` | `constrained` |
| `depositor_concentration` | `no_concern` | `moderate` | `elevated` |
| `funding_stability` | `stable` | `adequate` | `vulnerable` |

**Sensitivity magnitude mapping:**

| Field | 0.00 (no basis) | 0.25 (moderate basis) | 0.50 (strong basis) |
|-------|-----|------|------|
| `irr_model_results` | `within_limits` | `approaching_limits` | `exceeding_limits` |
| `hedging_effectiveness` | `not_applicable` | `effective` | `ineffective` |
| `rate_environment_exposure` | `well_positioned` | `neutral` | `adversely_exposed` |

Note for `hedging_effectiveness`: `not_applicable` maps to 0.00 (no hedging program means no basis for adjustment on this field). `effective` maps to 0.25 (hedging exists and works, moderate positive signal). `ineffective` maps to 0.50 (hedging exists but fails, strong negative signal).

### 4d. Identify severe override flags

Certain field responses produce a **minimum adjustment floor** for the domain when the direction is `downgrade`. The domain adjustment will be at least the floor value, even if the mean of other fields would produce a smaller number.

**Severe override fields (all carry a floor of 0.50):**

| Field | Triggering Response | Domain |
|-------|-------------------|--------|
| `supervisory_issues_history` | `enforcement_action` | Management |
| `internal_controls` | `deficient` | Management |
| `contingency_funding` | `absent` | Liquidity/Funding |
| `irr_model_results` | `exceeding_limits` | Sensitivity |
| `allowance_adequacy` | `inadequate` | Asset Quality |

Severe overrides apply **only** when the direction is `downgrade`. If the direction is `upgrade` or `confirm`, severe override flags are recorded but do not trigger floor enforcement.

The following are explicitly **not** severe overrides (too ambiguous for a floor):
- `open_mras` (supervisory_issues_history)
- `material_concerns` (board_governance)
- `adequate` (in any context)

### 4e. Record the normalized worksheet

For each domain, record the complete worksheet entry in this format:

```json
{
  "domain": "[domain_name]",
  "direction": "[upgrade|downgrade|confirm]",
  "confidence": "[low|medium|high]",
  "evidence": "[analyst's basis statement]",
  "source_date": "[YYYY-MM-DD date string, or null if not provided]",
  "fields": {
    "[field_name]": {
      "response": "[selected canonical option]",
      "magnitude": [0.00, 0.25, or 0.50],
      "severe_override": [true if this field+response triggers a severe override AND direction is downgrade, false otherwise]
    },
    "[field_name]": {
      "response": "[selected canonical option]",
      "magnitude": [0.00, 0.25, or 0.50],
      "severe_override": [true or false]
    }
  }
}
```

Every field for the domain must be present in the worksheet, even if the response maps to magnitude 0.00.

Repeat Step 4 (sub-steps 4a through 4e) for each selected domain in order, then proceed to Step 5.

---

## Step 5: Compute Overlay Adjustments

[To be implemented]

---

## Step 6: Analyst Confirmation Gate

[To be implemented]

---

## Step 7: Produce Blended Output

[To be implemented]
