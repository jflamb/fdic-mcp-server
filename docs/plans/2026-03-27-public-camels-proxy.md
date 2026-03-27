# Public CAMELS Proxy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the FDIC MCP analysis layer into a unified "public off-site proxy" model that aligns with FDIC-style heuristics, adds peer/trend/outlier/provenance logic, and upgrades tool output while keeping existing tool names and response shapes working.

**Architecture:** A new shared engine (`src/tools/shared/publicCamelsProxy.ts`) becomes the single source of truth for metric normalization, field alias resolution, scoring, PCA capital categorization, management overlay, trend analysis, peer benchmarking, outlier detection, and risk signals. Existing tools (`bankHealth`, `peerHealth`, `riskSignals`) are refactored to delegate to this engine, adding the new `public_camels_proxy_v1` model to structuredContent while retaining legacy fields for backward compatibility.

**Tech Stack:** TypeScript, Zod, MCP SDK, vitest. No new dependencies.

---

## Current State Summary (from audit)

| File | Role | Key Issue |
|------|------|-----------|
| `camelsScoring.ts` | Scoring engine | 1-5 scale only, no PCA, no peer, no provenance, no management overlay |
| `bankHealth.ts` | Single-bank tool | Hardcoded risk signals, no peer context, output missing proxy model |
| `peerHealth.ts` | Peer comparison | No percentiles, no weighted aggregates, no outlier detection |
| `riskSignals.ts` | Screening | Duplicates scoring/risk logic from bankHealth, no shared signals |
| `financialMetrics.ts` | Derived metrics | Used by peerGroup/analysis, NOT by CAMELS tools — parallel derivation |
| `reference/specification.md` | Spec doc | Only lists 12 tools, missing the 11 analysis tools added recently |

**Duplication hotspots:**
- `getPriorQuarterDates` duplicated in bankHealth.ts AND riskSignals.ts
- Risk signal classification in bankHealth (`collectRiskSignals`) vs riskSignals (`classifyRiskSignals`) — overlapping but different
- TREND_METRICS duplicated in bankHealth.ts and riskSignals.ts
- Component/composite scoring called identically in 3 tools

---

## Dependency Graph

```
Task 1: Canonical Metric Layer (foundation — no tool changes yet)
  ↓
Task 2: PCA Capital Categorization (extends metric layer)
  ↓
Task 3: Enhanced Trend Engine (extends metric layer)
  ↓
Task 4: Peer Engine (depends on metric layer)
  ↓
Task 5: Management Overlay (depends on trend + scoring)
  ↓
Task 6: Unified Risk Signals (depends on all above)
  ↓
Task 7: Public Proxy Model Assembly (orchestrates all above)
  ↓
Task 8: Refactor bankHealth tool (uses proxy model, backward compat)
  ↓
Task 9: Refactor peerHealth tool (uses proxy model + peer engine)
  ↓
Task 10: Refactor riskSignals tool (uses proxy model + unified signals)
  ↓
Task 11: Light refactor of peerGroup/analysis (reuse shared utils)
  ↓
Task 12: Docs, spec sync, reference files
```

Tasks 1-7 build the shared engine with tests; Tasks 8-10 wire it into tools; Task 11-12 cleanup and docs.

---

## Task 1: Canonical Metric Layer with Field Alias Resolution

**Files:**
- Create: `src/tools/shared/metricNormalization.ts`
- Test: `tests/metricNormalization.test.ts`

This is the foundation. All other tasks depend on it.

### Step 1: Write failing tests for canonical metric extraction

