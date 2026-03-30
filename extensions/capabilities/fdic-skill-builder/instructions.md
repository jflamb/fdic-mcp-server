# FDIC Skill Builder

## Skill Type: RIGID

Follow every phase in order. Do not skip phases. Do not write extension content before completing Phase 1.

## Phase 1: Contract Verification

**Before writing a single line of extension content**, verify every tool the extension will call.

### 1a — Live tool probe

Call each tool in the planned chain with a known-good institution (e.g., CERT 57 — JPMorgan Chase Bank). Record the full response.

**Server fix required gate (hard dependencies):** If any hard-dependency tool returns a field validation error, **stop**. Fix the server bug before proceeding.

For soft/context tools that are broken: continue drafting but mark paths as `[source-derived]` until live response confirms them.

### 1b — Field catalog cross-check

For every FDIC field string referenced, verify it exists in `src/fdicEndpointMetadata.ts`.

## Phase 2: FDIC Data Rules

Apply the shared FDIC date-basis rules, institution identity rules, and three outcome states. These are loaded from shared context files.

## Phase 3: Implementation Rules

### Dependency tier modeling

Every tool must be assigned Hard, Soft, or Context tier before the extension is written.

### Output path fidelity

Extensions referencing `structuredContent` paths must use verified paths from live tool responses.

### Skill-vs-server responsibility

Extensions orchestrate; servers compute. If a derived value is needed, call a tool that computes it.

## Phase 4: Validation Sequence

Run in order:

1. **Server fix gate:** Confirm all tools return valid responses.
2. **Type check:** `npm run typecheck` must pass clean.
3. **Test suite:** `npm test` must pass.
4. **End-to-end smoke test:** Invoke with known-good and known-inactive institutions.

## Phase 5: Documentation Alignment

Update docs to match the new extension. Verify field names match the FDIC catalog exactly.
