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

For each overlaid domain, compute the bounded adjustment. Non-management domains adjust a component score. Management adjusts the overlay state. Then recompute the overall score.

### 5a. Non-management domains (asset_quality, earnings, liquidity_funding, sensitivity)

For each non-management overlaid domain, compute the adjustment as follows:

1. **Collect field magnitudes** for the domain: gather all per-field magnitude values from the worksheet recorded in Step 4e.

2. **Compute raw_adjustment:**
   - If direction is `confirm`: `raw_adjustment = 0.0` (no change regardless of field magnitudes)
   - If direction is `upgrade`: `raw_adjustment = +mean(field_magnitudes)`
   - If direction is `downgrade`: `raw_adjustment = -mean(field_magnitudes)`

3. **Apply severe override floor** (downgrade only):
   - If direction is `downgrade` AND any field in this domain has `severe_override = true`:
     `raw_adjustment = min(raw_adjustment, -0.50)`
   - This ensures the adjustment is at least -0.50 when a severe override fires, even if the mean of magnitudes would produce a smaller absolute value.
   - If direction is `upgrade` or `confirm`, severe override flags are recorded in the worksheet but do NOT enforce a floor.

4. **Apply confidence cap:**
   - `low` confidence: clamp raw_adjustment to the range [-0.50, +0.50]
   - `medium` confidence: clamp raw_adjustment to the range [-0.75, +0.75]
   - `high` confidence: clamp raw_adjustment to the range [-1.00, +1.00]
   - The result after clamping is the `domain_adjustment`.

5. **Compute adjusted component score:**
   - `adjusted_score = clamp(baseline_component_score + domain_adjustment, 1.0, 4.0)`
   - The score can never go below 1.0 or above 4.0 regardless of the adjustment magnitude.

6. **Record the computation** for each domain:
   - `raw_adjustment` (before severe floor and confidence cap)
   - Whether severe override floor was applied (Y/N) and which field(s) triggered it
   - `confidence_cap` value used
   - `domain_adjustment` (after severe floor and confidence cap)
   - `baseline_score` and `adjusted_score`

For domains that were NOT selected for overlay, the adjusted score equals the baseline score with adjustment = 0.0.

### 5b. Management domain (separate overlay path)

Management does NOT produce a numeric component score adjustment. Instead, it modifies the management overlay level (normal / watch / elevated_concern).

**If direction is `confirm`:**
- No change to the management overlay level. The overlay stays at whatever the proxy baseline produced.
- The worksheet is still recorded for the audit trail.

**If direction is `downgrade`:**
1. Compute `raw_magnitude = mean(field_magnitudes)` from all six management fields.
2. If `raw_magnitude >= 0.25`: elevate the overlay by ONE level:
   - `normal` becomes `watch`
   - `watch` becomes `elevated_concern`
   - `elevated_concern` stays at `elevated_concern` (already at maximum; note in the narrative that the downgrade reinforces the existing elevated concern)
3. Two-level escalation (`normal` directly to `elevated_concern`) is permitted ONLY when ALL of the following conditions are met:
   - Confidence is `high`
   - AND at least one management severe override is present: either `supervisory_issues_history = enforcement_action` or `internal_controls = deficient`
4. If the proxy baseline already produced `elevated_concern`, a management downgrade reinforces it. There is no double-cap on the overall band, but the narrative must note that examiner overlay confirms the proxy's elevated concern finding.

**If direction is `upgrade`:**
- May de-escalate the overlay by one level ONLY when ALL of the following conditions are met:
  - The proxy baseline overlay was `watch` or `elevated_concern`
  - AND confidence is `high`
  - AND the evidence statement references concrete factors (not vague positive sentiment)
  - AND no severe override fields are triggered in the management worksheet (i.e., `supervisory_issues_history` is not `enforcement_action` and `internal_controls` is not `deficient`)
- De-escalation moves the overlay down one level: `elevated_concern` becomes `watch`, `watch` becomes `normal`.
- Cannot reduce below `normal`.
- If the proxy baseline overlay was already `normal`, an upgrade has no effect on the overlay level. Record this in the narrative.

Record the management overlay computation:
- `baseline_level` (from proxy)
- `adjusted_level` (after overlay)
- `caps_band` (true if adjusted_level is `elevated_concern`, false otherwise)
- `reason` (explanation of why the level changed or stayed the same)