```typescript
// tests/metricNormalization.test.ts
import { describe, expect, it } from "vitest";
import {
  extractCanonicalMetrics,
  type CanonicalMetrics,
  type MetricProvenance,
} from "../src/tools/shared/metricNormalization.js";

describe("extractCanonicalMetrics", () => {
  it("extracts metrics from FDIC financial record using direct fields", () => {
    const raw: Record<string, unknown> = {
      ASSET: 500000, DEP: 400000, DEPDOM: 380000,
      EQTOT: 50000, NETINC: 5000,
      IDT1CER: 9.5, IDT1RWAJR: 14.2, EQV: 10.0,
      ROA: 1.0, ROE: 10.0, NIMY: 3.5, EEFFR: 60.0,
      LNLSDEPR: 80.0, DEPDASTR: 80.0,
      COREDEP: 350000, BROR: 5.0, CHBALR: 8.0,
      NCLNLSR: 1.0, NTLNLSR: 0.3,
      SC: 100000,
    };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.totalAssets).toBe(500000);
    expect(result.metrics.tier1LeveragePct).toBe(9.5);
    expect(result.metrics.roaPct).toBe(1.0);
    expect(result.metrics.netInterestMarginPct).toBe(3.5);
    expect(result.metrics.equityCapitalRatioPct).toBe(10.0);
    expect(result.metrics.loanToDepositPct).toBe(80.0);
  });

  it("derives equityCapitalRatioPct from EQTOT/ASSET when EQV is missing", () => {
    const raw: Record<string, unknown> = { EQTOT: 50000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.equityCapitalRatioPct).toBe(10.0);
    expect(result.provenance.equityCapitalRatioPct?.source).toBe("derived");
    expect(result.provenance.equityCapitalRatioPct?.formula).toContain("EQTOT / ASSET");
  });

  it("returns null with data-gap entry for missing required fields", () => {
    const result = extractCanonicalMetrics({});
    expect(result.metrics.totalAssets).toBeNull();
    expect(result.metrics.tier1LeveragePct).toBeNull();
    expect(result.dataGaps.length).toBeGreaterThan(0);
  });

  it("derives coreDepositsToAssetsPct from COREDEP and ASSET", () => {
    const raw: Record<string, unknown> = { COREDEP: 300000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.coreDepositsToAssetsPct).toBe(60.0);
  });

  it("derives securitiesToAssetsPct from SC/ASSET", () => {
    const raw: Record<string, unknown> = { SC: 100000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.securitiesToAssetsPct).toBe(20.0);
  });

  it("records provenance for each metric", () => {
    const raw: Record<string, unknown> = { ROA: 1.0 };
    const result = extractCanonicalMetrics(raw);
    expect(result.provenance.roaPct?.source).toBe("direct");
    expect(result.provenance.roaPct?.fdicField).toBe("ROA");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run tests/metricNormalization.test.ts`
Expected: FAIL — module not found

### Step 3: Implement canonical metric layer

