---
name: fdic-skill-builder
description: >
  Use when building or modifying an FDIC BankFind skill (`.agents/skills/*/SKILL.md`)
  that calls FDIC BankFind MCP tools. Enforces contract verification, FDIC
  date-basis rules, dependency-tier modeling, graceful degradation, and
  documentation alignment. Activate before designing any new skill or making
  structural changes to an existing one.
---

# FDIC Skill Builder

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not write skill content before completing Phase 1.

---

## Phase 1: Contract Verification

**Before writing a single line of skill content**, verify every tool the skill will call.

### 1a — Live tool probe

Call each tool in the planned chain with a known-good institution (e.g., CERT 57 — JPMorgan Chase Bank). Record the full response. Save it for the reference file (Phase 3c).

**Server fix required gate (hard dependencies):** If any **hard-dependency** tool returns a field validation error or an unexpected error response, **stop**. Fix the server bug before proceeding. Skill content written against a broken hard dependency is useless.

> Rule: A skill cannot describe a hard-dependency tool that the server cannot execute. Fix the server first, write the skill second.

For **soft and context** tools that are broken: you may continue drafting the skill, but all `structuredContent` paths for that tool must be marked `[source-derived]` in the reference file until a live response confirms them. Note the broken tool explicitly in the skill's dependency table and add a TODO to re-verify.

Field validation errors follow this pattern: `"Invalid field 'FIELDNAME' for endpoint ENDPOINT"`. When you see one:
1. Open `src/fdicEndpointMetadata.ts` and search for the endpoint section.
2. Verify the exact field name in the catalog. Names are case-sensitive.
3. Fix the field in the source file (`src/tools/shared/*.ts` or the tool file directly).
4. Run `npm run typecheck && npm test` to confirm no regressions.
5. Only then return to skill development.

### 1b — Field catalog cross-check

For every FDIC field string referenced in tool source files (`CERT,NAME,ASSET,...`), grep the catalog and confirm each field exists for its endpoint:

```
src/fdicEndpointMetadata.ts   — authoritative catalog
src/fdicSchema.ts             — validation layer (uses the catalog)
```

Common typo classes found in this codebase:
- `NAMHCR` → `NAMEHCR` (institutions endpoint, holding company name)
- `LNOTH` → not valid for the financials endpoint (was in `CREDIT_FIELDS` and `UBPR_FIELDS`)

---

## Phase 2: FDIC Data Rules

These rules govern how a skill must reason about FDIC data. Violating them produces silently wrong output.

### Date-basis rules

| Data source | Date field | Format | Cadence | How to derive |
|---|---|---|---|---|
| Financials / UBPR | `REPDTE` | `YYYYMMDD` | Quarterly | Pass `repdte` param or omit for latest |
| SOD (branch/deposit) | `YEAR` | `YYYY` | Annual (June 30) | Most recent year where June 30 ≤ analysis date |
| Institution profile | n/a | n/a | Current only | `fdic_get_institution` is **not date-scoped** — always returns the current record |

**Inactive institution `repdte` derivation:** The institution record contains a `REPDTE` field in `MM/DD/YYYY` format. Convert it to `YYYYMMDD` before passing to financial tools. Do not use today's date.

**Absolute date statements:** Any output that mixes data from different date bases (e.g., financials at Q3 2024 and SOD at 2023) must state the basis date for each section explicitly. Never write "as of the latest period" without specifying which period.

### Institution identity rules

**Ambiguous name resolution is unresolved until CERT is confirmed.** If a search returns multiple candidates, the institution is not yet identified. Do not pass names downstream — wait until the user has confirmed a specific CERT.

**Inactive institution handling:** Always check the `ACTIVE` field from `fdic_get_institution`. If `ACTIVE: 0`:
- Warn the user explicitly before proceeding.
- Derive the historical `repdte` from the institution's `REPDTE` field.
- SOD data may be absent for the last year — degrade gracefully.
- Do not treat absence of recent financial data as an error.

### Three outcome states

Distinguish these in skill output — they have different meanings and should never be collapsed:

| State | Meaning | Correct representation |
|---|---|---|
| **No data** | The API returned zero records for this metric | State explicitly: "No data available for [metric]" |
| **Not applicable** | The metric structurally does not apply (e.g., HC profile for an independent bank) | State explicitly: "Not applicable — [reason]" |
| **Tool failure** | The tool returned an error or timed out | State explicitly: "Tool error — [tool name]" and degrade per tier |

Never use "n/a" as a catch-all that merges all three states.

---

## Phase 3: Implementation Rules

### Dependency tier modeling