### 5c. Recompute overall score and band

1. **Gather adjusted component scores** (use baseline score for any domain not overlaid; capital is always the baseline score in v1):
   - C = capital baseline score (always unchanged, excluded from overlay in v1)
   - A = asset_quality adjusted score (or baseline if not overlaid)
   - E = earnings adjusted score (or baseline if not overlaid)
   - L = liquidity_funding adjusted score (or baseline if not overlaid)
   - S = sensitivity adjusted score (or baseline if not overlaid)

2. **Compute the weighted average:**
   - `adjusted_overall = C * 0.30 + A * 0.25 + E * 0.20 + L * 0.15 + S * 0.10`

3. **Map score to band:**
   - `>= 3.25` maps to `strong`
   - `>= 2.50` maps to `satisfactory`
   - `>= 1.75` maps to `weak`
   - `< 1.75` maps to `high_risk`

4. **Apply management overlay band cap:**
   - If the adjusted management overlay level is `elevated_concern`, demote the band by one level:
     - `strong` becomes `satisfactory`
     - `satisfactory` becomes `weak`
     - `weak` becomes `high_risk`
     - `high_risk` stays at `high_risk` (already at minimum)

5. **Record the overall computation:**
   - `baseline_score` and `adjusted_score`
   - `baseline_band` and `adjusted_band`
   - Whether the management overlay cap was applied

Proceed to Step 6 with all computed adjustments.

---

## Step 6: Analyst Confirmation Gate

Before generating the final output, present a compact adjustment summary to the analyst for review.

### Present the adjustment summary

Show the following table and summary:

---

### Proposed Adjustments

| Domain | Baseline | Direction | Raw Adj | Severe | Conf Cap | Final Adj | Adjusted |
|--------|----------|-----------|---------|--------|----------|-----------|----------|
| [for each overlaid non-management domain, one row] | [baseline_score] | [upgrade/downgrade/confirm] | [raw_adjustment, signed, 2 decimal places] | [Y/N] | [+/-cap value] | [domain_adjustment, signed, 2 decimal places] | [adjusted_score, 2 decimal places] |

For non-overlaid domains, do NOT include a row (they pass through unchanged).

**Management overlay:** [baseline_level] -> [adjusted_level] ([reason — e.g., "raw magnitude 0.33 >= 0.25, elevated one level" or "no change, direction was confirm"])

**Overall:** [baseline_band] ([baseline_score]) -> [adjusted_band] ([adjusted_score])

---

### Ask for confirmation

Then ask:

> "Please review the proposed adjustments above. You may:
> - **Confirm** — accept these adjustments and generate the blended output
> - **Revise** — re-enter inputs for a specific domain (tell me which one)
> - **Cancel** — discard all overlay inputs and end the workflow"

**If the analyst says confirm:**
- Record `analyst_confirmed: true` in the structured appendix.
- Proceed to Step 7.

**If the analyst wants to revise:**
- Ask which domain to revise.
- Return to Step 4 for that specific domain only (re-collect direction, confidence, evidence, and all field responses).
- After re-collection, recompute Step 5 (all adjustments, including the overall recomputation, since changing one domain affects the overall score).
- Re-present Step 6 with the updated adjustment summary.
- Repeat until the analyst confirms or cancels.

**If the analyst wants to cancel:**
- Record `analyst_confirmed: false`.
- End the workflow: "Overlay cancelled. No blended output produced. The public-data baseline stands as-is."
- Do NOT produce the seven-section output.

---

## Step 7: Produce Blended Output

Generate the following seven sections. Do NOT deviate from this structure. Do NOT skip any section. Do NOT reorder sections.

### Section 1: Public Proxy Baseline

Reproduce the baseline summary from Step 2 exactly as it was shown to the analyst, including the table format and source attribution line. This anchors the reader in what the public data alone show before any overlay is applied.

Present it under the heading:

```
## 1. Public Proxy Baseline

**Institution:** [name] (CERT [cert]), [city], [state]
**Report Date:** [repdte] | **Data Staleness:** [staleness]

**Overall:** [baseline_band] ([baseline_score]/4.0)

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
```

### Section 2: Examiner Overlay Inputs