```typescript
// src/tools/shared/metricNormalization.ts

/**
 * Canonical metric normalization layer.
 *
 * Resolves FDIC field aliases, extracts metrics using direct ratios where
 * available, and derives metrics only when safe. Records provenance for
 * every metric so consumers know exactly which field was used and whether
 * the value was direct or derived.
 */

import { asNumber } from "./queryUtils.js";

export interface CanonicalMetrics {
  totalAssets: number | null;
  totalDeposits: number | null;
  domesticDeposits: number | null;
  equityCapital: number | null;
  netIncome: number | null;

  // Capital ratios (direct from FDIC when available)
  tier1LeveragePct: number | null;
  cet1RatioPct: number | null;
  tier1RiskBasedPct: number | null;
  totalRiskBasedPct: number | null;
  equityCapitalRatioPct: number | null;

  // Earnings
  roaPct: number | null;
  roePct: number | null;
  netInterestMarginPct: number | null;
  efficiencyRatioPct: number | null;
  pretaxRoaPct: number | null;

  // Liquidity / Funding
  loanToDepositPct: number | null;
  domesticDepositsToAssetsPct: number | null;
  coreDepositsToAssetsPct: number | null;
  brokeredDepositsSharePct: number | null;
  cashAndDueToAssetsPct: number | null;

  // Asset Quality
  noncurrentLoansPct: number | null;
  netChargeOffsPct: number | null;
  reserveCoveragePct: number | null;
  noncurrentAssetsPct: number | null;
  provisionToLoansPct: number | null;

  // Sensitivity proxies
  securitiesToAssetsPct: number | null;
  longTermAssetsPct: number | null;
  volatileLiabilitiesToAssetsPct: number | null;
}

export interface MetricProvenanceEntry {
  source: "direct" | "derived";
  fdicField?: string;
  formula?: string;
}

export type MetricProvenance = Partial<Record<keyof CanonicalMetrics, MetricProvenanceEntry>>;

export interface DataGap {
  metric: string;
  reason: string;
}

export interface MetricExtractionResult {
  metrics: CanonicalMetrics;
  provenance: MetricProvenance;
  dataGaps: DataGap[];
}

/**
 * FDIC fields needed for the full canonical metric set.
 * Superset of CAMELS_FIELDS — includes sensitivity proxy fields.
 */
export const CANONICAL_FIELDS = [
  "CERT", "REPDTE", "ASSET", "DEP", "DEPDOM",
  "EQTOT", "EQV", "NETINC",
  "IDT1CER", "IDT1RWAJR", "RBCT1J", "RBCRWAJ",
  "ROA", "ROAPTX", "ROE", "NIMY", "EEFFR",
  "INTINC", "EINTEXP", "NONII", "NONIX",
  "LNLSDEPR", "DEPDASTR", "COREDEP", "BROR", "CHBALR",
  "NCLNLSR", "NTLNLSR", "NPERFV", "LNRESNCR", "LNATRESR", "ELNATRY",
  "SC", "ASSTLT", "VOTEFUND",
].join(",");

function safeDivPct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

type DirectMapping = {
  metric: keyof CanonicalMetrics;
  fdicField: string;
  fallback?: { fields: string[]; formula: string; compute: (raw: Record<string, unknown>) => number | null };
};

const DIRECT_MAPPINGS: DirectMapping[] = [
  { metric: "totalAssets", fdicField: "ASSET" },
  { metric: "totalDeposits", fdicField: "DEP" },
  { metric: "domesticDeposits", fdicField: "DEPDOM" },
  { metric: "equityCapital", fdicField: "EQTOT" },
  { metric: "netIncome", fdicField: "NETINC" },
  { metric: "tier1LeveragePct", fdicField: "IDT1CER" },
  { metric: "cet1RatioPct", fdicField: "RBCT1J" },
  { metric: "tier1RiskBasedPct", fdicField: "IDT1RWAJR" },
  { metric: "totalRiskBasedPct", fdicField: "RBCRWAJ" },
  {
    metric: "equityCapitalRatioPct",
    fdicField: "EQV",
    fallback: {
      fields: ["EQTOT", "ASSET"],
      formula: "EQTOT / ASSET * 100",
      compute: (raw) => safeDivPct(asNumber(raw.EQTOT), asNumber(raw.ASSET)),
    },
  },
  { metric: "roaPct", fdicField: "ROA" },
  { metric: "roePct", fdicField: "ROE" },
  { metric: "netInterestMarginPct", fdicField: "NIMY" },
  { metric: "efficiencyRatioPct", fdicField: "EEFFR" },
  { metric: "pretaxRoaPct", fdicField: "ROAPTX" },
  { metric: "loanToDepositPct", fdicField: "LNLSDEPR" },
  { metric: "domesticDepositsToAssetsPct", fdicField: "DEPDASTR" },
  { metric: "brokeredDepositsSharePct", fdicField: "BROR" },
  { metric: "cashAndDueToAssetsPct", fdicField: "CHBALR" },
  { metric: "noncurrentLoansPct", fdicField: "NCLNLSR" },
  { metric: "netChargeOffsPct", fdicField: "NTLNLSR" },
  { metric: "reserveCoveragePct", fdicField: "LNRESNCR" },
  { metric: "noncurrentAssetsPct", fdicField: "NPERFV" },
  { metric: "provisionToLoansPct", fdicField: "ELNATRY" },
];

export function extractCanonicalMetrics(raw: Record<string, unknown>): MetricExtractionResult {
  const metrics = {} as CanonicalMetrics;
  const provenance: MetricProvenance = {};
  const dataGaps: DataGap[] = [];

  // Process direct mappings (with optional fallback derivation)
  for (const mapping of DIRECT_MAPPINGS) {
    const directValue = asNumber(raw[mapping.fdicField]);
    if (directValue !== null) {
      (metrics as Record<string, unknown>)[mapping.metric] = directValue;
      provenance[mapping.metric] = { source: "direct", fdicField: mapping.fdicField };
    } else if (mapping.fallback) {
      const derived = mapping.fallback.compute(raw);
      (metrics as Record<string, unknown>)[mapping.metric] = derived;
      if (derived !== null) {
        provenance[mapping.metric] = { source: "derived", formula: mapping.fallback.formula };
      } else {
        dataGaps.push({ metric: mapping.metric, reason: `Missing field(s): ${mapping.fdicField} and fallback fields ${mapping.fallback.fields.join(", ")}` });
      }
    } else {
      (metrics as Record<string, unknown>)[mapping.metric] = null;
      dataGaps.push({ metric: mapping.metric, reason: `Missing field: ${mapping.fdicField}` });
    }
  }

  // Derived-only metrics (no direct FDIC field)
  const asset = asNumber(raw.ASSET);
  const coredep = asNumber(raw.COREDEP);
  const sc = asNumber(raw.SC);
  const asstlt = asNumber(raw.ASSTLT);
  const votefund = asNumber(raw.VOTEFUND);

  metrics.coreDepositsToAssetsPct = safeDivPct(coredep, asset);
  if (metrics.coreDepositsToAssetsPct !== null) {
    provenance.coreDepositsToAssetsPct = { source: "derived", formula: "COREDEP / ASSET * 100" };
  } else {
    dataGaps.push({ metric: "coreDepositsToAssetsPct", reason: "Missing COREDEP or ASSET" });
  }

  metrics.securitiesToAssetsPct = safeDivPct(sc, asset);
  if (metrics.securitiesToAssetsPct !== null) {
    provenance.securitiesToAssetsPct = { source: "derived", formula: "SC / ASSET * 100" };
  } else {
    dataGaps.push({ metric: "securitiesToAssetsPct", reason: "Missing SC or ASSET" });
  }

  metrics.longTermAssetsPct = safeDivPct(asstlt, asset);
  if (metrics.longTermAssetsPct !== null) {
    provenance.longTermAssetsPct = { source: "derived", formula: "ASSTLT / ASSET * 100" };
  } else {
    dataGaps.push({ metric: "longTermAssetsPct", reason: "Missing ASSTLT or ASSET" });
  }

  metrics.volatileLiabilitiesToAssetsPct = safeDivPct(votefund, asset);
  if (metrics.volatileLiabilitiesToAssetsPct !== null) {
    provenance.volatileLiabilitiesToAssetsPct = { source: "derived", formula: "VOTEFUND / ASSET * 100" };
  } else {
    dataGaps.push({ metric: "volatileLiabilitiesToAssetsPct", reason: "Missing VOTEFUND or ASSET" });
  }

  return { metrics, provenance, dataGaps };
}

/**
 * Bridge: convert CanonicalMetrics to the legacy CamelsMetrics shape
 * for backward compatibility with existing scoring logic.
 */
export function toLegacyCamelsMetrics(
  cm: CanonicalMetrics,
  nim4qChange: number | null,
): import("./camelsScoring.js").CamelsMetrics {
  return {
    equity_ratio: cm.equityCapitalRatioPct,
    tier1_leverage: cm.tier1LeveragePct,
    tier1_rbc: cm.tier1RiskBasedPct,
    noncurrent_assets_ratio: cm.noncurrentAssetsPct,
    noncurrent_loans_ratio: cm.noncurrentLoansPct,
    net_chargeoff_ratio: cm.netChargeOffsPct,
    reserve_to_loans: null, // LNATRESR — not in canonical set as a ratio, kept for compat
    reserve_coverage: cm.reserveCoveragePct,
    provision_ratio: cm.provisionToLoansPct,
    roa: cm.roaPct,
    roe: cm.roePct,
    nim: cm.netInterestMarginPct,
    efficiency_ratio: cm.efficiencyRatioPct,
    pretax_roa: cm.pretaxRoaPct,
    noninterest_income_share: null, // Derived in legacy; not canonical
    loan_to_deposit: cm.loanToDepositPct,
    deposits_to_assets: cm.domesticDepositsToAssetsPct,
    core_deposit_ratio: cm.coreDepositsToAssetsPct,
    brokered_deposit_ratio: cm.brokeredDepositsSharePct,
    cash_ratio: cm.cashAndDueToAssetsPct,
    securities_to_assets: cm.securitiesToAssetsPct,
    nim_4q_change: nim4qChange,
  };
}
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run tests/metricNormalization.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/tools/shared/metricNormalization.ts tests/metricNormalization.test.ts
git commit -m "feat: add canonical metric normalization layer with provenance"
```

