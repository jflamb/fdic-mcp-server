# FDIC Examiner Overlay Skill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code skill (`/fdic-examiner-overlay`) that guides an examiner through layering qualitative knowledge onto a `public_camels_proxy_v1` baseline, producing a blended assessment with explicit provenance.

**Architecture:** A single Claude Code command file (`.claude/commands/fdic-examiner-overlay.md`) containing the full prompt-driven workflow. The skill calls the existing `fdic_analyze_bank_health` MCP tool, collects structured analyst inputs conversationally, computes bounded score adjustments inline, and produces a seven-section output (six human-readable + one machine-readable appendix). No new TypeScript modules — all logic lives in the skill prompt.

**Tech Stack:** Claude Code command (Markdown with YAML front matter), MCP tool calls via `fdic_analyze_bank_health`

**Design doc:** `docs/plans/2026-03-27-fdic-examiner-overlay-design.md`

---

### Task 1: Create the skill command file with front matter and workflow skeleton

**Files:**
- Create: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Create the command file with YAML front matter and section stubs**

```markdown
---
name: fdic-examiner-overlay
description: Guided examiner workflow that layers qualitative analyst knowledge onto a public_camels_proxy_v1 baseline. Produces a blended assessment with explicit provenance separating public-data findings from examiner overlay inputs. Use when the analyst wants to enrich a bank health assessment with examination-grade qualitative context.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob", "Agent", "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_bank_health"]
---

# /fdic-examiner-overlay

## Skill Type: RIGID

This workflow is non-negotiable in structure. You MUST follow every step in order.
You MUST NOT skip the confirmation gate. You MUST NOT merge provenance layers in the narrative.

## Step 1: Fetch Baseline

[stub — implemented in Task 2]

## Step 2: Present Baseline Summary

[stub — implemented in Task 2]

## Step 3: Domain Selection

[stub — implemented in Task 3]

## Step 4: Structured Input Collection

[stub — implemented in Task 4]

## Step 5: Compute Overlay Adjustments

[stub — implemented in Task 5]

## Step 6: Analyst Confirmation Gate

[stub — implemented in Task 6]

## Step 7: Produce Blended Output

[stub — implemented in Task 7]
```

**Step 2: Verify the file is loadable**

Run: `cat .claude/commands/fdic-examiner-overlay.md | head -5`
Expected: YAML front matter with `name: fdic-examiner-overlay`

**Step 3: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: scaffold fdic-examiner-overlay skill command"
```

---

### Task 2: Implement Step 1 (Fetch Baseline) and Step 2 (Present Baseline Summary)

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Replace the Step 1 stub with the baseline fetch instructions**

Replace `[stub — implemented in Task 2]` under Step 1 with:

```markdown
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
```

**Step 2: Replace the Step 2 stub with the baseline presentation format**

Replace `[stub — implemented in Task 2]` under Step 2 with:

```markdown
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
```

**Step 3: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: implement baseline fetch and presentation in examiner overlay skill"
```

---

### Task 3: Implement Step 3 (Domain Selection)

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Replace the Step 3 stub**

```markdown
## Step 3: Domain Selection

The analyst selects which domains to overlay. Valid v1 domains:
- `management`
- `asset_quality`
- `earnings`
- `liquidity_funding`
- `sensitivity`

**Capital is excluded in v1.** If the analyst asks to overlay capital, explain: "Capital is excluded from the examiner overlay in v1. It is already well-covered by PCA thresholds, and qualitative capital overlay risks overstating supervisory certainty."

**Rules:**
- Multiple domains may be selected.
- If the analyst selects zero domains, end the workflow: "No overlay domains selected. The public-data baseline stands as-is."
- Record `overlaid_domains` and `unselected_domains` for the audit trail.
- `excluded_domains` is always `["capital"]` in v1.

Proceed to Step 4 for the first selected domain.
```

**Step 2: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: implement domain selection in examiner overlay skill"
```

---

### Task 4: Implement Step 4 (Structured Input Collection)

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Replace the Step 4 stub with the full domain prompt tables and collection rules**

```markdown
## Step 4: Structured Input Collection

For each selected domain, collect inputs in this order:

### 4a. Ask for direction, confidence, and evidence

> "For **[domain_name]**, would you like to **upgrade**, **downgrade**, or **confirm** the proxy assessment?"

Then:
> "What is your confidence level? **low**, **medium**, or **high**?"

Then:
> "What is the evidence basis for this overlay? (Required — provide a short statement of the factual basis.)"