List which domains were overlaid, which were left unchanged, and which are excluded. Then for each overlaid domain, show the direction, confidence, evidence, source date, and every field with its response and magnitude.

```
## 2. Examiner Overlay Inputs

Domains overlaid: [comma-separated list of overlaid domain names]
Domains unchanged: [comma-separated list of unselected domain names]
Excluded (v1): capital
```

Then for each overlaid domain, present:

```
### [Domain Name]
Direction: [upgrade|downgrade|confirm]
Confidence: [low|medium|high]
Evidence: [analyst's basis statement]
Source date: [YYYY-MM-DD or "not specified"]

| Field | Response | Magnitude |
|-------|----------|-----------|
| [field_name] | [response] | [0.00/0.25/0.50] |
| [field_name] | [response] | [0.00/0.25/0.50] |
```

Include every field for the domain, even if magnitude is 0.00. If a field triggered a severe override, append "(severe override)" after the magnitude value.

### Section 3: Overlay Adjustments

Show the computation results in a table, the management overlay change, and any conflicts.

```
## 3. Overlay Adjustments

| Domain | Baseline | Raw Adj | Severe Floor | Conf Cap | Final Adj | Adjusted |
|--------|----------|---------|--------------|----------|-----------|----------|
| [for each overlaid non-management domain] | [baseline_score] | [raw_adjustment] | [Y: -0.50 / N] | [+/-cap] | [domain_adjustment] | [adjusted_score] |

Management overlay: [baseline_level] -> [adjusted_level]
  Reason: [explanation of the change or why no change occurred]
  Caps band: [yes/no]

Conflicts: [any noted conflicts between overlay inputs and proxy signals, or "none"]
```

For the "Conflicts" line, note if the examiner overlay contradicts a proxy risk signal (e.g., examiner upgrades asset quality while the proxy flagged elevated NCL ratio). This is informational only and does not block the adjustment.

### Section 4: Blended Assessment

Show the final adjusted scores with markers indicating which components were adjusted by examiner overlay.

```
## 4. Blended Assessment

**Overall:** [adjusted_band] ([adjusted_score]/4.0)

| Component | Score | Label | Overlay |
|-----------|-------|-------|---------|
| Capital | [score] | [label] | (unchanged — excluded from overlay) |
| Asset Quality | [score] | [label] | [<- examiner overlay / (unchanged)] |
| Earnings | [score] | [label] | [<- examiner overlay / (unchanged)] |
| Liquidity/Funding | [score] | [label] | [<- examiner overlay / (unchanged)] |
| Sensitivity Proxy | [score] | [label] | [<- examiner overlay / (unchanged)] |

**Management Overlay:** [adjusted_level]
**Change from baseline:** [band unchanged | band moved from [baseline_band] to [adjusted_band]]
```

Mark each component that received an examiner overlay adjustment with "<- examiner overlay". Components that were not overlaid show "(unchanged)". Capital always shows "(unchanged — excluded from overlay)".

### Section 5: Caveats

Always include these mandatory caveats, followed by any domain-specific caveats that apply.

```
## 5. Caveats

**Mandatory:**
- This assessment combines public FDIC data with examiner-provided qualitative inputs. It is not an official CAMELS rating.
- Public data findings and examiner overlay inputs are attributed separately throughout this document and should not be cited as a single undifferentiated source.
- The public_camels_proxy_v1 model produces an off-site screening estimate, not a supervisory conclusion. Overlaying examiner knowledge improves context but does not replicate a full-scope examination.
```

Then add domain-specific caveats as applicable:

- If `classified_asset_trend` was collected (i.e., asset_quality was an overlaid domain): "The classified asset trend input reflects confidential supervisory information not available from public data sources. Distribution of this assessment should account for the inclusion of confidential supervisory data."
- If any `source_date` provided by the analyst is more than 6 months before the report date (repdte): "Some examiner inputs reference information dated [source_date], which is more than six months prior to the financial reporting period ([repdte]). The relevance of these inputs may have diminished."
- If any `source_date` was not provided (null): "Source dates were not specified for all examiner inputs. The currency of undated inputs cannot be independently verified."
- Include any data quality flags from the proxy baseline (e.g., data gaps, staleness warnings).