---

## Task 2: PCA Capital Categorization

**Files:**
- Create: `src/tools/shared/capitalClassification.ts`
- Test: `tests/capitalClassification.test.ts`

### Step 1: Write failing tests

```typescript
// tests/capitalClassification.test.ts
import { describe, expect, it } from "vitest";
import {
  classifyCapital,
  type CapitalClassification,
} from "../src/tools/shared/capitalClassification.js";

describe("classifyCapital", () => {
  it("classifies well capitalized", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 12.0, tier1RiskBasedPct: 10.0,
      cet1RatioPct: 8.0, tier1LeveragePct: 7.0,
    });
    expect(result.category).toBe("well_capitalized");
  });

  it("classifies adequately capitalized (meets minimums but not all well-cap thresholds)", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 9.0, tier1RiskBasedPct: 7.0,
      cet1RatioPct: 5.0, tier1LeveragePct: 4.5,
    });
    expect(result.category).toBe("adequately_capitalized");
  });

  it("classifies undercapitalized", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 7.5, tier1RiskBasedPct: 5.5,
      cet1RatioPct: 4.0, tier1LeveragePct: 3.5,
    });
    expect(result.category).toBe("undercapitalized");
  });

  it("classifies significantly undercapitalized", () => {
    const result = classifyCapital({
      totalRiskBasedPct: 5.5, tier1RiskBasedPct: 3.5,
      cet1RatioPct: 2.5, tier1LeveragePct: 2.5,
    });
    expect(result.category).toBe("significantly_undercapitalized");
  });

  it("handles null metrics gracefully with provenance note", () => {
    const result = classifyCapital({
      totalRiskBasedPct: null, tier1RiskBasedPct: null,
      cet1RatioPct: null, tier1LeveragePct: 7.0,
    });
    // With only leverage available and it's above 5%, at least not undercapitalized
    expect(result.category).toBe("indeterminate");
    expect(result.dataGaps.length).toBeGreaterThan(0);
  });
});
```

