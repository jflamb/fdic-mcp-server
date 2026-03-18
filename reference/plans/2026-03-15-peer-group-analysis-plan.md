# Peer Group Analysis Tool — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `fdic_peer_group_analysis` tool that builds a peer group for a bank and ranks it against peers on financial and efficiency metrics at a single report date.

**Architecture:** Single new tool module (`src/tools/peerGroup.ts`) following the existing pattern of `analysis.ts`. Pure computation functions are exported for unit testing. The tool registers via `registerPeerGroupTools()` called from `src/index.ts`. Reuses existing `fdicClient.ts` infrastructure (queryEndpoint, batched chunking, caching, timeout pattern).

**Tech Stack:** TypeScript, Zod (input validation), vitest (testing), existing MCP SDK registration pattern.

**Design doc:** `reference/plans/2026-03-15-peer-group-analysis-design.md`

---

### Task 1: Pure computation functions — deriveMetrics and computeMedian

**Files:**
- Create: `src/tools/peerGroup.ts`
- Create: `tests/peerGroup.test.ts`

**Step 1: Write the failing tests**

In `tests/peerGroup.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  deriveMetrics,
  computeMedian,
} from "../src/tools/peerGroup.js";

describe("deriveMetrics", () => {
  it("computes all derived metrics from raw financial fields", () => {
    const result = deriveMetrics({
      ASSET: 1000,
      DEP: 800,
      ROA: 1.5,
      ROE: 12.0,
      NETNIM: 3.5,
      EQTOT: 100,
      LNLSNET: 600,
      INTINC: 50,
      EINTEXP: 15,
      NONII: 10,
      NONIX: 25,
    });

    expect(result.asset).toBe(1000);
    expect(result.dep).toBe(800);
    expect(result.roa).toBe(1.5);
    expect(result.roe).toBe(12.0);
    expect(result.netnim).toBe(3.5);
    expect(result.equity_ratio).toBeCloseTo(10.0);
    expect(result.efficiency_ratio).toBeCloseTo(55.556, 2);
    expect(result.loan_to_deposit).toBeCloseTo(0.75);
    expect(result.deposits_to_assets).toBeCloseTo(0.8);
    expect(result.noninterest_income_share).toBeCloseTo(0.2222, 3);
  });

  it("returns null for equity_ratio when ASSET is zero", () => {
    const result = deriveMetrics({
      ASSET: 0, DEP: 800, ROA: 1, ROE: 8, NETNIM: 3,
      EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25,
    });
    expect(result.equity_ratio).toBeNull();
    expect(result.deposits_to_assets).toBeNull();
  });

  it("returns null for efficiency_ratio when denominator is zero or negative", () => {
    const result = deriveMetrics({
      ASSET: 1000, DEP: 800, ROA: 1, ROE: 8, NETNIM: 3,
      EQTOT: 100, LNLSNET: 600, INTINC: 10, EINTEXP: 15, NONII: 5, NONIX: 25,
    });
    // net_interest_income = 10 - 15 = -5, denominator = -5 + 5 = 0
    expect(result.efficiency_ratio).toBeNull();
    expect(result.noninterest_income_share).toBeNull();
  });

  it("returns null for loan_to_deposit when DEP is zero", () => {
    const result = deriveMetrics({
      ASSET: 1000, DEP: 0, ROA: 1, ROE: 8, NETNIM: 3,
      EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25,
    });
    expect(result.loan_to_deposit).toBeNull();
  });

  it("handles null input fields gracefully", () => {
    const result = deriveMetrics({
      ASSET: null, DEP: null, ROA: null, ROE: null, NETNIM: null,
      EQTOT: null, LNLSNET: null, INTINC: null, EINTEXP: null, NONII: null, NONIX: null,
    });
    expect(result.asset).toBeNull();
    expect(result.equity_ratio).toBeNull();
    expect(result.efficiency_ratio).toBeNull();
  });
});

describe("computeMedian", () => {
  it("returns the middle value for an odd-length array", () => {
    expect(computeMedian([1, 3, 5])).toBe(3);
  });

  it("returns the average of middle values for an even-length array", () => {
    expect(computeMedian([1, 3, 5, 7])).toBe(4);
  });

  it("returns the single value for a one-element array", () => {
    expect(computeMedian([42])).toBe(42);
  });

  it("returns null for an empty array", () => {
    expect(computeMedian([])).toBeNull();
  });

  it("does not modify the input array", () => {
    const input = [5, 1, 3];
    computeMedian(input);
    expect(input).toEqual([5, 1, 3]);
  });
});
```

**Step 2: Create the source file with minimal exports to make tests pass**

In `src/tools/peerGroup.ts`:

