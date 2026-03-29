---
name: fdic-bank-deep-dive
description: >
  Comprehensive single-institution analysis report from public FDIC data.
  Produces a narrative covering health assessment, financial performance,
  peer benchmarking, credit concentration, funding profile, securities
  portfolio, franchise footprint, and economic context. Use when the user
  asks to "analyze a bank," "deep dive on an institution," "tell me
  everything about [bank name]," or needs counterparty due diligence,
  sponsor bank evaluation, board prep, or general bank research. Accepts
  a bank name or FDIC certificate number.
# NOTE: The MCP tool ID prefix (UUID) is session-specific and must be
# verified at runtime. The tools below follow the pattern:
# mcp__<server-uuid>__<tool_name>
allowed_tools: [
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_search_institutions",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_get_institution",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_bank_health",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_ubpr_analysis",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_peer_group_analysis",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_credit_concentration",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_funding_profile",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_securities_portfolio",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_franchise_footprint",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_regional_context"
]
---

# /fdic-bank-deep-dive

## Skill Type: RIGID

This workflow has a fixed section order, a fixed tool chain with a fixed dependency structure, and every section is always present in the output. Sections degrade gracefully when tools return partial data or fail — the report structure is never truncated.

You MUST follow every step in order. You MUST NOT skip sections. You MUST NOT proceed to the tool chain without a confirmed CERT and validated report date.

All data in this report comes from public FDIC data and, where available, FRED macroeconomic data. There is no per-paragraph provenance attribution — every data point is public. Disclaimers appear at the top and bottom of the report only.

---

## Step 1: Collect Input

Ask the user:

> "Which institution would you like to analyze? Provide a bank name or FDIC certificate number, and optionally a report date (YYYYMMDD)."

---

## Step 2: Resolve to CERT

You must resolve the user's input to a confirmed FDIC Certificate Number before proceeding.

### Path A — CERT provided directly

If the user provides a numeric CERT:

1. Call `fdic_get_institution` with the provided `cert`.
2. If found, present the identity confirmation:
   > "I found **[NAME]** (CERT [CERT]) in [CITY], [STATE] — $[ASSET]K in total assets. Is this the institution you mean?"
3. If the institution is inactive (ACTIVE: 0), add a warning:
   > "Note: This institution is inactive. Financial data will be historical. Do you want to proceed?"
4. Proceed only after the user confirms.
5. If the CERT is not found, stop: "No FDIC-insured institution found with CERT [number]. Please check the number and try again."

### Path B — Bank name provided

Use a tiered search strategy. Always confirm the final selection with the user.

**Tier 1 — Exact quoted search (active only):**

Call `fdic_search_institutions` with filter `NAME:"[user input]" AND ACTIVE:1`, limit 10.

If results are returned, move to **Candidate Ranking** below.

**Tier 2 — Loose token-based search (active only):**

If Tier 1 returned zero results, retry with a looser token-based name search, still filtered to `ACTIVE:1`. If the user included geographic hints (state names, city names, two-letter abbreviations), fold those into the filter using `STALP` or `STNAME` constraints. Limit 10.

If results are returned, move to **Candidate Ranking** below.

**Tier 3 — Inactive fallback:**

If Tiers 1 and 2 both returned zero results, retry the Tier 1 and Tier 2 searches without the `ACTIVE:1` filter. If inactive matches are found, present them with an explicit warning:

> "No active institutions matched '[input]'. I found inactive matches — financial data will be historical."

Move to **Candidate Ranking** below.

**Zero results after all tiers:**

Stop. Ask the user to refine their search or provide a CERT number directly:

> "No FDIC-insured institution found matching '[input]'. Please try a different name, add a state or city, or provide the CERT number directly."

### Candidate Ranking

When search results are returned, rank candidates by:
1. Exact name match (strongest signal)
2. Location consistency with any geographic hints the user provided
3. Asset size (tiebreaker only — not identity proof)

**Single candidate or clear top match — always confirm:**

> "I found **[NAME]** (CERT [CERT]) in [CITY], [STATE] — $[ASSET]K in total assets. Is this the institution you mean?"

**2-5 plausible candidates — present a disambiguation list:**

> "I found multiple matches for '[input]':
> 1. **[NAME]** (CERT [CERT]) — [CITY], [STATE] — $[ASSET]K
> 2. **[NAME]** (CERT [CERT]) — [CITY], [STATE] — $[ASSET]K
> ...
>
> Which institution would you like to analyze?"

**More than 5 matches:**

> "I found more than 5 matches for '[input]'. Please narrow your search by adding a state, city, or providing the CERT number directly."

### Stop Conditions

Do NOT proceed past this step unless:
- A specific institution has been identified and confirmed by the user
- If inactive, the user has explicitly confirmed they want to proceed with historical data

Store the confirmed `cert` for all subsequent tool calls.

---

## Step 3: Validate Report Date

If the user provided a report date (`repdte`), validate it before proceeding:

1. **Format check:** Must be exactly 8 digits in `YYYYMMDD` format.
2. **Quarter-end check:** The month/day portion must be one of: `0331`, `0630`, `0930`, `1231`.
3. **If invalid:** Suggest the most recent completed quarter-end *before* the given date.
   - To compute: find the quarter-end that is on or before the given date, but never a future quarter-end.
   - Example: `20250115` → suggest `20241231` (not `20250331`, which would be in the future relative to mid-January)
   - Example: `20250815` → suggest `20250630`
   - Present the suggestion:
     > "Report dates must be quarter-end dates (March 31, June 30, September 30, or December 31). Did you mean [YYYYMMDD]?"
   - Wait for confirmation before proceeding.

If the user did not provide a report date, omit `repdte` from all subsequent tool calls. The tools will default to the latest available quarter.

### SOD Year Derivation

For the franchise footprint section (Step 8 of the tool chain), derive the SOD year deterministically from the analysis date:

- Use the most recent SOD year where June 30 of that year does **not** exceed the confirmed analysis date.
- `repdte=20251231` → SOD year 2025 (June 30, 2025 ≤ Dec 31, 2025)
- `repdte=20250331` → SOD year 2024 (June 30, 2024 ≤ March 31, 2025; June 30, 2025 would exceed it)
- If `repdte` is omitted, omit the `year` argument from `fdic_franchise_footprint` and let the tool default to the most recent available SOD year.

Store the confirmed `repdte` (or null) and derived `sod_year` (or null) for all subsequent tool calls.

### Hard Boundary

**Do NOT proceed to Step 4 (tool chain) without:**
- A confirmed CERT (from Step 2)
- A validated `repdte` or explicit omission (from this step)