### Step 2: Implement PCA categorization

Implement `classifyCapital()` using the official PCA thresholds from the spec:
- well_capitalized: all four ratios above thresholds (10/8/6.5/5)
- adequately_capitalized: all four above lower thresholds (8/6/4.5/4)
- undercapitalized: any below adequately_capitalized
- significantly_undercapitalized: any ratio < 6/4/3/3
- critically_undercapitalized: tangible equity / assets <= 2% if computable
- indeterminate: too many missing ratios to classify

### Step 3: Run tests, commit

```bash
git add src/tools/shared/capitalClassification.ts tests/capitalClassification.test.ts
git commit -m "feat: add PCA-style capital categorization"
```

---

## Task 3: Enhanced Trend Engine

**Files:**
- Create: `src/tools/shared/trendEngine.ts`
- Test: `tests/trendEngine.test.ts`

Extract and enhance the existing `analyzeTrend` from camelsScoring.ts into a richer engine.

### New capabilities vs existing:
- Prior-quarter comparison
- Same-quarter-prior-year comparison
- Trailing 4-quarter slope
- `consecutive_worsening` flag
- `reversal` flag
- History-event awareness (merger/charter change annotation)
- Data-quality flags for stale periods

### Step 1: Write failing tests for enhanced trend engine

Test: direction, magnitude, consecutive_worsening, reversal detection, stale-period flagging, missing data handling (require >=2 valid points).

