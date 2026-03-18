# State Input Normalization

**Date**: 2026-03-16
**Status**: Approved

## Problem

`fdic_compare_bank_snapshots` accepts only full state names (e.g., "North Carolina") via `STNAME`, while `fdic_peer_group_analysis` accepts only 2-letter codes (e.g., "NC") via `STALP`. When an LLM passes the wrong format, the tool silently returns zero results instead of a helpful error. This was observed in production when Claude Desktop failed to get results for an NC bank comparison.

## Solution

A shared state lookup utility that lets both tools accept either format.

### New Module: `src/tools/shared/stateUtils.ts`

A bidirectional lookup covering all 50 US states, DC, and FDIC-relevant territories (PR, GU, AS, VI, MP).

Exports:
- `resolveState(input: string): { name: string; code: string } | null` — case-insensitive exact match by abbreviation or full name. Returns `null` on no match.
- `formatStateError(input: string): string` — human-readable error message for invalid input.

Implementation: a `readonly` array of `{name, code}` tuples with two derived `Map` objects (lowercased name → entry, lowercased code → entry) built at module load.

### Tool Changes

**`fdic_compare_bank_snapshots` (analysis.ts)**
- Replace freeform `state` string with one described as accepting either format.
- Call `resolveState(state)` at handler entry; return `formatStateError(state)` on `null`.
- Roster filter remains `STNAME:"${resolved.name}"`.

**`fdic_peer_group_analysis` (peerGroup.ts)**
- Remove `regex(/^[A-Z]{2}$/)` from the `state` schema.
- Update description to accept either format.
- Call `resolveState(state)` at handler entry; return `formatStateError(state)` on `null`.
- Roster filter remains `STALP:${resolved.code}`.

### Testing

**New: `tests/stateUtils.test.ts`**
- Full name → `{name, code}`
- Abbreviation → same result
- Case-insensitive variants
- `null` for invalid input
- DC and territory coverage
- `formatStateError` returns useful message

**Updates to existing tests:**
- `tests/peerGroup.test.ts` — tests asserting regex rejection of full names need updating (now valid input).
- `tests/mcp-http.test.ts` — snapshot updates if schema descriptions changed.