For `upgrade` direction: if the evidence is vague or lacks concrete factors, prompt once more: "Can you tie this to specific observable factors (e.g., recent exam findings, board actions, documented improvements)?"

Then (optional):
> "When was this information current? (date, or skip)"

### 4b. Ask domain-specific field questions

Present each field question in order. The analyst responds with one of the listed options.

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

**Note:** `classified_asset_trend` reflects confidential supervisory information. Flag this in the caveats.

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

After collecting all field responses for a domain, map each response to a magnitude using these per-field tables:

**Magnitude tiers:**
- **0.00** = no adjustment basis (first option in each field)
- **0.25** = moderate basis (second option)
- **0.50** = strong basis (third option)

For fields with a fourth option (e.g., `not_applicable`): treat `not_applicable` as 0.00.

### 4d. Record the normalized worksheet

For each domain, record:
```json
{
  "domain": "[domain_name]",
  "direction": "[upgrade|downgrade|confirm]",
  "confidence": "[low|medium|high]",
  "evidence": "[analyst statement]",
  "source_date": "[date or null]",
  "fields": {
    "[field_name]": {
      "response": "[selected option]",
      "magnitude": [0.00|0.25|0.50],
      "severe_override": [true|false]
    }
  }
}
```

**Severe override fields** (set `severe_override: true` when these responses are selected AND direction is `downgrade`):
- `supervisory_issues_history`: `enforcement_action`
- `internal_controls`: `deficient`
- `contingency_funding`: `absent`
- `irr_model_results`: `exceeding_limits`
- `allowance_adequacy`: `inadequate`

Repeat Step 4 for each selected domain, then proceed to Step 5.
```

**Step 2: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: implement structured input collection with domain field tables"
```

---

### Task 5: Implement Step 5 (Compute Overlay Adjustments)

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Replace the Step 5 stub with the adjustment computation rules**

```markdown
## Step 5: Compute Overlay Adjustments

### 5a. Non-management domains

For each non-management overlaid domain, compute the adjustment:

```
1. Collect all field magnitudes for the domain: [m1, m2, ..., mn]

2. Compute raw_adjustment:
   - If direction is "confirm": raw_adjustment = 0.0
   - If direction is "upgrade": raw_adjustment = +mean(magnitudes)
   - If direction is "downgrade": raw_adjustment = -mean(magnitudes)

3. Apply severe override floor (downgrade only):
   - If direction is "downgrade" AND any field has severe_override = true:
     raw_adjustment = min(raw_adjustment, -0.50)
     (ensures adjustment is at least -0.50)

4. Apply confidence cap:
   - low:    clamp to [-0.50, +0.50]
   - medium: clamp to [-0.75, +0.75]
   - high:   clamp to [-1.00, +1.00]
   Result is the domain_adjustment.

5. Compute adjusted component score:
   adjusted = clamp(baseline_score + domain_adjustment, 1.0, 4.0)
```

### 5b. Management domain

Management does NOT adjust a component score. It adjusts the management overlay state.

```
1. Collect all field magnitudes: [m1, m2, ..., m6]
2. Compute raw_magnitude = mean(magnitudes)

3. If direction is "confirm":
   - No change. Overlay stays at baseline level.

4. If direction is "downgrade":
   - If raw_magnitude >= 0.25: elevate overlay by ONE level
     (normal → watch, watch → elevated_concern)
   - Two-level escalation (normal → elevated_concern) ONLY IF:
     confidence is "high" AND at least one severe override fired
     (enforcement_action or deficient internal_controls)
   - If proxy already at elevated_concern: reinforce (no double-cap),
     note in narrative

5. If direction is "upgrade":
   - May de-escalate overlay by one level ONLY IF:
     - Proxy overlay was "watch" or "elevated_concern"
     - AND confidence is "high"
     - AND evidence is tied to concrete factors
     - AND no severe override fields triggered
   - Cannot reduce below "normal"
   - If proxy was already "normal": no effect
```

### 5c. Recompute overall score

```
1. Use adjusted component scores (or baseline if not overlaid):
   C = capital baseline score (always unchanged in v1)
   A = asset_quality adjusted score
   E = earnings adjusted score
   L = liquidity_funding adjusted score
   S = sensitivity adjusted score

2. adjusted_overall = C*0.30 + A*0.25 + E*0.20 + L*0.15 + S*0.10