```typescript
type RawFinancials = Record<string, unknown>;

export interface DerivedMetrics {
  asset: number | null;
  dep: number | null;
  roa: number | null;
  roe: number | null;
  netnim: number | null;
  equity_ratio: number | null;
  efficiency_ratio: number | null;
  loan_to_deposit: number | null;
  deposits_to_assets: number | null;
  noninterest_income_share: number | null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function safeRatio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function safeRatioPositiveDenom(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator <= 0
  ) {
    return null;
  }
  return numerator / denominator;
}

export function deriveMetrics(raw: RawFinancials): DerivedMetrics {
  const asset = asNumber(raw.ASSET);
  const dep = asNumber(raw.DEP);
  const eqtot = asNumber(raw.EQTOT);
  const lnlsnet = asNumber(raw.LNLSNET);
  const intinc = asNumber(raw.INTINC);
  const eintexp = asNumber(raw.EINTEXP);
  const nonii = asNumber(raw.NONII);
  const nonix = asNumber(raw.NONIX);

  const netInterestIncome =
    intinc !== null && eintexp !== null ? intinc - eintexp : null;
  const revenueDenominator =
    netInterestIncome !== null && nonii !== null
      ? netInterestIncome + nonii
      : null;

  return {
    asset,
    dep,
    roa: asNumber(raw.ROA),
    roe: asNumber(raw.ROE),
    netnim: asNumber(raw.NETNIM),
    equity_ratio:
      safeRatio(eqtot, asset) !== null
        ? safeRatio(eqtot, asset)! * 100
        : null,
    efficiency_ratio:
      safeRatioPositiveDenom(nonix, revenueDenominator) !== null
        ? safeRatioPositiveDenom(nonix, revenueDenominator)! * 100
        : null,
    loan_to_deposit: safeRatio(lnlsnet, dep),
    deposits_to_assets: safeRatio(dep, asset),
    noninterest_income_share: safeRatioPositiveDenom(nonii, revenueDenominator),
  };
}

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
```

**Step 3: Run the tests**

Run: `npx vitest run tests/peerGroup.test.ts`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/tools/peerGroup.ts tests/peerGroup.test.ts
git commit -m "feat: add deriveMetrics and computeMedian for peer group analysis"
```

---

### Task 2: Competition ranking function

**Files:**
- Modify: `src/tools/peerGroup.ts`
- Modify: `tests/peerGroup.test.ts`

**Step 1: Write the failing tests**

Append to `tests/peerGroup.test.ts`:

```typescript
import {
  deriveMetrics,
  computeMedian,
  computeCompetitionRank,
} from "../src/tools/peerGroup.js";

describe("computeCompetitionRank", () => {
  it("ranks a value among peers (higher-is-better, descending sort)", () => {
    // Peers: [10, 8, 6, 4, 2], subject: 7
    // Sorted desc: 10, 8, 7, 6, 4, 2 → subject rank 3
    const result = computeCompetitionRank(7, [10, 8, 6, 4, 2], true);
    expect(result).toEqual({ rank: 3, of: 5, percentile: 60 });
  });

  it("ranks a value among peers (lower-is-better, ascending sort)", () => {
    // Peers: [10, 8, 6, 4, 2], subject: 3
    // Sorted asc: 2, 3, 4, 6, 8, 10 → subject rank 2
    const result = computeCompetitionRank(3, [10, 8, 6, 4, 2], false);
    expect(result).toEqual({ rank: 2, of: 5, percentile: 80 });
  });

  it("handles ties — subject gets same rank as equal peers", () => {
    // Peers: [10, 8, 8, 4], subject: 8
    // Sorted desc: 10, 8, 8, 8, 4 → competition rank: 10→1, 8→2, 8→2, 8→2, 4→5
    // Subject rank = 2
    const result = computeCompetitionRank(8, [10, 8, 8, 4], true);
    expect(result).toEqual({ rank: 2, of: 4, percentile: 75 });
  });

  it("gives rank 1 and 100th percentile when subject is best", () => {
    const result = computeCompetitionRank(99, [10, 20, 30], true);
    expect(result).toEqual({ rank: 1, of: 3, percentile: 100 });
  });

  it("gives last rank and low percentile when subject is worst", () => {
    const result = computeCompetitionRank(1, [10, 20, 30], true);
    // Sorted desc: 30, 20, 10, 1 → subject rank 4
    expect(result).toEqual({ rank: 4, of: 3, percentile: 0 });
  });

  it("handles null-direction metrics (descending sort by default)", () => {
    const result = computeCompetitionRank(5, [10, 8, 3, 1], null);
    expect(result).toEqual({ rank: 3, of: 4, percentile: 50 });
  });

  it("returns null when peer list is empty", () => {
    expect(computeCompetitionRank(5, [], true)).toBeNull();
  });
});
```

**Step 2: Implement computeCompetitionRank**

Add to `src/tools/peerGroup.ts`:

```typescript
export interface RankResult {
  rank: number;
  of: number;
  percentile: number;
}

export function computeCompetitionRank(
  subjectValue: number,
  peerValues: number[],
  higherIsBetter: boolean | null,
): RankResult | null {
  if (peerValues.length === 0) return null;

  const ascending = higherIsBetter === false;
  const all = [...peerValues, subjectValue];
  const sorted = [...all].sort((a, b) =>
    ascending ? a - b : b - a,
  );

  // Assign competition ranks
  const ranks = new Map<number, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (!ranks.has(sorted[i])) {
      ranks.set(sorted[i], currentRank);
    }
    currentRank = i + 2;
  }

  const rank = ranks.get(subjectValue)!;
  const of = peerValues.length;
  const percentile = Math.round((1 - (rank - 1) / of) * 100);

  return { rank, of, percentile };
}
```

**Step 3: Run the tests**

Run: `npx vitest run tests/peerGroup.test.ts`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/tools/peerGroup.ts tests/peerGroup.test.ts
git commit -m "feat: add computeCompetitionRank with tie handling for peer group analysis"
```

---

### Task 3: Text formatting and date formatting functions

**Files:**
- Modify: `src/tools/peerGroup.ts`
- Modify: `tests/peerGroup.test.ts`

**Step 1: Write the failing tests**

Append to `tests/peerGroup.test.ts`:

```typescript
import {
  deriveMetrics,
  computeMedian,
  computeCompetitionRank,
  formatRepdteHuman,
} from "../src/tools/peerGroup.js";

describe("formatRepdteHuman", () => {
  it("formats YYYYMMDD as a human-readable date", () => {
    expect(formatRepdteHuman("20241231")).toBe("December 31, 2024");
  });

  it("formats March date correctly", () => {
    expect(formatRepdteHuman("20230331")).toBe("March 31, 2023");
  });

  it("returns the raw string for invalid dates", () => {
    expect(formatRepdteHuman("bad")).toBe("bad");
  });
});
```

**Step 2: Implement formatRepdteHuman**

Add to `src/tools/peerGroup.ts`:

```typescript
export function formatRepdteHuman(repdte: string): string {
  if (repdte.length !== 8) return repdte;
  const year = repdte.slice(0, 4);
  const month = repdte.slice(4, 6);
  const day = repdte.slice(6, 8);
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return repdte;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

**Step 3: Run the tests**

Run: `npx vitest run tests/peerGroup.test.ts`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/tools/peerGroup.ts tests/peerGroup.test.ts
git commit -m "feat: add formatRepdteHuman for peer group text output"
```

---

### Task 4: Metric definitions constant and METRIC_KEYS ordering

**Files:**
- Modify: `src/tools/peerGroup.ts`

**Step 1: Add the constants**

Add to `src/tools/peerGroup.ts`:

```typescript
interface MetricDefinition {
  higher_is_better: boolean | null;
  unit: string;
  label: string;
  ranking_note?: string;
}

export const METRIC_KEYS = [
  "asset",
  "dep",
  "roa",
  "roe",
  "netnim",
  "equity_ratio",
  "efficiency_ratio",
  "loan_to_deposit",
  "deposits_to_assets",
  "noninterest_income_share",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  asset: { higher_is_better: true, unit: "$thousands", label: "Total Assets" },
  dep: { higher_is_better: true, unit: "$thousands", label: "Total Deposits" },
  roa: { higher_is_better: true, unit: "%", label: "Return on Assets" },
  roe: { higher_is_better: true, unit: "%", label: "Return on Equity" },
  netnim: { higher_is_better: true, unit: "%", label: "Net Interest Margin" },
  equity_ratio: { higher_is_better: true, unit: "%", label: "Equity Capital Ratio" },
  efficiency_ratio: { higher_is_better: false, unit: "%", label: "Efficiency Ratio" },
  loan_to_deposit: {
    higher_is_better: null,
    unit: "ratio",
    label: "Loan-to-Deposit Ratio",
    ranking_note:
      "Rank and percentile reflect position by value (1 = highest). Directionality is context-dependent.",
  },
  deposits_to_assets: {
    higher_is_better: null,
    unit: "ratio",
    label: "Deposits-to-Assets Ratio",
    ranking_note:
      "Rank and percentile reflect position by value (1 = highest). Directionality is context-dependent.",
  },
  noninterest_income_share: {
    higher_is_better: true,
    unit: "ratio",
    label: "Non-Interest Income Share",
  },
};
```

**Step 2: Run typecheck and existing tests**

Run: `npx tsc --noEmit && npx vitest run tests/peerGroup.test.ts`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/tools/peerGroup.ts
git commit -m "feat: add METRIC_DEFINITIONS and METRIC_KEYS constants for peer group tool"
```

---

### Task 5: Zod input schema with validation

**Files:**
- Modify: `src/tools/peerGroup.ts`
- Modify: `tests/peerGroup.test.ts`

**Step 1: Write the failing tests**

Append to `tests/peerGroup.test.ts`:

```typescript
import {
  deriveMetrics,
  computeMedian,
  computeCompetitionRank,
  formatRepdteHuman,
  PeerGroupInputSchema,
} from "../src/tools/peerGroup.js";

describe("PeerGroupInputSchema", () => {
  it("accepts subject-driven mode with cert and repdte", () => {
    const result = PeerGroupInputSchema.safeParse({ cert: 29846, repdte: "20241231" });
    expect(result.success).toBe(true);
  });

  it("accepts explicit-criteria mode without cert", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      asset_min: 5000000,
      asset_max: 20000000,
      charter_classes: ["N"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when repdte is missing", () => {
    const result = PeerGroupInputSchema.safeParse({ cert: 29846 });
    expect(result.success).toBe(false);
  });

  it("rejects when no peer-group constructor is provided", () => {
    const result = PeerGroupInputSchema.safeParse({ repdte: "20241231" });
    expect(result.success).toBe(false);
  });

  it("rejects when asset_min > asset_max", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      asset_min: 20000000,
      asset_max: 5000000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid state codes", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      state: "North Carolina",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid two-letter state code", () => {
    const result = PeerGroupInputSchema.safeParse({
      repdte: "20241231",
      state: "NC",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for active_only and limit", () => {
    const result = PeerGroupInputSchema.parse({ cert: 29846, repdte: "20241231" });
    expect(result.active_only).toBe(true);
    expect(result.limit).toBe(50);
  });
});
```

**Step 2: Implement the schema**

Add to `src/tools/peerGroup.ts`:

```typescript
import { z } from "zod";

export const PeerGroupInputSchema = z
  .object({
    cert: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Subject institution CERT number. When provided, auto-derives peer criteria and ranks this bank against peers.",
      ),
    repdte: z
      .string()
      .regex(/^\d{8}$/)
      .describe("Report date in YYYYMMDD format."),
    asset_min: z
      .number()
      .positive()
      .optional()
      .describe(
        "Minimum total assets ($thousands) for peer selection. Defaults to 50% of subject's report-date assets when cert is provided.",
      ),
    asset_max: z
      .number()
      .positive()
      .optional()
      .describe(
        "Maximum total assets ($thousands) for peer selection. Defaults to 200% of subject's report-date assets when cert is provided.",
      ),
    charter_classes: z
      .array(z.string())
      .optional()
      .describe(
        'Charter class codes to include (e.g., ["N", "SM"]). Defaults to the subject\'s charter class when cert is provided.',
      ),
    state: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .describe('Two-letter state code (e.g., "NC", "TX").'),
    raw_filter: z
      .string()
      .optional()
      .describe(
        "Advanced: raw ElasticSearch query string appended to peer selection criteria with AND.",
      ),
    active_only: z
      .boolean()
      .default(true)
      .describe("Limit to institutions where ACTIVE:1 (currently operating, FDIC-insured)."),
    extra_fields: z
      .array(z.string())
      .optional()
      .describe(
        "Additional FDIC field names to include as raw values in the response. Does not affect peer selection.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe(
        "Max peer records returned in the response. All matched peers are used for ranking regardless of this limit.",
      ),
  })
  .superRefine((value, ctx) => {
    if (
      !value.cert &&
      value.asset_min === undefined &&
      value.asset_max === undefined &&
      !value.charter_classes &&
      !value.state &&
      !value.raw_filter
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one peer-group constructor is required: cert, asset_min, asset_max, charter_classes, state, or raw_filter.",
        path: ["cert"],
      });
    }
    if (
      value.asset_min !== undefined &&
      value.asset_max !== undefined &&
      value.asset_min > value.asset_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "asset_min must be <= asset_max.",
        path: ["asset_min"],
      });
    }
  });