### Step 2: Implement `src/tools/shared/trendEngine.ts`

Keep the existing `analyzeTrend` signature working (backward compat) but add new `analyzeTrendEnhanced` with richer output. Export both.

### Step 3: Run tests, commit

```bash
git commit -m "feat: add enhanced trend engine with worsening and reversal flags"
```

---

## Task 4: Peer Engine

**Files:**
- Create: `src/tools/shared/peerEngine.ts`
- Test: `tests/peerEngine.test.ts`

### Key exports:
- `buildPeerFilters(subject, options)` — constructs FDIC API filters with progressive broadening
- `computePeerStats(subjectValue, peerValues)` — median, percentile, robust z-score (MAD-based), outlier flag
- `computeWeightedAggregate(entries, metricField, weightField)` — weighted ratio aggregation
- `PeerContext` interface with peer_definition, peer_count, broadening_steps, subject_percentiles

### Tests:
- Percentile computation (edge cases: 1 peer, 100 peers, ties)
- Robust z-score (MAD-based, threshold >=2.5)
- Outlier detection
- Weighted aggregate vs simple average
- Filter broadening sequence

### Step 1-3: Write tests, implement, commit

```bash
git commit -m "feat: add peer engine with percentiles, robust z-score, and outlier detection"
```

---

## Task 5: Management Overlay

**Files:**
- Create: `src/tools/shared/managementOverlay.ts`
- Test: `tests/managementOverlay.test.ts`

### Key exports:
- `assessManagementOverlay(components, trends, riskSignals)` — returns `ManagementOverlay`
- `ManagementOverlay`: `{ level: "normal" | "watch" | "elevated_concern", reason_codes: string[], caps_band: boolean }`

### Logic:
- Raise to "watch" when: 2+ components weak, 2+ consecutive deteriorating trends, rapid growth with weaker capital
- Raise to "elevated_concern" when: 3+ components weak AND multiple deteriorating trends, or critical capital situation
- `caps_band: true` means overall band should be capped down one level

### Step 1-3: Write tests, implement, commit

```bash
git commit -m "feat: add management overlay with band-capping logic"
```

---

## Task 6: Unified Risk Signals

**Files:**
- Create: `src/tools/shared/riskSignalEngine.ts`
- Test: `tests/riskSignalEngine.test.ts`

Consolidate the risk signal classification from `riskSignals.ts::classifyRiskSignals` and `bankHealth.ts::collectRiskSignals` into a single, richer engine.

### Required signals (from spec):
- `capital_buffer_erosion`: capital above minimums but falling materially over 4Q
- `credit_deterioration`: noncurrent/chargeoffs rising 2+ periods + peer deterioration
- `earnings_pressure`: ROA declining 2+ periods or negative
- `margin_compression`: NIM decline YoY
- `funding_stress`: brokered/volatile funding rising, LTD stretched
- `merger_distorted_trend`: history event in lookback window
- `stale_reporting_period`: report date > freshness threshold

