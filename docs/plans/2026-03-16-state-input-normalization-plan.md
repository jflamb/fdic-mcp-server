# State Input Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Both `fdic_compare_bank_snapshots` and `fdic_peer_group_analysis` accept state abbreviations or full names interchangeably, with clear error messages for invalid input.

**Architecture:** A shared `resolveState()` utility with a hardcoded bidirectional map (abbreviation ↔ full name) covering 50 states, DC, and FDIC territories. Both tools call it at handler entry and use the resolved form for their respective FDIC filter fields.

**Tech Stack:** TypeScript, Zod, vitest

---

### Task 1: Create stateUtils module with failing tests

**Files:**
- Create: `src/tools/shared/stateUtils.ts`
- Create: `tests/stateUtils.test.ts`

**Step 1: Write the failing tests**

Create `tests/stateUtils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveState, formatStateError } from "../src/tools/shared/stateUtils.js";

describe("resolveState", () => {
  it("resolves a full state name", () => {
    expect(resolveState("North Carolina")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("resolves a two-letter abbreviation", () => {
    expect(resolveState("NC")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("is case-insensitive for full names", () => {
    expect(resolveState("north carolina")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("is case-insensitive for abbreviations", () => {
    expect(resolveState("nc")).toEqual({ name: "North Carolina", code: "NC" });
  });

  it("resolves District of Columbia", () => {
    expect(resolveState("DC")).toEqual({ name: "District of Columbia", code: "DC" });
  });

  it("resolves a territory", () => {
    expect(resolveState("Puerto Rico")).toEqual({ name: "Puerto Rico", code: "PR" });
    expect(resolveState("PR")).toEqual({ name: "Puerto Rico", code: "PR" });
  });

  it("returns null for invalid input", () => {
    expect(resolveState("Narnia")).toBeNull();
    expect(resolveState("")).toBeNull();
    expect(resolveState("N")).toBeNull();
    expect(resolveState("ZZ")).toBeNull();
  });
});

describe("formatStateError", () => {
  it("returns a message listing both accepted formats", () => {
    const msg = formatStateError("Narnia");
    expect(msg).toContain("Narnia");
    expect(msg).toMatch(/abbreviation|full name/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stateUtils.test.ts`
Expected: FAIL — module does not exist yet.

**Step 3: Implement the stateUtils module**

Create `src/tools/shared/stateUtils.ts`:

```typescript
interface StateEntry {
  readonly name: string;
  readonly code: string;
}

const STATE_ENTRIES: readonly StateEntry[] = [
  { name: "Alabama", code: "AL" },
  { name: "Alaska", code: "AK" },
  { name: "Arizona", code: "AZ" },
  { name: "Arkansas", code: "AR" },
  { name: "California", code: "CA" },
  { name: "Colorado", code: "CO" },
  { name: "Connecticut", code: "CT" },
  { name: "Delaware", code: "DE" },
  { name: "Florida", code: "FL" },
  { name: "Georgia", code: "GA" },
  { name: "Hawaii", code: "HI" },
  { name: "Idaho", code: "ID" },
  { name: "Illinois", code: "IL" },
  { name: "Indiana", code: "IN" },
  { name: "Iowa", code: "IA" },
  { name: "Kansas", code: "KS" },
  { name: "Kentucky", code: "KY" },
  { name: "Louisiana", code: "LA" },
  { name: "Maine", code: "ME" },
  { name: "Maryland", code: "MD" },
  { name: "Massachusetts", code: "MA" },
  { name: "Michigan", code: "MI" },
  { name: "Minnesota", code: "MN" },
  { name: "Mississippi", code: "MS" },
  { name: "Missouri", code: "MO" },
  { name: "Montana", code: "MT" },
  { name: "Nebraska", code: "NE" },
  { name: "Nevada", code: "NV" },
  { name: "New Hampshire", code: "NH" },
  { name: "New Jersey", code: "NJ" },
  { name: "New Mexico", code: "NM" },
  { name: "New York", code: "NY" },
  { name: "North Carolina", code: "NC" },
  { name: "North Dakota", code: "ND" },
  { name: "Ohio", code: "OH" },
  { name: "Oklahoma", code: "OK" },
  { name: "Oregon", code: "OR" },
  { name: "Pennsylvania", code: "PA" },
  { name: "Rhode Island", code: "RI" },
  { name: "South Carolina", code: "SC" },
  { name: "South Dakota", code: "SD" },
  { name: "Tennessee", code: "TN" },
  { name: "Texas", code: "TX" },
  { name: "Utah", code: "UT" },
  { name: "Vermont", code: "VT" },
  { name: "Virginia", code: "VA" },
  { name: "Washington", code: "WA" },
  { name: "West Virginia", code: "WV" },
  { name: "Wisconsin", code: "WI" },
  { name: "Wyoming", code: "WY" },
  { name: "District of Columbia", code: "DC" },
  { name: "Puerto Rico", code: "PR" },
  { name: "Guam", code: "GU" },
  { name: "American Samoa", code: "AS" },
  { name: "Virgin Islands", code: "VI" },
  { name: "Northern Mariana Islands", code: "MP" },
];

const byName = new Map<string, StateEntry>(
  STATE_ENTRIES.map((e) => [e.name.toLowerCase(), e]),
);

const byCode = new Map<string, StateEntry>(
  STATE_ENTRIES.map((e) => [e.code.toLowerCase(), e]),
);

export function resolveState(input: string): StateEntry | null {
  const key = input.trim().toLowerCase();
  return byName.get(key) ?? byCode.get(key) ?? null;
}

export function formatStateError(input: string): string {
  return `Unknown state "${input}". Provide a full state name (e.g., "North Carolina") or two-letter abbreviation (e.g., "NC").`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stateUtils.test.ts`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/tools/shared/stateUtils.ts tests/stateUtils.test.ts