```

**Step 3: Run the tests**

Run: `npx vitest run tests/peerGroup.test.ts`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/tools/peerGroup.ts tests/peerGroup.test.ts
git commit -m "feat: add PeerGroupInputSchema with validation rules"
```

---

### Task 6: Tool registration and pipeline — Phase 1 & 2 (subject resolution and peer roster)

**Files:**
- Modify: `src/tools/peerGroup.ts`
- Modify: `src/index.ts`

**Step 1: Add registerPeerGroupTools with Phase 1 and Phase 2**

Add to `src/tools/peerGroup.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";

const CHUNK_SIZE = 25;
const MAX_CONCURRENCY = 4;
const ANALYSIS_TIMEOUT_MS = 90_000;
const FINANCIAL_FIELDS =
  "CERT,ASSET,DEP,NETINC,ROA,ROE,NETNIM,EQTOT,LNLSNET,INTINC,EINTEXP,NONII,NONIX";

// Reuse from analysis.ts pattern
function buildCertFilters(certs: number[]): string[] {
  const filters: string[] = [];
  for (let i = 0; i < certs.length; i += CHUNK_SIZE) {
    const chunk = certs.slice(i, i + CHUNK_SIZE);
    filters.push(chunk.map((cert) => `CERT:${cert}`).join(" OR "));
  }
  return filters;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= values.length) return;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

export function registerPeerGroupTools(server: McpServer): void {
  server.registerTool(
    "fdic_peer_group_analysis",
    {
      title: "Peer Group Analysis",
      description: `Build a peer group for an FDIC-insured institution and rank it against peers on financial and efficiency metrics at a single report date.

Three usage modes:
  - Subject-driven: provide cert and repdte — auto-derives peer criteria from the subject's asset size and charter class
  - Explicit criteria: provide repdte plus asset_min/asset_max, charter_classes, state, or raw_filter
  - Subject with overrides: provide cert plus explicit criteria to override auto-derived defaults

Metrics ranked (fixed order):
  - Total Assets, Total Deposits, ROA, ROE, Net Interest Margin
  - Equity Capital Ratio, Efficiency Ratio, Loan-to-Deposit Ratio
  - Deposits-to-Assets Ratio, Non-Interest Income Share

Rankings use competition rank (1, 2, 2, 4) with metric-specific denominators. Subject is excluded from peer set.

Output includes:
  - Subject rankings and percentiles (when cert provided)
  - Peer group medians
  - Peer list with CERTs (pass to fdic_compare_bank_snapshots for trend analysis)
  - Metric definitions with directionality metadata