```
**Domain-specific:**
- [each applicable caveat from the list above]

**Data quality:**
- [proxy baseline data quality flags — gaps count, staleness, any missing metrics]
```

### Section 6: Exam Narrative

**HARD RULE:** Every paragraph in this narrative MUST be attributed to exactly one of three source layers. These three layers MUST NEVER be merged into undifferentiated prose. Each paragraph begins with its attribution tag in bold.

The three attribution tags are:
- **"Public data indicate..."** — findings derived solely from the proxy baseline and public FDIC data
- **"Examiner overlay:"** — findings derived solely from analyst-provided qualitative inputs
- **"Blended interpretation:"** — combined assessment that draws on both public data and examiner inputs

Structure the narrative as follows:

1. **Opening paragraph** (public data layer): Introduce the institution, its overall baseline assessment, and key public-data characteristics (asset size, charter type, overall proxy score and band).

2. **For each overlaid domain**, write three paragraphs in order:
   a. **Public data layer:** What the proxy shows for this domain — the baseline score, the key metrics that drove it, and any risk signals from the proxy.
   b. **Examiner overlay layer:** What the analyst provided — the direction, confidence, key field responses, and the evidence basis. Reference specific field responses (e.g., "The examiner characterized underwriting quality as loosening with moderate concentration concerns").
   c. **Blended interpretation layer:** How the public data and examiner inputs combine — the adjusted score, what it means for the institution's condition in this domain, and whether the overlay reinforced, tempered, or contradicted the proxy signal.

3. **For each non-overlaid domain** (excluding capital), write one paragraph:
   a. **Public data layer only:** Brief summary of the proxy findings for this domain. Note that no examiner overlay was applied.

4. **Capital paragraph** (public data layer only): Briefly note the capital score, PCA classification, and that capital is excluded from the examiner overlay in v1.

5. **Management paragraph:** If management was overlaid, write the three-paragraph pattern (public data / examiner overlay / blended interpretation) covering the overlay level change. If management was not overlaid, write a single public-data paragraph noting the baseline overlay level.

6. **Closing paragraph** (blended interpretation layer): Summarize the overall blended assessment — the adjusted band and score, how many domains were overlaid, the net direction of change, and the management overlay status. Restate that this is a blended public-data proxy with examiner overlay, not an official CAMELS rating.

### Section 7: Structured Worksheet

Output a fenced JSON code block containing the complete machine-readable worksheet. Use this exact schema with all fields populated from the workflow data:

```json
{
  "cert": 0,
  "repdte": "YYYYMMDD",
  "model": "fdic_examiner_overlay_v1",
  "official_status": "blended public-data proxy with examiner overlay, not official CAMELS",
  "analyst_confirmed": true,
  "proxy_baseline": {
    "overall_score": 0.00,
    "overall_band": "strong",
    "components": {
      "capital": {
        "score": 0.00,
        "label": "Strong"
      },
      "asset_quality": {
        "score": 0.00,
        "label": "Satisfactory"
      },
      "earnings": {
        "score": 0.00,
        "label": "Satisfactory"
      },
      "liquidity_funding": {
        "score": 0.00,
        "label": "Satisfactory"
      },
      "sensitivity_proxy": {
        "score": 0.00,
        "label": "Satisfactory"
      }
    },
    "management_overlay": {
      "level": "normal",
      "caps_band": false
    }
  },
  "overlaid_domains": [],
  "unselected_domains": [],
  "excluded_domains": ["capital"],
  "overlay_inputs": [
    {
      "domain": "domain_name",
      "direction": "downgrade",
      "confidence": "high",
      "evidence": "analyst basis statement",
      "source_date": "2024-11-15",
      "fields": {
        "field_name": {
          "response": "selected_option",
          "magnitude": 0.25,
          "severe_override": false
        }
      },
      "raw_magnitude": 0.00,
      "severe_overrides_triggered": [],
      "effect": "description of the adjustment or overlay change applied"
    }
  ],
  "adjustments": {
    "component_scores": {
      "capital": {
        "baseline": 0.00,
        "adjustment": 0.0,
        "adjusted": 0.00
      },
      "asset_quality": {
        "baseline": 0.00,
        "adjustment": 0.00,
        "adjusted": 0.00
      },
      "earnings": {
        "baseline": 0.00,
        "adjustment": 0.00,
        "adjusted": 0.00
      },
      "liquidity_funding": {
        "baseline": 0.00,
        "adjustment": 0.00,
        "adjusted": 0.00
      },
      "sensitivity_proxy": {
        "baseline": 0.00,
        "adjustment": 0.00,
        "adjusted": 0.00
      }
    },
    "management_overlay": {
      "baseline_level": "normal",
      "adjusted_level": "normal",
      "caps_band": false,
      "reason": "explanation of overlay level change or confirmation"
    },
    "overall": {
      "baseline_score": 0.00,
      "adjusted_score": 0.00,
      "baseline_band": "strong",
      "adjusted_band": "strong"
    }
  },
  "caveats": [
    "This assessment combines public FDIC data with examiner-provided qualitative inputs. It is not an official CAMELS rating.",
    "Public data findings and examiner overlay inputs are attributed separately and should not be cited as a single undifferentiated source."
  ]
}
```