### Output:
```typescript
interface RiskSignalV2 {
  code: string;        // e.g., "capital_buffer_erosion"
  severity: "critical" | "warning" | "info";
  category: "capital" | "asset_quality" | "earnings" | "liquidity" | "sensitivity" | "data_quality";
  message: string;     // neutral, supervisory-safe phrasing
  metric_name?: string;
  metric_value?: number;
}
```

### Step 1-3: Write tests, implement, commit

```bash
git commit -m "feat: add unified risk signal engine"
```

---

## Task 7: Public Proxy Model Assembly

**Files:**
- Create: `src/tools/shared/publicCamelsProxy.ts`
- Test: `tests/publicCamelsProxy.test.ts`

The orchestration layer that assembles all the pieces into the `public_camels_proxy_v1` output model.

### Key exports:
```typescript
interface ProxyAssessment {
  model: "public_camels_proxy_v1";
  official_status: "public off-site proxy, not official CAMELS";
  overall: { score: number; band: "strong" | "satisfactory" | "weak" | "high_risk" };
  component_assessment: {
    capital: ComponentAssessment;
    asset_quality: ComponentAssessment;
    earnings: ComponentAssessment;
    liquidity_funding: ComponentAssessment;
    sensitivity_proxy: ComponentAssessment;
  };
  management_overlay: ManagementOverlay;
  capital_classification: CapitalClassification;
  key_metrics: CanonicalMetrics;
  risk_signals: RiskSignalV2[];
  trend_insights: EnhancedTrend[];
  data_quality: { report_date: string; staleness: string; gaps_count: number };
  provenance: MetricProvenance;
}

function assembleProxyAssessment(params: {
  canonicalMetrics: MetricExtractionResult;
  components: ComponentScore[];        // from existing scoring
  capitalClass: CapitalClassification;
  trends: EnhancedTrend[];
  riskSignals: RiskSignalV2[];
  managementOverlay: ManagementOverlay;
  repdte: string;
}): ProxyAssessment;
```

### Scoring:
- Component weights: capital 0.30, asset_quality 0.25, earnings 0.20, liquidity_funding 0.15, sensitivity_proxy 0.10
- Score range: 1 to 4 (NOT 1-5 like legacy)
- Band: strong >=3.25, satisfactory 2.50-3.25, weak 1.75-2.50, high_risk <1.75
- Management overlay caps band by one level when `caps_band: true`

### Step 1-3: Write tests, implement, commit

```bash
git commit -m "feat: add public CAMELS proxy model assembly"
```

---

## Task 8: Refactor bankHealth Tool

**Files:**
- Modify: `src/tools/bankHealth.ts`
- Modify: `tests/bankHealth.test.ts`

### Changes:
1. Import and use `extractCanonicalMetrics` + `toLegacyCamelsMetrics` instead of `computeCamelsMetrics`
2. Add proxy assessment to `structuredContent` alongside legacy fields
3. Use enhanced trend engine
4. Use unified risk signals
5. Use `getPriorQuarterDates` from a shared location (extract from duplication)
6. Keep existing HealthSummary shape intact for backward compat
7. Update text narrative to use supervisory-safe language

### structuredContent shape:
```typescript
{
  // NEW primary output
  ...proxyAssessment,

  // LEGACY compatibility fields (existing shape retained)
  institution: { ... },
  composite: { rating, label },
  components: ComponentScore[],
  trends: TrendAnalysis[],
  outliers: [],
  risk_signals: string[],
}
```

### Tests to add:
- Verify proxy model fields present in structuredContent
- Verify legacy fields still present
- Verify narrative does not contain "CAMELS rating" without "analytical" qualifier
- Verify provenance populated

### Step 1-3: Modify, test, commit

```bash
git commit -m "refactor: bankHealth tool uses unified proxy model with legacy compat"
```

---

## Task 9: Refactor peerHealth Tool