Override precedence: cert derives defaults, then explicit params override them.`,
      inputSchema: PeerGroupInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

      try {
        const warnings: string[] = [];
        let subjectProfile: Record<string, unknown> | null = null;
        let subjectFinancials: Record<string, unknown> | null = null;

        // --- Phase 1: Resolve subject ---
        if (params.cert) {
          const [profileResponse, financialsResponse] = await Promise.all([
            queryEndpoint(
              ENDPOINTS.INSTITUTIONS,
              {
                filters: `CERT:${params.cert}`,
                fields: "CERT,NAME,CITY,STALP,BKCLASS",
                limit: 1,
              },
              { signal: controller.signal },
            ),
            queryEndpoint(
              ENDPOINTS.FINANCIALS,
              {
                filters: `CERT:${params.cert} AND REPDTE:${params.repdte}`,
                fields: FINANCIAL_FIELDS,
                limit: 1,
              },
              { signal: controller.signal },
            ),
          ]);

          const profileRecords = extractRecords(profileResponse);
          if (profileRecords.length === 0) {
            return formatToolError(
              new Error(`No institution found with CERT number ${params.cert}.`),
            );
          }
          subjectProfile = profileRecords[0];

          const financialRecords = extractRecords(financialsResponse);
          if (financialRecords.length === 0) {
            return formatToolError(
              new Error(
                `No financial data for CERT ${params.cert} at report date ${params.repdte}. ` +
                  `Auto-derivation of peer criteria requires asset data at the specified report date.`,
              ),
            );
          }
          subjectFinancials = financialRecords[0];
        }

        // Derive defaults and apply overrides
        const subjectAsset =
          subjectFinancials && typeof subjectFinancials.ASSET === "number"
            ? subjectFinancials.ASSET
            : null;

        const assetMin =
          params.asset_min ??
          (subjectAsset !== null ? subjectAsset * 0.5 : undefined);
        const assetMax =
          params.asset_max ??
          (subjectAsset !== null ? subjectAsset * 2.0 : undefined);
        const charterClasses =
          params.charter_classes ??
          (subjectProfile && typeof subjectProfile.BKCLASS === "string"
            ? [subjectProfile.BKCLASS]
            : undefined);
        const { state, active_only, raw_filter } = params;

        // --- Phase 2: Build peer roster ---
        const filterParts: string[] = [];
        if (assetMin !== undefined || assetMax !== undefined) {
          const min = assetMin ?? 0;
          const max = assetMax ?? "*";
          filterParts.push(`ASSET:[${min} TO ${max}]`);
        }
        if (charterClasses && charterClasses.length > 0) {
          const classFilter = charterClasses
            .map((cls) => `BKCLASS:${cls}`)
            .join(" OR ");
          filterParts.push(
            charterClasses.length > 1 ? `(${classFilter})` : classFilter,
          );
        }
        if (state) filterParts.push(`STALP:${state}`);
        if (active_only) filterParts.push("ACTIVE:1");
        if (raw_filter) filterParts.push(`(${raw_filter})`);

        const rosterResponse = await queryEndpoint(
          ENDPOINTS.INSTITUTIONS,
          {
            filters: filterParts.join(" AND "),
            fields: "CERT,NAME,CITY,STALP,BKCLASS",
            limit: 10_000,
            offset: 0,
            sort_by: "CERT",
            sort_order: "ASC",
          },
          { signal: controller.signal },
        );

        let rosterRecords = extractRecords(rosterResponse);
        if (rosterResponse.meta.total > rosterRecords.length) {
          warnings.push(
            `Institution roster truncated to ${rosterRecords.length.toLocaleString()} records ` +
              `out of ${rosterResponse.meta.total.toLocaleString()} matched institutions. ` +
              `Narrow the peer group criteria for complete analysis.`,
          );
        }

        // Remove subject from roster
        if (params.cert) {
          rosterRecords = rosterRecords.filter(
            (r) => asNumber(r.CERT) !== params.cert,
          );
        }

        const criteriaUsed = {
          asset_min: assetMin ?? null,
          asset_max: assetMax ?? null,
          charter_classes: charterClasses ?? null,
          state: state ?? null,
          active_only,
          raw_filter: raw_filter ?? null,
        };

        if (rosterRecords.length === 0) {
          const output = {
            ...(subjectProfile
              ? {
                  subject: {
                    cert: params.cert,
                    name: subjectProfile.NAME,
                    city: subjectProfile.CITY,
                    stalp: subjectProfile.STALP,
                    bkclass: subjectProfile.BKCLASS,
                    metrics: subjectFinancials
                      ? deriveMetrics(subjectFinancials)
                      : null,
                    rankings: null,
                  },
                }
              : {}),
            peer_group: { repdte: params.repdte, criteria_used: criteriaUsed, medians: {} },
            metric_definitions: METRIC_DEFINITIONS,
            peers: [],
            peer_count: 0,
            returned_count: 0,
            has_more: false,
            message: "No peers matched the specified criteria.",
            warnings,
          };

          const dateStr = formatRepdteHuman(params.repdte);
          const subjectLabel = subjectProfile
            ? ` for ${subjectProfile.NAME} (CERT ${params.cert})`
            : "";
          const text = `Peer group analysis${subjectLabel} as of ${dateStr}.\n0 peers matched.`;

          return {
            content: [{ type: "text", text }],
            structuredContent: output,
          };
        }

        // --- Phases 3 & 4 follow in next task ---
        // PLACEHOLDER: will be replaced in Task 7
        return formatToolError(new Error("Not yet implemented: phases 3-4"));
      } catch (err) {
        if (controller.signal.aborted) {
          return formatToolError(
            new Error(
              `Peer group analysis timed out after ${Math.floor(ANALYSIS_TIMEOUT_MS / 1000)} seconds. ` +
                `Narrow the peer group criteria and try again.`,
            ),
          );
        }
        return formatToolError(err);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
```

**Step 2: Register in index.ts**

In `src/index.ts`, add the import and registration call:

```typescript
import { registerPeerGroupTools } from "./tools/peerGroup.js";
```

Add after `registerAnalysisTools(server);`:

```typescript
registerPeerGroupTools(server);
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

**Step 4: Commit**

```bash
git add src/tools/peerGroup.ts src/index.ts
git commit -m "feat: register fdic_peer_group_analysis tool with Phase 1-2 pipeline"
```

---

### Task 7: Pipeline Phases 3 & 4 — Fetch financials, compute metrics, rank, and assemble

**Files:**
- Modify: `src/tools/peerGroup.ts`

**Step 1: Replace the placeholder with the full Phase 3–4 implementation**

Replace the `// --- Phases 3 & 4 follow in next task ---` placeholder block with:

```typescript
        // --- Phase 3: Fetch peer financials ---
        const peerCerts = rosterRecords
          .map((r) => asNumber(r.CERT))
          .filter((c): c is number => c !== null);

        const certFilters = buildCertFilters(peerCerts);
        const extraFieldsCsv =
          params.extra_fields && params.extra_fields.length > 0
            ? "," + params.extra_fields.join(",")
            : "";

        const financialResponses = await mapWithConcurrency(
          certFilters,
          MAX_CONCURRENCY,
          async (certFilter) =>
            queryEndpoint(
              ENDPOINTS.FINANCIALS,
              {
                filters: `(${certFilter}) AND REPDTE:${params.repdte}`,
                fields: FINANCIAL_FIELDS + extraFieldsCsv,
                limit: 10_000,
                offset: 0,
                sort_by: "CERT",
                sort_order: "ASC",
              },
              { signal: controller.signal },
            ),
        );

        const peerFinancialsByCert = new Map<number, Record<string, unknown>>();
        for (const response of financialResponses) {
          for (const record of extractRecords(response)) {
            const cert = asNumber(record.CERT);
            if (cert !== null) peerFinancialsByCert.set(cert, record);
          }
        }

        // Build roster lookup
        const rosterByCert = new Map(
          rosterRecords
            .map((r) => [asNumber(r.CERT), r] as const)
            .filter((e): e is [number, Record<string, unknown>] => e[0] !== null),
        );

        // Compute metrics for peers that have financials
        interface PeerEntry {
          cert: number;
          name: string;
          city: string | null;
          stalp: string | null;
          bkclass: string | null;
          metrics: DerivedMetrics;
          extraFields: Record<string, unknown>;
        }

        const peers: PeerEntry[] = [];
        for (const [cert, financials] of peerFinancialsByCert) {
          const roster = rosterByCert.get(cert);
          const metrics = deriveMetrics(financials);
          const extraFields: Record<string, unknown> = {};
          if (params.extra_fields) {
            for (const field of params.extra_fields) {
              extraFields[field] = financials[field] ?? null;
            }
          }
          peers.push({
            cert,
            name: String(roster?.NAME ?? financials.NAME ?? cert),
            city: roster?.CITY != null ? String(roster.CITY) : null,
            stalp: roster?.STALP != null ? String(roster.STALP) : null,
            bkclass: roster?.BKCLASS != null ? String(roster.BKCLASS) : null,
            metrics,
            extraFields,
          });
        }

        const peerCount = peers.length;

        // --- Phase 4: Rank and assemble ---
        // Compute subject metrics
        const subjectMetrics = subjectFinancials
          ? deriveMetrics(subjectFinancials)
          : null;

        // Compute rankings and medians
        const rankings: Record<string, RankResult | null> = {};
        const medians: Record<string, number | null> = {};

        for (const key of METRIC_KEYS) {
          const peerValues = peers
            .map((p) => p.metrics[key])
            .filter((v): v is number => v !== null);

          medians[key] = computeMedian(peerValues);

          if (subjectMetrics && subjectMetrics[key] !== null) {
            rankings[key] = computeCompetitionRank(
              subjectMetrics[key]!,
              peerValues,
              METRIC_DEFINITIONS[key].higher_is_better,
            );
          } else {
            rankings[key] = null;
          }
        }

        // Sort peers by asset descending
        peers.sort((a, b) => (b.metrics.asset ?? 0) - (a.metrics.asset ?? 0));
        const returnedPeers = peers.slice(0, params.limit);
        const returnedCount = returnedPeers.length;
        const hasMore = peerCount > returnedCount;

        // Build output
        const output: Record<string, unknown> = {};

        if (subjectProfile && subjectMetrics) {
          output.subject = {
            cert: params.cert,
            name: subjectProfile.NAME,
            city: subjectProfile.CITY,
            stalp: subjectProfile.STALP,
            bkclass: subjectProfile.BKCLASS,
            metrics: subjectMetrics,
            rankings,
          };
        }

        output.peer_group = {
          repdte: params.repdte,
          criteria_used: criteriaUsed,
          medians,
        };
        output.metric_definitions = METRIC_DEFINITIONS;
        output.peers = returnedPeers.map((p) => ({
          cert: p.cert,
          name: p.name,
          city: p.city,
          stalp: p.stalp,
          metrics: p.metrics,
          ...p.extraFields,
        }));
        output.peer_count = peerCount;
        output.returned_count = returnedCount;
        output.has_more = hasMore;
        output.message = null;
        output.warnings = warnings;

        // Build text output
        const text = truncateIfNeeded(
          formatPeerGroupText(output, params.repdte, subjectProfile, subjectMetrics, rankings, medians, returnedPeers, peerCount, warnings),
          CHARACTER_LIMIT,
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: output,
        };
```

Also add the `formatPeerGroupText` helper function before `registerPeerGroupTools`:

```typescript
function formatMetricValue(
  key: MetricKey,
  value: number | null,
): string {
  if (value === null) return "n/a";
  const def = METRIC_DEFINITIONS[key];
  if (def.unit === "$thousands") return `$${Math.round(value).toLocaleString()}k`;
  if (def.unit === "%") return `${value.toFixed(4)}%`;
  return value.toFixed(4);
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

interface PeerEntry {
  cert: number;
  name: string;
  city: string | null;
  stalp: string | null;
  bkclass: string | null;
  metrics: DerivedMetrics;
  extraFields: Record<string, unknown>;
}

function formatPeerGroupText(
  _output: Record<string, unknown>,
  repdte: string,
  subjectProfile: Record<string, unknown> | null,
  subjectMetrics: DerivedMetrics | null,
  rankings: Record<string, RankResult | null>,
  medians: Record<string, number | null>,
  returnedPeers: PeerEntry[],
  peerCount: number,
  warnings: string[],
): string {
  const parts: string[] = [];

  // Warnings
  for (const warning of warnings) {
    parts.push(`Warning: ${warning}`);
  }

  // Header
  const dateStr = formatRepdteHuman(repdte);
  const subjectLabel = subjectProfile
    ? ` for ${subjectProfile.NAME} (CERT ${subjectProfile.CERT ?? ""})`
    : "";
  parts.push(
    `Peer group analysis${subjectLabel} as of ${dateStr}.`,
  );
  parts.push(`${peerCount} peers matched.`);

  // Subject rankings
  if (subjectMetrics && subjectProfile) {
    parts.push("");
    parts.push("Subject rankings:");
    for (const key of METRIC_KEYS) {
      const def = METRIC_DEFINITIONS[key];
      const ranking = rankings[key];
      const value = formatMetricValue(key, subjectMetrics[key]);
      const medianValue = formatMetricValue(key, medians[key] ?? null);
      if (ranking) {
        const pctLabel = `${ordinalSuffix(ranking.percentile)} percentile`;
        parts.push(
          `  ${def.label.padEnd(28)} rank ${String(ranking.rank).padStart(2)} of ${String(ranking.of).padEnd(4)} (${pctLabel.padEnd(18)})  ${value.padStart(16)}  median: ${medianValue}`,
        );
      } else {
        parts.push(`  ${def.label.padEnd(28)} n/a`);
      }
    }
  } else if (peerCount > 0) {
    // Explicit-criteria mode: show medians
    parts.push("");
    parts.push("Peer group medians:");
    const medianParts = METRIC_KEYS.filter((k) => medians[k] !== null).map(
      (k) => `${METRIC_DEFINITIONS[k].label}: ${formatMetricValue(k, medians[k] ?? null)}`,
    );
    parts.push(`  ${medianParts.join(" | ")}`);
  }

  // Peer list
  if (returnedPeers.length > 0) {
    parts.push("");
    parts.push(`Peers (${returnedPeers.length} returned):`);
    for (let i = 0; i < returnedPeers.length; i++) {
      const p = returnedPeers[i];
      const location = [p.city, p.stalp].filter(Boolean).join(" ");
      const locationStr = location ? `, ${location}` : "";
      parts.push(
        `${i + 1}. ${p.name}${locationStr} (CERT ${p.cert}) | ` +
          `Asset: ${formatMetricValue("asset", p.metrics.asset)} | ` +
          `ROA: ${formatMetricValue("roa", p.metrics.roa)} | ` +
          `ROE: ${formatMetricValue("roe", p.metrics.roe)}`,
      );
    }
  }

  return parts.join("\n");
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/tools/peerGroup.ts
git commit -m "feat: complete Phase 3-4 pipeline with financial fetch, ranking, and text formatting"
```

---

### Task 8: Integration tests via HTTP MCP

**Files:**
- Modify: `tests/mcp-http.test.ts`

**Step 1: Write integration tests**

Append to `tests/mcp-http.test.ts`:

```typescript
  it("includes fdic_peer_group_analysis in the tool list", async () => {
    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 100,
      method: "tools/list",
      params: {},
    });

    expect(response.status).toBe(200);
    expect(
      response.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("fdic_peer_group_analysis");
  });

  it("performs subject-driven peer group analysis", async () => {
    getMock
      // Phase 1: institutions lookup
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, NAME: "Subject Bank", CITY: "Wilmington", STALP: "NC", BKCLASS: "NM" } }],
          meta: { total: 1 },
        },
      })
      // Phase 1: subject financials
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, ASSET: 1000, DEP: 800, NETINC: 20, ROA: 1.5, ROE: 12.0, NETNIM: 3.5, EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25 } }],
          meta: { total: 1 },
        },
      })
      // Phase 2: peer roster
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 100, NAME: "Subject Bank", CITY: "Wilmington", STALP: "NC", BKCLASS: "NM" } },
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "NM" } },
            { data: { CERT: 300, NAME: "Peer B", CITY: "Charlotte", STALP: "NC", BKCLASS: "NM" } },
          ],
          meta: { total: 3 },
        },
      })
      // Phase 3: peer financials
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, ASSET: 900, DEP: 700, NETINC: 15, ROA: 1.2, ROE: 10.0, NETNIM: 3.0, EQTOT: 90, LNLSNET: 500, INTINC: 40, EINTEXP: 12, NONII: 8, NONIX: 22 } },
            { data: { CERT: 300, ASSET: 1100, DEP: 850, NETINC: 25, ROA: 1.8, ROE: 14.0, NETNIM: 4.0, EQTOT: 120, LNLSNET: 700, INTINC: 60, EINTEXP: 18, NONII: 12, NONIX: 28 } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: { cert: 100, repdte: "20241231" },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.peer_count).toBe(2);
    expect(sc.returned_count).toBe(2);
    expect(sc.subject.cert).toBe(100);
    expect(sc.subject.rankings.roa).toMatchObject({ of: 2 });
    expect(sc.subject.rankings.roa.rank).toBe(2);
    expect(sc.peers).toHaveLength(2);
    expect(sc.peers[0].cert).toBe(300); // highest asset first
    expect(sc.metric_definitions.roa.higher_is_better).toBe(true);
    expect(sc.metric_definitions.efficiency_ratio.higher_is_better).toBe(false);
    expect(sc.warnings).toEqual([]);
    expect(response.body.result.content[0].text).toContain("Subject Bank");
    expect(response.body.result.content[0].text).toContain("December 31, 2024");
  });

  it("performs explicit-criteria peer group analysis without subject", async () => {
    getMock
      // Phase 2: peer roster (no Phase 1 since no cert)
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, NAME: "Peer A", CITY: "Raleigh", STALP: "NC", BKCLASS: "N" } },
            { data: { CERT: 300, NAME: "Peer B", CITY: "Charlotte", STALP: "NC", BKCLASS: "N" } },
          ],
          meta: { total: 2 },
        },
      })
      // Phase 3: peer financials
      .mockResolvedValueOnce({
        data: {
          data: [
            { data: { CERT: 200, ASSET: 5000000, DEP: 4000000, NETINC: 100000, ROA: 1.0, ROE: 9.0, NETNIM: 3.0, EQTOT: 500000, LNLSNET: 3000000, INTINC: 200000, EINTEXP: 80000, NONII: 30000, NONIX: 100000 } },
            { data: { CERT: 300, ASSET: 8000000, DEP: 6000000, NETINC: 200000, ROA: 1.5, ROE: 11.0, NETNIM: 3.5, EQTOT: 900000, LNLSNET: 4500000, INTINC: 350000, EINTEXP: 120000, NONII: 50000, NONIX: 150000 } },
          ],
          meta: { total: 2 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: {
          repdte: "20241231",
          asset_min: 5000000,
          asset_max: 20000000,
          charter_classes: ["N"],
          state: "NC",
        },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.subject).toBeUndefined();
    expect(sc.peer_count).toBe(2);
    expect(sc.peer_group.criteria_used.state).toBe("NC");
    expect(sc.peer_group.medians.roa).toBe(1.25);
    expect(response.body.result.content[0].text).toContain("Peer group medians");
  });

  it("returns empty result when no peers match", async () => {
    getMock
      // Phase 1: institutions
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, NAME: "Lonely Bank", CITY: "Nowhere", STALP: "NC", BKCLASS: "NM" } }],
          meta: { total: 1 },
        },
      })
      // Phase 1: financials
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, ASSET: 1000, DEP: 800, ROA: 1.0, ROE: 8.0, NETNIM: 3.0, EQTOT: 100, LNLSNET: 600, INTINC: 50, EINTEXP: 15, NONII: 10, NONIX: 25 } }],
          meta: { total: 1 },
        },
      })
      // Phase 2: roster returns only the subject
      .mockResolvedValueOnce({
        data: {
          data: [{ data: { CERT: 100, NAME: "Lonely Bank", CITY: "Nowhere", STALP: "NC", BKCLASS: "NM" } }],
          meta: { total: 1 },
        },
      });

    const response = await mcpPost({
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: {
        name: "fdic_peer_group_analysis",
        arguments: { cert: 100, repdte: "20241231" },
      },
    });

    expect(response.status).toBe(200);
    const sc = response.body.result.structuredContent;
    expect(sc.peer_count).toBe(0);
    expect(sc.message).toBe("No peers matched the specified criteria.");
    expect(sc.peers).toEqual([]);
  });
```

**Step 2: Update the existing tool count assertion**

In the existing test `"lists all registered tools including demographics"`, update the expected tool count from 11 to 12:

```typescript
expect(response.body.result.tools).toHaveLength(12);
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add tests/mcp-http.test.ts
git commit -m "test: add integration tests for fdic_peer_group_analysis tool"
```

---

### Task 9: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update the tool count and add the new tool to the table**

In README.md, update `**11 tools**` to `**12 tools**` in the Features section.

Add the new tool row to the Available Tools table:

```markdown
| `fdic_peer_group_analysis` | Build a peer group and rank an institution against peers on financial metrics |
```

**Step 2: Add a section describing peer group analysis usage**

Add after the "Complex Prompts" section a new section:

```markdown
## Peer Group Analysis

The `fdic_peer_group_analysis` tool builds a peer group for a bank and ranks it against peers on financial and efficiency metrics at a single report date.

**Find peers for a specific bank (auto-derived criteria):**
```
cert: 29846
repdte: 20241231
(fdic_peer_group_analysis)
```

**Define a peer group with explicit criteria:**
```
repdte: 20241231
asset_min: 5000000
asset_max: 20000000
charter_classes: ["N"]
state: NC
(fdic_peer_group_analysis)
```

**Override auto-derived defaults:**
```
cert: 29846
repdte: 20241231
asset_min: 3000000
state: NC
(fdic_peer_group_analysis)
```

The tool returns rankings (competition rank + percentile) and peer group medians for:
- Total Assets, Total Deposits, ROA, ROE, Net Interest Margin
- Equity Capital Ratio, Efficiency Ratio, Loan-to-Deposit Ratio
- Deposits-to-Assets Ratio, Non-Interest Income Share

Peer CERTs from the response can be passed to `fdic_compare_bank_snapshots` for trend analysis across the peer group.
```

**Step 3: Run build to verify nothing is broken**

Run: `npm run typecheck && npm test && npm run build`
Expected: All PASS.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add fdic_peer_group_analysis to README"
```

---

### Task 10: Final validation

**Step 1: Run the full validation suite**

Run: `npm run typecheck && npm test && npm run build`
Expected: All pass with no warnings.

**Step 2: Verify the build output includes the new tool**

Run: `node dist/index.js` (briefly, then Ctrl+C) or check the dist output.

**Step 3: Review all changes**

Run: `git diff main --stat` to verify only the expected files were changed.