3. Map to band:
   >= 3.25 → strong
   >= 2.50 → satisfactory
   >= 1.75 → weak
   else    → high_risk

4. If management overlay is "elevated_concern":
   Demote band by one level (strong→satisfactory, etc.)
```

Record all computations for the structured appendix.
```

**Step 2: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: implement overlay adjustment computation rules"
```

---

### Task 6: Implement Step 6 (Analyst Confirmation Gate)

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Replace the Step 6 stub**

```markdown
## Step 6: Analyst Confirmation Gate

Before generating the final output, present a compact adjustment summary:

---

### Proposed Adjustments

| Domain | Baseline | Direction | Raw Adj | Severe | Conf Cap | Final Adj | Adjusted |
|--------|----------|-----------|---------|--------|----------|-----------|----------|
| [domain] | [score] | [dir] | [raw] | [Y/N] | [cap] | [final] | [new score] |

**Management overlay:** [baseline_level] → [adjusted_level] ([reason])

**Overall:** [baseline_band] ([baseline_score]) → [adjusted_band] ([adjusted_score])

---

Then ask:
> "Confirm these adjustments, or would you like to revise any domain?"

- If the analyst says **confirm**: record `analyst_confirmed: true` and proceed to Step 7.
- If the analyst wants to **revise**: ask which domain, return to Step 4 for that domain, then recompute Step 5 and re-present Step 6.
- If the analyst wants to **cancel**: end the workflow without producing output.
```

**Step 2: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: implement analyst confirmation gate"
```

---

### Task 7: Implement Step 7 (Produce Blended Output)

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md`

**Step 1: Replace the Step 7 stub with the full seven-section output template**

```markdown
## Step 7: Produce Blended Output

Generate the following seven sections. Do NOT deviate from this structure.

### Section 1: Public Proxy Baseline

Reproduce the baseline summary from Step 2 exactly as shown, with the source attribution line.

### Section 2: Examiner Overlay Inputs

```
Domains overlaid: [list]
Domains unchanged: [list]
Excluded (v1): capital
```

For each overlaid domain:
```
### [Domain Name]
Direction: [upgrade|downgrade|confirm]
Confidence: [low|medium|high]
Evidence: [basis statement]
Source date: [date or "not specified"]

  [field_name]: [response] (magnitude: [value])
  [field_name]: [response] (magnitude: [value])
  ...
```

### Section 3: Overlay Adjustments

| Domain | Baseline | Raw Adj | Severe Floor | Conf Cap | Final Adj | Adjusted |
|--------|----------|---------|--------------|----------|-----------|----------|
| [each domain row] |

Management overlay: [baseline_level] → [adjusted_level]
Conflicts: [any, or "none"]

### Section 4: Blended Assessment

```
Overall: [adjusted_band] ([adjusted_score]/4.0)
  Capital:           [score] - [label]
  Asset Quality:     [score] - [label]  [← examiner overlay, if adjusted]
  Earnings:          [score] - [label]  [← examiner overlay, if adjusted]
  Liquidity/Funding: [score] - [label]  [← examiner overlay, if adjusted]
  Sensitivity Proxy: [score] - [label]  [← examiner overlay, if adjusted]

Management Overlay: [adjusted_level]
Change from baseline: [band unchanged | band moved from X to Y]
```

### Section 5: Caveats

Always include these mandatory caveats:
1. "This assessment combines public FDIC data with examiner-provided qualitative inputs. It is not an official CAMELS rating."
2. "Public data findings and examiner overlay inputs are attributed separately throughout this document and should not be cited as a single undifferentiated source."

Add domain-specific caveats:
- If `classified_asset_trend` was used: "The classified asset trend input reflects confidential supervisory information not available from public data."
- If any `source_date` is older than 6 months from the report date: "Some examiner inputs reference information that may be dated relative to the financial reporting period."
- Include any data quality flags from the proxy baseline.

### Section 6: Exam Narrative

**HARD RULE:** Every paragraph must be attributed to exactly one of three layers:
- **"Public data indicate..."** — findings from the proxy baseline only
- **"Examiner overlay:"** — analyst-provided qualitative inputs only
- **"Blended interpretation:"** — combined assessment drawing on both

These three layers MUST NEVER be merged into undifferentiated prose.

Structure:
1. Opening paragraph: institution context and overall baseline (public data layer)
2. For each overlaid domain:
   a. What the proxy shows (public data layer)
   b. What the examiner adds (examiner overlay layer)
   c. How they combine (blended interpretation layer)