git commit -m "feat: add shared state resolution utility"
```

---

### Task 2: Update fdic_compare_bank_snapshots to use resolveState

**Files:**
- Modify: `src/tools/analysis.ts:42-47` (schema description)
- Modify: `src/tools/analysis.ts:100-112` (validation function)
- Modify: `src/tools/analysis.ts:630-660` (fetchInstitutionRoster — change parameter type)

**Step 1: Write a failing test**

Add a test to `tests/mcp-http.test.ts` in the snapshot analysis describe block that passes a state abbreviation instead of a full name and expects the roster query to use `STNAME:"North Carolina"`:

```typescript
it("resolves state abbreviation to full name for roster filter", async () => {
  // ... mock setup similar to existing snapshot tests but passing state: "NC"
  // ... assert the institutions query uses filters: 'STNAME:"North Carolina" AND ACTIVE:1'
});
```

The exact mock setup should follow the pattern of the existing snapshot analysis tests in the file (around line 1663+). Also add a test for invalid state input returning an error.

**Step 2: Run to verify failure**

Run: `npx vitest run tests/mcp-http.test.ts -t "resolves state abbreviation"`
Expected: FAIL — current code passes `"NC"` as-is to `STNAME:"NC"`.

**Step 3: Implement changes in analysis.ts**

1. Update the schema description at line 42-47:
```typescript
state: z
  .string()
  .optional()
  .describe(
    'State for the institution roster filter. Accepts a full name (e.g., "North Carolina") or two-letter abbreviation (e.g., "NC").',
  ),
```

2. Update `validateSnapshotAnalysisParams` at line 100-112 to resolve the state:
```typescript
import { resolveState, formatStateError } from "./shared/stateUtils.js";

function validateSnapshotAnalysisParams(
  value: SnapshotAnalysisParams,
): string | null {
  if (!value.state && (!value.certs || value.certs.length === 0)) {
    return "Provide either state or certs.";
  }

  if (value.state && !resolveState(value.state)) {
    return formatStateError(value.state);
  }

  if (value.start_repdte >= value.end_repdte) {
    return "start_repdte must be earlier than end_repdte.";
  }

  return null;
}
```

3. In the handler (around line 937), resolve the state before passing to `fetchInstitutionRoster`:
```typescript
const resolvedState = state ? resolveState(state) : null;
// ...then pass resolvedState?.name to fetchInstitutionRoster
```

4. Update `fetchInstitutionRoster` to accept the already-resolved name (no behavior change in the function itself — it already builds `STNAME:"${state}"`).

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mcp-http.test.ts`
Expected: All PASS (including existing tests that pass `"North Carolina"` — those should continue working).

**Step 5: Commit**

```bash
git add src/tools/analysis.ts tests/mcp-http.test.ts
git commit -m "feat: accept state abbreviations in compare_bank_snapshots"
```

---

### Task 3: Update fdic_peer_group_analysis to use resolveState

**Files:**
- Modify: `src/tools/peerGroup.ts:193-197` (schema — remove regex, update description)
- Modify: `src/tools/peerGroup.ts:508,532` (handler — resolve state, use code for STALP filter)
- Modify: `tests/peerGroup.test.ts:208-222` (update validation tests)

**Step 1: Write a failing test**

Update the test at `tests/peerGroup.test.ts:208-214` — "rejects invalid state codes" currently asserts that `"North Carolina"` is rejected. Change it to verify that `"North Carolina"` is accepted and also add a test that an invalid state like `"Narnia"` produces an error.

In `tests/mcp-http.test.ts`, add a peer group test that passes `state: "North Carolina"` and asserts:
- the roster query uses `STALP:NC`
- `criteria_used.state` is `"NC"`

**Step 2: Run to verify failure**

Run: `npx vitest run tests/peerGroup.test.ts tests/mcp-http.test.ts -t "North Carolina"`
Expected: FAIL — regex rejects full names, handler doesn't resolve.

**Step 3: Implement changes in peerGroup.ts**

1. Update the schema at line 193-197:
```typescript
state: z
  .string()
  .optional()
  .describe('State filter. Accepts a full name (e.g., "North Carolina") or two-letter abbreviation (e.g., "NC").'),
```

2. In the handler (around line 508), resolve the state before building filters:
```typescript
import { resolveState, formatStateError } from "./shared/stateUtils.js";

// Early in handler, after params are extracted:
const resolvedState = state ? resolveState(state) : null;
if (state && !resolvedState) {
  return formatToolError(new Error(formatStateError(state)));
}
```

3. Update filter construction at line 532:
```typescript
if (resolvedState) filterParts.push(`STALP:${resolvedState.code}`);
```

4. Update `criteriaUsed` at line 569 to use the resolved code:
```typescript
state: resolvedState?.code ?? null,
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/peerGroup.test.ts tests/mcp-http.test.ts`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/tools/peerGroup.ts tests/peerGroup.test.ts tests/mcp-http.test.ts
git commit -m "feat: accept full state names in peer_group_analysis"
```

---

### Task 4: Validate and final commit

**Step 1: Run full validation suite**

```bash
npm run typecheck
npm test
npm run build
```

Expected: All pass with no errors.

**Step 2: Fix any snapshot or type errors**

If `mcp-http.test.ts` snapshots need updating (e.g., schema description changes in tool listing tests), update them.

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "test: update snapshots for state input normalization"
```

Only if there are snapshot/test fixes from Step 2. Skip if Step 1 was clean.