Every tool in a skill chain must be assigned a tier before the skill is written:

| Tier | Definition | On failure |
|---|---|---|
| **Hard** | Report cannot be produced without this data | Stop and report the error; do not produce partial output |
| **Soft** | Report degrades but remains useful | Omit the section; note the omission in the report |
| **Context** | Enriches the report; not load-bearing | Silently omit if unavailable |

Document the tier assignment in the skill's dependency table (or prose) so future editors know the intent.

### Three degradation states

A section in the output can be in one of three states. These map directly to the three outcome states in Phase 2 — do not collapse them:

1. **Full data** — all metrics present, normal rendering
2. **Structural immateriality** — some metrics are null because the institution does not engage in that activity (e.g., zero agricultural loans → ag share is not applicable). Render "Not applicable — [reason]". This is the *Not applicable* outcome state.
3. **No data** — the tool succeeded but returned zero records for this metric. Render "No data available for [metric]". This is the *No data* outcome state.
4. **Tool failure** — the tool returned an error or timed out. Render "Tool error — [tool name]" and apply the tier rule (hard: stop; soft: note omission; context: silently skip). This is the *Tool failure* outcome state.

### Output path fidelity

Skills that reference `structuredContent` paths must use exact, verified paths from live tool responses. Do not guess or derive paths from text output alone.

Rules:
- Capture one real response per tool before documenting any paths.
- Hard-dependency tools must be working before skill development proceeds (Phase 1 gate). Their paths must be `[live]` before the skill ships.
- Soft/context tools that are currently broken may use `[source-derived]` paths derived from TypeScript interfaces in `src/tools/*.ts`. Mark the tool as broken in the dependency table and add a TODO to re-capture once fixed.
- See `references/tool-output-shapes.md` for verified paths for all analysis and comparison tools.

### Skill-vs-server responsibility

Skills orchestrate; servers compute.

- Skills must not re-implement logic that belongs in a tool. If a skill needs a derived value (e.g., a loan ratio), it should call a tool that computes it — not derive it inline from raw FDIC fields.
- If a desired output cannot be produced by any existing tool, the correct fix is a new or modified server tool, not a workaround in the skill.
- Skills must not describe tool behavior they cannot observe. If you need a tool to return a new field, add it to the server first, verify it, then document it in the skill.

---

## Phase 4: Validation Sequence

Run in this exact order. Do not skip steps.

### 4a — Server fix gate (re-check)

Before running any tests, confirm that all tools in the skill chain return valid responses. If Phase 1 uncovered bugs and they were fixed, re-run the live probes now to confirm.

### 4b — Type check

```bash
npm run typecheck
```

Must pass clean. Fix all errors before proceeding.

### 4c — Test suite

```bash
npm test
```

All tests must pass. If a pre-existing failure exists, explicitly verify at execution time that it is unrelated to your changes (check the test name, file, and failure message against your diff). Do not carry forward a blanket waiver — re-confirm at each run.

### 4d — End-to-end smoke test

Invoke the skill with a known-good institution and a known-inactive institution. Verify:
- All sections render correctly for the active institution.
- The inactive institution path triggers the correct warning and historical date derivation.
- No section silently omits data that should be present.
- Each section's date basis is stated explicitly if the output is mixed-basis.

---

## Phase 5: Documentation Alignment

After the skill is working, update the docs to match.

### Checklist

- [ ] `docs/tool-reference.md` — add the skill to the Claude Code Skills table if it introduces a new skill; update any tool coverage claims that changed
- [ ] `docs/index.md` — update hero panel and "Browse by need" cards if a new skill was added
- [ ] `docs/prompting.md` — add a skill card if the skill warrants user discovery
- [ ] `docs/usage-examples.md` — add one representative example of the skill in use
- [ ] `docs/prompting-guide.md` — update any coverage claims if tool count changed
- [ ] Skill description in YAML frontmatter — must use third-person trigger language ("Use when the user asks to…", "Activate when…"), not first-person

### Accuracy rules for docs

- Field names must match the FDIC catalog exactly. Never use unofficial shorthand (`NAMHCR` for `NAMEHCR`).
- Output shape descriptions must match the current `structuredContent` shape, not the text rendering.
- Do not describe tool outputs you have not observed. If in doubt, call the tool and read the response.
- State SOD grouping accurately: deposits are grouped by MSA code (`MSA <code>`) or `Non-MSA / Rural`, not by MSA name.

---

## Reference Files

- `references/tool-output-shapes.md` — verified `structuredContent` paths for all analysis and comparison tools used in deep-dive style skills