3. For non-overlaid domains: brief summary from proxy (public data layer only)
4. Closing paragraph: overall blended assessment with explicit provenance

### Section 7: Structured Worksheet

Output a JSON code block with the full machine-readable worksheet. Use this exact schema:

```json
{
  "cert": [number],
  "repdte": "[YYYYMMDD]",
  "model": "fdic_examiner_overlay_v1",
  "official_status": "blended public-data proxy with examiner overlay, not official CAMELS",
  "analyst_confirmed": [true|false],
  "proxy_baseline": {
    "overall_score": [number],
    "overall_band": "[band]",
    "components": {
      "capital": { "score": [n], "label": "[label]" },
      "asset_quality": { "score": [n], "label": "[label]" },
      "earnings": { "score": [n], "label": "[label]" },
      "liquidity_funding": { "score": [n], "label": "[label]" },
      "sensitivity_proxy": { "score": [n], "label": "[label]" }
    },
    "management_overlay": { "level": "[level]", "caps_band": [bool] }
  },
  "overlaid_domains": ["[domain]", ...],
  "unselected_domains": ["[domain]", ...],
  "excluded_domains": ["capital"],
  "overlay_inputs": [
    {
      "domain": "[domain]",
      "direction": "[direction]",
      "confidence": "[confidence]",
      "evidence": "[text]",
      "source_date": "[date or null]",
      "fields": {
        "[field_name]": {
          "response": "[option]",
          "magnitude": [0.00|0.25|0.50],
          "severe_override": [bool]
        }
      },
      "raw_magnitude": [number],
      "severe_overrides_triggered": ["[field_name]", ...],
      "effect": "[description of adjustment or overlay change]"
    }
  ],
  "adjustments": {
    "component_scores": {
      "capital": { "baseline": [n], "adjustment": 0.0, "adjusted": [n] },
      "[domain]": { "baseline": [n], "adjustment": [n], "adjusted": [n] }
    },
    "management_overlay": {
      "baseline_level": "[level]",
      "adjusted_level": "[level]",
      "caps_band": [bool],
      "reason": "[explanation]"
    },
    "overall": {
      "baseline_score": [n],
      "adjusted_score": [n],
      "baseline_band": "[band]",
      "adjusted_band": "[band]"
    }
  },
  "caveats": ["[caveat text]", ...]
}
```

This appendix is the schema seed for the future Phase 2 MCP tool.
```

**Step 2: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "feat: implement blended output generation with seven-section template"
```

---

### Task 8: Add the MCP tool ID to allowed_tools

**Files:**
- Modify: `.claude/commands/fdic-examiner-overlay.md` (front matter only)

**Step 1: Verify the MCP tool ID for fdic_analyze_bank_health**

Run: `grep -r "fdic_analyze_bank_health" .claude/ src/tools/bankHealth.ts | head -5`

The tool ID in the MCP server context follows the pattern `mcp__<server-id>__fdic_analyze_bank_health`. Check the current session's available tools for the exact server ID prefix.

**Step 2: Update the `allowed_tools` in the YAML front matter**

Ensure the front matter includes all tools the skill needs:
- `Read`, `Write`, `Glob`, `Grep` — for file operations if needed
- `Bash` — for any shell commands
- The MCP tool for `fdic_analyze_bank_health` — use the wildcard pattern if the server ID varies

**Step 3: Commit**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "fix: ensure correct MCP tool ID in examiner overlay allowed_tools"
```

---

### Task 9: Manual smoke test

**Step 1: Invoke the skill**

In a Claude Code session with the MCP server running, type `/fdic-examiner-overlay`.

**Step 2: Walk through the workflow**

- Provide a known CERT (e.g., a large well-known bank)
- Verify the baseline summary renders correctly
- Select at least two domains (management + one other)
- Provide sample analyst inputs
- Verify the confirmation gate shows correct adjustments
- Verify all seven output sections render
- Verify the JSON appendix is valid JSON

**Step 3: Verify edge cases**

- Select zero domains → should end gracefully
- Select a domain and choose `confirm` → should produce no adjustment
- Try to select `capital` → should be rejected with explanation
- Provide vague upgrade evidence → should be re-prompted

**Step 4: Commit any fixes found during smoke testing**

```bash
git add .claude/commands/fdic-examiner-overlay.md
git commit -m "fix: address issues found during examiner overlay smoke test"
```

---

### Task 10: Push to GitHub

**Step 1: Push main**

```bash
git push origin main
```