**Files:**
- Modify: `src/tools/peerHealth.ts`
- Modify or create: `tests/peerHealth.test.ts`

### Changes:
1. Use canonical metric layer
2. Add peer stats (median, percentiles, robust z-score) via peer engine
3. Add outlier flags per metric
4. Add `peer_context` block to structuredContent:
   ```
   peer_context: { peer_count, peer_definition, subject_rank, subject_percentiles, broadening_steps }
   ```
5. Add component-level comparison (not just composite ordering)
6. Keep existing PeerHealthEntry shape for compat

### Step 1-3: Modify, test, commit

```bash
git commit -m "refactor: peerHealth tool adds percentiles, z-scores, and outlier flags"
```

---

## Task 10: Refactor riskSignals Tool

**Files:**
- Modify: `src/tools/riskSignals.ts`
- Modify: `tests/riskSignals.test.ts`

### Changes:
1. Delegate to unified risk signal engine
2. Add the new signal codes from Task 6
3. Add `data_quality` and `provenance` to structuredContent
4. Keep existing response shape (institutions_scanned, institutions_flagged, etc.)

### Step 1-3: Modify, test, commit

```bash
git commit -m "refactor: riskSignals tool uses unified risk signal engine"
```

---

## Task 11: Light Refactor of Analysis/PeerGroup Tools

**Files:**
- Modify: `src/tools/analysis.ts`
- Modify: `src/tools/peerGroup.ts`
- Modify: `src/tools/shared/queryUtils.ts` (extract shared `getPriorQuarterDates`)

### Changes:
- Extract `getPriorQuarterDates` to queryUtils.ts (currently duplicated in bankHealth + riskSignals)
- Have analysis.ts and peerGroup.ts use canonical metric extraction where it reduces duplication
- Do NOT rewrite — just reduce shared code duplication

### Step 1-3: Move shared utils, update imports, verify all tests pass

```bash
git commit -m "refactor: extract getPriorQuarterDates to shared queryUtils"
```

---

## Task 12: Documentation and Spec Sync

**Files:**
- Modify: `reference/specification.md`
- Modify: `reference/architecture.md`
- Modify: `docs/tool-reference.md`
- Modify: `docs/usage-examples.md`
- Modify: `docs/prompting-guide.md`
- Modify: `README.md`

### Changes:

1. **specification.md**: Add all 23 tools to the tool surface list (currently only lists 12). Document the public proxy model. Document data-date-basis rules.

2. **architecture.md**: Add shared analysis engine section describing the `src/tools/shared/` modules and their dependencies.

3. **tool-reference.md**: Update health/risk tool descriptions to reference the proxy model. Add "public off-site proxy" caveat.

4. **usage-examples.md**: Add 3 examples:
   - Single bank health assessment with proxy model
   - Peer health comparison with percentiles
   - Trend/risk-signal scan

5. **prompting-guide.md**: Add guidance for the proxy model. Note that outputs are not official CAMELS.

6. **README.md**: Sync tool list. Add the public-proxy-not-CAMELS caveat.

### Step 1-3: Update all docs, verify docs-site test, commit

```bash
git commit -m "docs: sync specification, architecture, and guides with proxy model"
```

---

## Validation Checklist

After all tasks:

```bash
npm run typecheck    # zero errors
npm test             # all tests pass
npm run build        # build succeeds
```

Verify:
- [ ] All 5 existing tool names unchanged
- [ ] Legacy structuredContent fields preserved
- [ ] New proxy model present in bankHealth output
- [ ] Narrative never says "CAMELS rating" without "analytical assessment" qualifier
- [ ] Provenance populated for all metrics
- [ ] PCA capital categorization correct for all 5 levels
- [ ] Peer percentiles and outlier flags present in peerHealth
- [ ] Risk signals use new unified codes
- [ ] Docs list all 23 tools
- [ ] Management overlay caps band correctly