**Schema rules:**
- `cert`: integer CERT number from the baseline
- `repdte`: string in YYYYMMDD format from the baseline
- `model`: always the string `"fdic_examiner_overlay_v1"`
- `official_status`: always the string `"blended public-data proxy with examiner overlay, not official CAMELS"`
- `analyst_confirmed`: boolean, true if analyst confirmed in Step 6, false if cancelled (though cancellation should not reach Step 7)
- `proxy_baseline.overall_score`: numeric overall score from the proxy baseline (2 decimal places)
- `proxy_baseline.overall_band`: string band label from the proxy baseline
- `proxy_baseline.components`: object with keys `capital`, `asset_quality`, `earnings`, `liquidity_funding`, `sensitivity_proxy`, each containing `score` (number) and `label` (string)
- `proxy_baseline.management_overlay.level`: string level from the proxy baseline (`normal`, `watch`, or `elevated_concern`)
- `proxy_baseline.management_overlay.caps_band`: boolean, true if the proxy baseline overlay capped the band
- `overlaid_domains`: array of strings — the domains the analyst selected for overlay
- `unselected_domains`: array of strings — v1 domains the analyst did not select
- `excluded_domains`: always `["capital"]` in v1
- `overlay_inputs`: array of objects, one per overlaid domain. Each object contains:
  - `domain`: string domain name
  - `direction`: string (`upgrade`, `downgrade`, or `confirm`)
  - `confidence`: string (`low`, `medium`, or `high`)
  - `evidence`: string, the analyst's basis statement
  - `source_date`: string date in YYYY-MM-DD format, or `null` if not provided
  - `fields`: object with one key per domain field. Each field contains:
    - `response`: string, the canonical response option selected
    - `magnitude`: number (0.00, 0.25, or 0.50)
    - `severe_override`: boolean, true only if this field+response triggers a severe override AND direction is downgrade
  - `raw_magnitude`: number, the mean of all field magnitudes for this domain
  - `severe_overrides_triggered`: array of strings, field names that triggered severe overrides (empty array if none)
  - `effect`: string description of the adjustment or overlay change (e.g., "adjustment -0.38 applied to asset quality score" or "overlay elevated from normal to watch")
- `adjustments.component_scores`: object with keys for all five components. Each contains:
  - `baseline`: number, the proxy baseline score
  - `adjustment`: number, the domain_adjustment applied (0.0 for non-overlaid domains and capital)
  - `adjusted`: number, the final adjusted score
- `adjustments.management_overlay`: object containing:
  - `baseline_level`: string, the proxy baseline overlay level
  - `adjusted_level`: string, the overlay level after examiner input
  - `caps_band`: boolean, true if adjusted_level is `elevated_concern`
  - `reason`: string explanation of the change
- `adjustments.overall`: object containing:
  - `baseline_score`: number, the proxy baseline overall score
  - `adjusted_score`: number, the recomputed overall score from Step 5c
  - `baseline_band`: string, the proxy baseline band
  - `adjusted_band`: string, the final band after score mapping and management overlay cap
- `caveats`: array of strings, all caveats from Section 5 (mandatory caveats first, then domain-specific, then data quality)

Populate every field with actual values from the workflow. Do not leave placeholder zeros or template strings in the final output. The JSON must be valid and parseable.

This appendix is the schema seed for the future Phase 2 MCP tool promotion.
