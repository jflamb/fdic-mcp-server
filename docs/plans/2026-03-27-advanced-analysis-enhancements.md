# Advanced Analysis Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the FDIC MCP server's analytical capabilities with five new feature tracks: granular Call Report detail tools, UBPR-equivalent ratio analysis, SOD-based market share analysis, holding-company subsidiary profiling, and macro/regional overlay context.

**Architecture:** Each track adds 1–2 new MCP tools following the existing registration pattern (`server.registerTool` with Zod schema, text + structuredContent output, `formatToolError` wrapping). Shared computation lives in `src/tools/shared/` as pure functions. Tracks 1–3 use only the existing FDIC BankFind API. Track 4 uses FDIC institution fields for the MVP and stubs a future FRB NIC integration. Track 5 introduces a new external service client for the FRED API.

**Tech Stack:** TypeScript, Zod, MCP SDK (`server.registerTool`), vitest, axios (already a dependency). One new optional dependency: none for Tracks 1–4; FRED API access for Track 5 (public, no key required for low-volume use; optional `FRED_API_KEY` env var for higher rate limits).

---

## Dependency Graph

```
Track 1 (Call Report Detail)  ─── independent ───┐
Track 2 (UBPR Ratios)         ─── independent ───┤
Track 3 (SOD Market Share)    ─── independent ───┼── all can be built in parallel
Track 4 (Holding Company)     ─── independent ───┤
Track 5 (Macro/Regional)      ─── independent ───┘
```

All five tracks are independent. They share only the existing `fdicClient.ts` service and `queryUtils.ts` helpers. No cross-track dependencies.

---

## Track 1: Granular Call Report Detail Tools

### Motivation

The existing CAMELS tools use ~30 high-level financial ratios. The FDIC financials endpoint exposes 1,100+ Call Report fields including granular loan-type breakdowns, securities sub-categories, and detailed funding sources. Exposing these enables credit concentration analysis, securities portfolio assessment, and funding structure evaluation — all core components of off-site examination.

### New Tools

| Tool | Purpose |
|------|---------|
| `fdic_analyze_credit_concentration` | Loan portfolio breakdown by type (CRE, C&I, consumer, ag, RE) with concentration ratios and peer comparison |
| `fdic_analyze_funding_profile` | Deposit composition, wholesale funding reliance, FHLB advances, and funding stability metrics |
| `fdic_analyze_securities_portfolio` | Securities holdings by type, duration proxy, unrealized gains/losses, and concentration |

### Task 1.1: Credit Concentration Scoring Engine

**Files:**
- Create: `src/tools/shared/creditConcentration.ts`
- Test: `tests/creditConcentration.test.ts`

**Step 1: Write failing tests for credit metric computation**

```typescript
// tests/creditConcentration.test.ts
import { describe, expect, it } from "vitest";
import {
  computeCreditMetrics,
  scoreCreditConcentration,
  type CreditMetrics,
} from "../src/tools/shared/creditConcentration.js";

describe("computeCreditMetrics", () => {
  it("computes loan-type shares from raw FDIC fields", () => {
    const raw: Record<string, unknown> = {
      LNLSNET: 80000,  // Net loans & leases
      LNRE: 45000,      // Total real estate loans
      LNRERES: 20000,   // 1-4 family residential RE
      LNRECONS: 5000,   // Construction & land dev
      LNREMULT: 8000,   // Multifamily RE
      LNRENRES: 10000,  // Nonfarm nonresidential RE
      LNREAG: 2000,     // Farmland
      LNCI: 18000,      // Commercial & industrial
      LNCON: 10000,     // Consumer loans
      LNAG: 3000,       // Agricultural production
      LNOTH: 4000,      // All other loans
      ASSET: 120000,    // Total assets
      EQV: 10.5,        // Equity ratio
      EQTOT: 12600,     // Total equity capital
    };
    const m = computeCreditMetrics(raw);
    expect(m.total_loans).toBe(80000);
    expect(m.cre_to_total_loans).toBeCloseTo(28.75, 1); // (LNRECONS + LNREMULT + LNRENRES) / LNLSNET
    expect(m.cre_to_capital).toBeCloseTo(182.54, 0);    // CRE / EQTOT * 100
    expect(m.ci_share).toBeCloseTo(22.5, 1);            // LNCI / LNLSNET * 100
    expect(m.consumer_share).toBeCloseTo(12.5, 1);      // LNCON / LNLSNET * 100
    expect(m.residential_re_share).toBeCloseTo(25.0, 1); // LNRERES / LNLSNET * 100
    expect(m.ag_share).toBeCloseTo(3.75, 1);
    expect(m.loans_to_assets).toBeCloseTo(66.67, 1);
  });

  it("returns null for shares when total loans is zero or missing", () => {
    const m = computeCreditMetrics({ LNLSNET: 0, LNRE: 0 });
    expect(m.cre_to_total_loans).toBeNull();
    expect(m.ci_share).toBeNull();
  });

  it("flags CRE concentration exceeding 300% of capital threshold", () => {
    const signals = scoreCreditConcentration({
      total_loans: 80000,
      cre_to_total_loans: 45.0,
      cre_to_capital: 350.0,  // > 300% threshold (interagency guidance)
      construction_to_capital: 120.0, // > 100% threshold
      ci_share: 20.0,
      consumer_share: 10.0,
      residential_re_share: 20.0,
      ag_share: 5.0,
      loans_to_assets: 70.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "credit_concentration",
        message: expect.stringContaining("CRE"),
      }),
    );
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        category: "credit_concentration",
        message: expect.stringContaining("construction"),
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/creditConcentration.test.ts`
Expected: FAIL — module not found

**Step 3: Implement credit concentration engine**

```typescript
// src/tools/shared/creditConcentration.ts
import { asNumber } from "./queryUtils.js";

/** FDIC fields needed for credit concentration analysis. */
export const CREDIT_FIELDS =
  "CERT,REPDTE,ASSET,EQTOT,EQV,LNLSNET,LNRE,LNRERES,LNRECONS,LNREMULT,LNRENRES,LNREAG,LNRELOC,LNCI,LNCON,LNAG,LNOTH,LNREDOM,LNREFOR";

export interface CreditMetrics {
  total_loans: number | null;
  cre_to_total_loans: number | null;
  cre_to_capital: number | null;
  construction_to_capital: number | null;
  ci_share: number | null;
  consumer_share: number | null;
  residential_re_share: number | null;
  ag_share: number | null;
  loans_to_assets: number | null;
}

export interface CreditSignal {
  severity: "critical" | "warning" | "info";
  category: "credit_concentration";
  message: string;
}

function safePct(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

export function computeCreditMetrics(raw: Record<string, unknown>): CreditMetrics {
  const lnlsnet = asNumber(raw.LNLSNET);
  const lnrecons = asNumber(raw.LNRECONS);
  const lnremult = asNumber(raw.LNREMULT);
  const lnrenres = asNumber(raw.LNRENRES);
  const eqtot = asNumber(raw.EQTOT);
  const asset = asNumber(raw.ASSET);

  const cre = (lnrecons ?? 0) + (lnremult ?? 0) + (lnrenres ?? 0);
  const hasCre = lnrecons != null || lnremult != null || lnrenres != null;

  return {
    total_loans: lnlsnet,
    cre_to_total_loans: hasCre ? safePct(cre, lnlsnet) : null,
    cre_to_capital: hasCre ? safePct(cre, eqtot) : null,
    construction_to_capital: safePct(lnrecons, eqtot),
    ci_share: safePct(asNumber(raw.LNCI), lnlsnet),
    consumer_share: safePct(asNumber(raw.LNCON), lnlsnet),
    residential_re_share: safePct(asNumber(raw.LNRERES), lnlsnet),
    ag_share: safePct(asNumber(raw.LNAG), lnlsnet),
    loans_to_assets: safePct(lnlsnet, asset),
  };
}

/**
 * Evaluates credit concentration against interagency guidance thresholds.
 * 300% CRE-to-capital and 100% construction-to-capital are the key thresholds
 * from the 2006 interagency CRE guidance (OCC/FRB/FDIC).
 */
export function scoreCreditConcentration(m: CreditMetrics): CreditSignal[] {
  const signals: CreditSignal[] = [];
  if (m.cre_to_capital != null && m.cre_to_capital > 300) {
    signals.push({
      severity: "warning",
      category: "credit_concentration",
      message: `CRE concentration at ${m.cre_to_capital.toFixed(0)}% of capital (exceeds 300% interagency guidance threshold)`,
    });
  }
  if (m.construction_to_capital != null && m.construction_to_capital > 100) {
    signals.push({
      severity: "warning",
      category: "credit_concentration",
      message: `Construction & land development concentration at ${m.construction_to_capital.toFixed(0)}% of capital (exceeds 100% interagency guidance threshold)`,
    });
  }
  if (m.loans_to_assets != null && m.loans_to_assets > 80) {
    signals.push({
      severity: "info",
      category: "credit_concentration",
      message: `High loan-to-asset ratio at ${m.loans_to_assets.toFixed(1)}% — may limit liquidity flexibility`,
    });
  }
  return signals;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/creditConcentration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/shared/creditConcentration.ts tests/creditConcentration.test.ts
git commit -m "feat: add credit concentration scoring engine"
```

---

### Task 1.2: Funding Profile Scoring Engine

**Files:**
- Create: `src/tools/shared/fundingProfile.ts`
- Test: `tests/fundingProfile.test.ts`

**Step 1: Write failing tests for funding metrics**

```typescript
// tests/fundingProfile.test.ts
import { describe, expect, it } from "vitest";
import {
  computeFundingMetrics,
  scoreFundingRisks,
  type FundingMetrics,
} from "../src/tools/shared/fundingProfile.js";

describe("computeFundingMetrics", () => {
  it("computes deposit composition and wholesale funding reliance", () => {
    const raw: Record<string, unknown> = {
      DEP: 100000,
      COREDEP: 78000,
      DEPDOM: 95000,
      DEPFOR: 5000,
      BROR: 8.5,        // Brokered deposit ratio
      FREPP: 12000,     // FHLB advances
      ASSET: 120000,
      EINTEXP: 3500,
      DEPDASTR: 83.3,
      CHBALR: 6.0,
    };
    const m = computeFundingMetrics(raw);
    expect(m.core_deposit_ratio).toBeCloseTo(78.0, 1);
    expect(m.brokered_deposit_ratio).toBe(8.5);
    expect(m.wholesale_funding_ratio).toBeCloseTo(18.33, 1); // (DEP - COREDEP + FREPP) / ASSET
    expect(m.fhlb_to_assets).toBeCloseTo(10.0, 1);
    expect(m.foreign_deposit_share).toBeCloseTo(5.0, 1);
    expect(m.deposits_to_assets).toBeCloseTo(83.33, 1);
  });

  it("flags high wholesale funding reliance", () => {
    const signals = scoreFundingRisks({
      core_deposit_ratio: 55.0,
      brokered_deposit_ratio: 20.0,
      wholesale_funding_ratio: 35.0,
      fhlb_to_assets: 15.0,
      foreign_deposit_share: 2.0,
      deposits_to_assets: 80.0,
      cost_of_funds: null,
      cash_ratio: 4.0,
    });
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        message: expect.stringContaining("wholesale funding"),
      }),
    );
    expect(signals).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        message: expect.stringContaining("brokered"),
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fundingProfile.test.ts`
Expected: FAIL — module not found

**Step 3: Implement funding profile engine**

```typescript
// src/tools/shared/fundingProfile.ts
import { asNumber } from "./queryUtils.js";

export const FUNDING_FIELDS =
  "CERT,REPDTE,ASSET,DEP,DEPDOM,DEPFOR,COREDEP,BROR,FREPP,EFREPP,EINTEXP,DEPDASTR,CHBALR,LNLSDEPR";

export interface FundingMetrics {
  core_deposit_ratio: number | null;
  brokered_deposit_ratio: number | null;
  wholesale_funding_ratio: number | null;
  fhlb_to_assets: number | null;
  foreign_deposit_share: number | null;
  deposits_to_assets: number | null;
  cost_of_funds: number | null;
  cash_ratio: number | null;
}

export interface FundingSignal {
  severity: "critical" | "warning" | "info";
  category: "funding_risk";
  message: string;
}

function safePct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || d === 0) return null;
  return (n / d) * 100;
}

export function computeFundingMetrics(raw: Record<string, unknown>): FundingMetrics {
  const dep = asNumber(raw.DEP);
  const coredep = asNumber(raw.COREDEP);
  const frepp = asNumber(raw.FREPP);
  const asset = asNumber(raw.ASSET);

  const nonCoreDep = dep != null && coredep != null ? dep - coredep : null;
  const wholesaleNum =
    nonCoreDep != null || frepp != null
      ? (nonCoreDep ?? 0) + (frepp ?? 0)
      : null;

  return {
    core_deposit_ratio: safePct(coredep, dep),
    brokered_deposit_ratio: asNumber(raw.BROR),
    wholesale_funding_ratio: safePct(wholesaleNum, asset),
    fhlb_to_assets: safePct(frepp, asset),
    foreign_deposit_share: safePct(asNumber(raw.DEPFOR), dep),
    deposits_to_assets: safePct(dep, asset),
    cost_of_funds: null, // Derived from annualized interest expense / avg assets; needs prior-quarter
    cash_ratio: asNumber(raw.CHBALR),
  };
}

export function scoreFundingRisks(m: FundingMetrics): FundingSignal[] {
  const signals: FundingSignal[] = [];
  if (m.brokered_deposit_ratio != null && m.brokered_deposit_ratio > 15) {
    signals.push({
      severity: "warning",
      category: "funding_risk",
      message: `Brokered deposits at ${m.brokered_deposit_ratio.toFixed(1)}% of deposits — elevated reliance on rate-sensitive funding`,
    });
  }
  if (m.wholesale_funding_ratio != null && m.wholesale_funding_ratio > 25) {
    signals.push({
      severity: "warning",
      category: "funding_risk",
      message: `Wholesale funding at ${m.wholesale_funding_ratio.toFixed(1)}% of assets — may face refinancing risk in stressed markets`,
    });
  }
  if (m.core_deposit_ratio != null && m.core_deposit_ratio < 60) {
    signals.push({
      severity: "warning",
      category: "funding_risk",
      message: `Core deposits at only ${m.core_deposit_ratio.toFixed(1)}% of total deposits — below typical community bank levels`,
    });
  }
  if (m.fhlb_to_assets != null && m.fhlb_to_assets > 15) {
    signals.push({
      severity: "info",
      category: "funding_risk",
      message: `FHLB advances at ${m.fhlb_to_assets.toFixed(1)}% of assets — significant contingent borrowing reliance`,
    });
  }
  return signals;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fundingProfile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/shared/fundingProfile.ts tests/fundingProfile.test.ts
git commit -m "feat: add funding profile scoring engine"
```

---

### Task 1.3: Securities Portfolio Scoring Engine

**Files:**
- Create: `src/tools/shared/securitiesPortfolio.ts`
- Test: `tests/securitiesPortfolio.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/securitiesPortfolio.test.ts
import { describe, expect, it } from "vitest";
import {
  computeSecuritiesMetrics,
  scoreSecuritiesRisks,
} from "../src/tools/shared/securitiesPortfolio.js";

describe("computeSecuritiesMetrics", () => {
  it("computes portfolio composition and concentration", () => {
    const raw: Record<string, unknown> = {
      SC: 25000,         // Total securities
      SCRES: 12000,      // Residential MBS
      ASSET: 120000,
      EQTOT: 12600,
      SCAFS: 18000,      // Available-for-sale
      SCHTML: 7000,      // Held-to-maturity
    };
    const m = computeSecuritiesMetrics(raw);
    expect(m.securities_to_assets).toBeCloseTo(20.83, 1);
    expect(m.securities_to_capital).toBeCloseTo(198.41, 0);
    expect(m.mbs_share).toBeCloseTo(48.0, 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/securitiesPortfolio.test.ts`
Expected: FAIL

**Step 3: Implement securities portfolio engine**

Create `src/tools/shared/securitiesPortfolio.ts` following the same pattern as creditConcentration.ts — pure functions, `asNumber` for safe extraction, `safePct` for ratios.

Key FDIC fields: `SC` (total), `SCRES` (residential MBS), `SCAFS` (AFS book value), `SCHTML` (HTM book value), `ASSET`, `EQTOT`.

Scoring thresholds:
- Securities > 40% of assets → info (high concentration)
- Securities > 300% of capital → warning
- MBS > 60% of securities → info (interest rate risk concentration)

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/securitiesPortfolio.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/shared/securitiesPortfolio.ts tests/securitiesPortfolio.test.ts
git commit -m "feat: add securities portfolio scoring engine"
```

---

### Task 1.4: Credit Concentration Analysis Tool

**Files:**
- Create: `src/tools/creditConcentration.ts`
- Test: `tests/creditConcentrationTool.test.ts`
- Modify: `src/index.ts` (add registration)

**Step 1: Write failing test for tool output shape**

```typescript
// tests/creditConcentrationTool.test.ts
import { describe, expect, it } from "vitest";
import { formatCreditSummaryText } from "../src/tools/creditConcentration.js";

describe("formatCreditSummaryText", () => {
  it("produces human-readable credit concentration summary", () => {
    const text = formatCreditSummaryText({
      institution: { cert: 3511, name: "Test Bank", city: "Testville", state: "TX", total_assets: 120000, report_date: "20251231" },
      metrics: {
        total_loans: 80000,
        cre_to_total_loans: 28.75,
        cre_to_capital: 182.0,
        construction_to_capital: 40.0,
        ci_share: 22.5,
        consumer_share: 12.5,
        residential_re_share: 25.0,
        ag_share: 3.75,
        loans_to_assets: 66.67,
      },
      signals: [],
    });
    expect(text).toContain("Test Bank");
    expect(text).toContain("CRE");
    expect(text).toContain("28.7"); // CRE share
    expect(text).toContain("22.5"); // C&I share
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/creditConcentrationTool.test.ts`
Expected: FAIL

**Step 3: Implement the tool module**

Follow the `bankHealth.ts` pattern exactly:
1. Zod schema with `cert` (required), `repdte` (optional, defaults to latest quarter)
2. Fetch institution name from `INSTITUTIONS` endpoint
3. Fetch financials with `CREDIT_FIELDS` from `FINANCIALS` endpoint
4. Compute `creditMetrics` and `scoreCreditConcentration`
5. Format text summary + return `structuredContent`
6. Export `registerCreditConcentrationTools(server: McpServer)`

**Step 4: Register in index.ts**

Add to `src/index.ts`:
```typescript
import { registerCreditConcentrationTools } from "./tools/creditConcentration.js";
// ... in createServer():
registerCreditConcentrationTools(server);
```

**Step 5: Run tests and typecheck**

Run: `npm run typecheck && npx vitest run tests/creditConcentration*`
Expected: PASS

**Step 6: Commit**

```bash
git add src/tools/creditConcentration.ts tests/creditConcentrationTool.test.ts src/index.ts
git commit -m "feat: add fdic_analyze_credit_concentration tool"
```

---

### Task 1.5: Funding Profile Analysis Tool

**Files:**
- Create: `src/tools/fundingProfile.ts`
- Test: `tests/fundingProfileTool.test.ts`
- Modify: `src/index.ts`

Same pattern as Task 1.4 but using `FUNDING_FIELDS`, `computeFundingMetrics`, and `scoreFundingRisks`. Tool name: `fdic_analyze_funding_profile`.

**Steps:** (identical shape to 1.4 — write failing test for text formatter, implement tool module, register, typecheck, commit)

**Commit message:** `feat: add fdic_analyze_funding_profile tool`

---

### Task 1.6: Securities Portfolio Analysis Tool

**Files:**
- Create: `src/tools/securitiesPortfolio.ts`
- Test: `tests/securitiesPortfolioTool.test.ts`
- Modify: `src/index.ts`

Same pattern as Task 1.4. Tool name: `fdic_analyze_securities_portfolio`.

**Commit message:** `feat: add fdic_analyze_securities_portfolio tool`

---

## Track 2: UBPR-Equivalent Ratio Analysis

### Motivation

The FDIC off-site surveillance framework explicitly references UBPR analysis. UBPR ratios are derived from Call Report data, and the FDIC financials endpoint already exposes the underlying Call Report fields. Rather than integrating the FFIEC CDR API (which has limited public API access), we compute UBPR-equivalent ratios directly from FDIC data. This keeps the server dependency-free and produces ratios consistent with the Call Report data already being analyzed.

### Design Decision

**Option A (rejected):** Integrate FFIEC CDR API for official UBPR ratios.
- Pros: Exact UBPR values, blessed by FFIEC
- Cons: Separate API with limited public access, authentication complexity, data lag, new dependency

**Option B (chosen):** Compute UBPR-equivalent ratios from FDIC Call Report fields.
- Pros: Zero new dependencies, consistent data source, already have all input fields, works air-gapped
- Cons: Ratios are "equivalent" not "official" — must be clearly labeled as such

### New Tool

| Tool | Purpose |
|------|---------|
| `fdic_ubpr_analysis` | Compute UBPR-equivalent ratio groups with peer percentile context |

### UBPR Ratio Groups

The UBPR organizes ratios into pages. We implement the most analytically useful ones:

| UBPR Page | Key Ratios | FDIC Source Fields |
|-----------|-----------|-------------------|
| Summary Ratios | ROA, ROE, NIM, Efficiency, Asset Growth | ROA, ROE, NIMY, EEFFR, ASSET (current + prior) |
| Income & Expense | Interest Income/Avg Assets, NonII/Avg Assets, Provision/Avg Assets | INTINC, NONII, ELNATRY, ASSET |
| Loan Mix | RE/Total Loans, C&I/Total, Consumer/Total | LNRE, LNCI, LNCON, LNLSNET |
| Liquidity | Net Loans/Deposits, Core Dep/Assets, Volatile Liabilities | LNLSDEPR, COREDEP, ASSET, DEP, BROR |
| Capital | Tier 1 Leverage, Risk-Based Capital, Equity/Assets | IDT1CER, IDT1RWAJR, EQV |
| Growth Rates | Asset Growth, Loan Growth, Deposit Growth (YoY) | ASSET, LNLSNET, DEP (current + year-ago) |

### Task 2.1: UBPR Ratio Computation Engine

**Files:**
- Create: `src/tools/shared/ubprRatios.ts`
- Test: `tests/ubprRatios.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/ubprRatios.test.ts
import { describe, expect, it } from "vitest";
import {
  computeUbprRatios,
  computeGrowthRates,
  UBPR_FIELDS,
  type UbprRatioGroup,
} from "../src/tools/shared/ubprRatios.js";

describe("computeUbprRatios", () => {
  it("computes summary ratios from FDIC fields", () => {
    const raw: Record<string, unknown> = {
      ROA: 0.95, ROE: 9.5, NIMY: 3.4, EEFFR: 62.0,
      INTINC: 20000, NONII: 3000, ELNATRY: 0.35,
      ASSET: 120000, LNLSNET: 80000, DEP: 100000,
      LNRE: 45000, LNCI: 18000, LNCON: 10000,
      IDT1CER: 9.2, IDT1RWAJR: 14.1, EQV: 10.5,
      LNLSDEPR: 80.0, COREDEP: 78000, BROR: 4.5,
    };
    const groups = computeUbprRatios(raw);
    expect(groups.summary.roa).toBe(0.95);
    expect(groups.summary.roe).toBe(9.5);
    expect(groups.loan_mix.re_share).toBeCloseTo(56.25, 1);
    expect(groups.capital.tier1_leverage).toBe(9.2);
  });

  it("computes year-over-year growth rates", () => {
    const current: Record<string, unknown> = { ASSET: 120000, LNLSNET: 80000, DEP: 100000 };
    const prior: Record<string, unknown> = { ASSET: 110000, LNLSNET: 75000, DEP: 95000 };
    const growth = computeGrowthRates(current, prior);
    expect(growth.asset_growth).toBeCloseTo(9.09, 1);
    expect(growth.loan_growth).toBeCloseTo(6.67, 1);
    expect(growth.deposit_growth).toBeCloseTo(5.26, 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ubprRatios.test.ts`
Expected: FAIL

**Step 3: Implement UBPR ratio engine**

```typescript
// src/tools/shared/ubprRatios.ts
import { asNumber } from "./queryUtils.js";

export const UBPR_FIELDS =
  "CERT,REPDTE,ASSET,ROA,ROE,ROAPTX,NIMY,EEFFR,INTINC,EINTEXP,NONII,NONIX,NETINC,ELNATRY," +
  "LNLSNET,LNRE,LNCI,LNCON,LNAG,LNOTH,DEP,COREDEP,DEPDOM,DEPFOR,BROR,FREPP," +
  "IDT1CER,IDT1RWAJR,EQV,EQTOT,LNLSDEPR,DEPDASTR,CHBALR," +
  "NPERFV,NCLNLSR,NTLNLSR,LNATRESR,LNRESNCR,NTLNLSR,SC";

export interface UbprSummary {
  roa: number | null;
  roe: number | null;
  nim: number | null;
  efficiency_ratio: number | null;
  pretax_roa: number | null;
}

export interface UbprLoanMix {
  re_share: number | null;
  ci_share: number | null;
  consumer_share: number | null;
  ag_share: number | null;
}

export interface UbprCapital {
  tier1_leverage: number | null;
  tier1_rbc: number | null;
  equity_ratio: number | null;
}

export interface UbprLiquidity {
  loan_to_deposit: number | null;
  core_deposit_ratio: number | null;
  brokered_ratio: number | null;
  cash_ratio: number | null;
}

export interface UbprGrowth {
  asset_growth: number | null;
  loan_growth: number | null;
  deposit_growth: number | null;
}

export interface UbprRatioGroup {
  summary: UbprSummary;
  loan_mix: UbprLoanMix;
  capital: UbprCapital;
  liquidity: UbprLiquidity;
}

function safePct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || d === 0) return null;
  return (n / d) * 100;
}

export function computeUbprRatios(raw: Record<string, unknown>): UbprRatioGroup {
  const lnlsnet = asNumber(raw.LNLSNET);
  const dep = asNumber(raw.DEP);

  return {
    summary: {
      roa: asNumber(raw.ROA),
      roe: asNumber(raw.ROE),
      nim: asNumber(raw.NIMY),
      efficiency_ratio: asNumber(raw.EEFFR),
      pretax_roa: asNumber(raw.ROAPTX),
    },
    loan_mix: {
      re_share: safePct(asNumber(raw.LNRE), lnlsnet),
      ci_share: safePct(asNumber(raw.LNCI), lnlsnet),
      consumer_share: safePct(asNumber(raw.LNCON), lnlsnet),
      ag_share: safePct(asNumber(raw.LNAG), lnlsnet),
    },
    capital: {
      tier1_leverage: asNumber(raw.IDT1CER),
      tier1_rbc: asNumber(raw.IDT1RWAJR),
      equity_ratio: asNumber(raw.EQV),
    },
    liquidity: {
      loan_to_deposit: asNumber(raw.LNLSDEPR),
      core_deposit_ratio: safePct(asNumber(raw.COREDEP), dep),
      brokered_ratio: asNumber(raw.BROR),
      cash_ratio: asNumber(raw.CHBALR),
    },
  };
}

export function computeGrowthRates(
  current: Record<string, unknown>,
  prior: Record<string, unknown>,
): UbprGrowth {
  function yoyGrowth(field: string): number | null {
    const c = asNumber(current[field]);
    const p = asNumber(prior[field]);
    if (c == null || p == null || p === 0) return null;
    return ((c - p) / p) * 100;
  }
  return {
    asset_growth: yoyGrowth("ASSET"),
    loan_growth: yoyGrowth("LNLSNET"),
    deposit_growth: yoyGrowth("DEP"),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ubprRatios.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/shared/ubprRatios.ts tests/ubprRatios.test.ts
git commit -m "feat: add UBPR-equivalent ratio computation engine"
```

---

### Task 2.2: UBPR Analysis Tool with Peer Percentiles

**Files:**
- Create: `src/tools/ubprAnalysis.ts`
- Test: `tests/ubprAnalysis.test.ts`
- Modify: `src/index.ts`

**Step 1: Write failing test for tool formatting**

Test that the tool produces a multi-section text output with UBPR ratio groups, peer percentiles, and YoY growth rates.

**Step 2: Run test to verify it fails**

**Step 3: Implement tool module**

The tool accepts:
- `cert` (required): Target institution
- `repdte` (optional): Report date
- `peer_group` (optional): `"auto"` (default — same asset-size tier and charter) or `"state"` (same state) or `"national"` (all institutions)

Flow:
1. Fetch target institution's financials with `UBPR_FIELDS`
2. Fetch year-ago financials for growth rates
3. Build peer group using existing `peerGroup.ts` peer selection logic (asset range 50–200%, same charter class)
4. Compute UBPR ratios for target and all peers
5. Compute percentile ranks for each ratio
6. Format as UBPR-style report with peer context

Output `structuredContent`:
```typescript
{
  institution: { cert, name, report_date, total_assets },
  ratios: UbprRatioGroup,
  growth: UbprGrowth,
  peer_context: {
    peer_count: number,
    percentiles: Record<string, { value: number, percentile: number, peer_median: number }>,
  },
}
```

**Step 4: Register in index.ts**

**Step 5: Run full validation**

Run: `npm run typecheck && npx vitest run tests/ubprRatios* tests/ubprAnalysis*`

**Step 6: Commit**

```bash
git add src/tools/ubprAnalysis.ts tests/ubprAnalysis.test.ts src/index.ts
git commit -m "feat: add fdic_ubpr_analysis tool with peer percentiles"
```

---

## Track 3: SOD-Based Market Share Module

### Motivation

Branch deposit market share is the standard measure of a bank's franchise value and competitive position within a market. The FDIC Summary of Deposits (SOD) data is already available through the existing `fdic_search_sod` tool, but that tool only searches raw records. A market-share analysis tool aggregates deposits by market (MSA or county), computes each institution's share, calculates the Herfindahl-Hirschman Index (HHI) for market concentration, and ranks participants.

### New Tools

| Tool | Purpose |
|------|---------|
| `fdic_market_share_analysis` | Compute deposit market share, HHI, and competitive position for a given MSA or county |
| `fdic_franchise_footprint` | Map a single institution's branch network across markets with deposit share in each |

### Task 3.1: Market Share Computation Engine

**Files:**
- Create: `src/tools/shared/marketShare.ts`
- Test: `tests/marketShare.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/marketShare.test.ts
import { describe, expect, it } from "vitest";
import {
  computeMarketShare,
  computeHHI,
  rankInstitutions,
  type MarketParticipant,
} from "../src/tools/shared/marketShare.js";

describe("computeMarketShare", () => {
  const branches: Array<{ cert: number; name: string; deposits: number }> = [
    { cert: 1, name: "Big Bank", deposits: 500000 },
    { cert: 1, name: "Big Bank", deposits: 200000 },
    { cert: 2, name: "Mid Bank", deposits: 300000 },
    { cert: 3, name: "Small Bank", deposits: 100000 },
  ];

  it("aggregates deposits by institution", () => {
    const participants = computeMarketShare(branches);
    expect(participants).toHaveLength(3);
    const bigBank = participants.find((p) => p.cert === 1);
    expect(bigBank?.total_deposits).toBe(700000);
    expect(bigBank?.market_share).toBeCloseTo(63.64, 1);
    expect(bigBank?.branch_count).toBe(2);
  });

  it("sorts by deposits descending and assigns rank", () => {
    const participants = computeMarketShare(branches);
    expect(participants[0].cert).toBe(1);
    expect(participants[0].rank).toBe(1);
    expect(participants[1].rank).toBe(2);
  });
});

describe("computeHHI", () => {
  it("computes Herfindahl-Hirschman Index from market shares", () => {
    // 50%, 30%, 20% → 5000 + 900 + 400 = 3800 (highly concentrated)
    const hhi = computeHHI([50, 30, 20]);
    expect(hhi).toBe(3800);
  });

  it("classifies concentration levels per DOJ guidelines", () => {
    expect(computeHHI([10, 10, 10, 10, 10, 10, 10, 10, 10, 10])).toBe(1000); // Unconcentrated
    // HHI < 1500: unconcentrated
    // 1500-2500: moderately concentrated
    // > 2500: highly concentrated
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/marketShare.test.ts`

**Step 3: Implement market share engine**

```typescript
// src/tools/shared/marketShare.ts

export interface BranchRecord {
  cert: number;
  name: string;
  deposits: number;
}

export interface MarketParticipant {
  cert: number;
  name: string;
  total_deposits: number;
  branch_count: number;
  market_share: number;
  rank: number;
}

export interface MarketConcentration {
  hhi: number;
  classification: "unconcentrated" | "moderately_concentrated" | "highly_concentrated";
  total_deposits: number;
  institution_count: number;
}

export function computeMarketShare(branches: BranchRecord[]): MarketParticipant[] {
  const byInstitution = new Map<number, { name: string; deposits: number; branches: number }>();
  for (const b of branches) {
    const existing = byInstitution.get(b.cert);
    if (existing) {
      existing.deposits += b.deposits;
      existing.branches += 1;
    } else {
      byInstitution.set(b.cert, { name: b.name, deposits: b.deposits, branches: 1 });
    }
  }

  const totalDeposits = [...byInstitution.values()].reduce((sum, v) => sum + v.deposits, 0);

  const participants: MarketParticipant[] = [...byInstitution.entries()]
    .map(([cert, v]) => ({
      cert,
      name: v.name,
      total_deposits: v.deposits,
      branch_count: v.branches,
      market_share: totalDeposits > 0 ? (v.deposits / totalDeposits) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => b.total_deposits - a.total_deposits);

  participants.forEach((p, i) => { p.rank = i + 1; });
  return participants;
}

export function computeHHI(shares: number[]): number {
  return Math.round(shares.reduce((sum, s) => sum + s * s, 0));
}

export function classifyConcentration(hhi: number): MarketConcentration["classification"] {
  if (hhi >= 2500) return "highly_concentrated";
  if (hhi >= 1500) return "moderately_concentrated";
  return "unconcentrated";
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/tools/shared/marketShare.ts tests/marketShare.test.ts
git commit -m "feat: add market share and HHI computation engine"
```

---

### Task 3.2: Market Share Analysis Tool

**Files:**
- Create: `src/tools/marketShareAnalysis.ts`
- Test: `tests/marketShareAnalysis.test.ts`
- Modify: `src/index.ts`

**Step 1: Write failing test**

Test the text formatting function that produces a market summary with top-10 participants, HHI, and concentration classification.

**Step 2: Implement tool module**

Tool name: `fdic_market_share_analysis`

Input schema:
- `msa` (string, optional): MSA name filter (e.g., `"Dallas-Fort Worth-Arlington"`)
- `county` (string, optional): County name filter
- `state` (string, optional): State abbreviation (required if using county)
- `year` (number, optional): SOD report year (defaults to most recent)
- `cert` (number, optional): Highlight a specific institution in results

Flow:
1. Validate that at least `msa` or `county` + `state` is provided
2. Build SOD query filter: `MSANAMEBR:"..." AND YEAR:...` or `CNTYBR:"..." AND STALPBR:... AND YEAR:...`
3. Fetch all SOD records for the market (paginate with limit=10000, may need multiple pages for large MSAs)
4. Aggregate using `computeMarketShare()`
5. Compute HHI from market shares
6. If `cert` provided, highlight that institution's rank and share
7. Format text with top-20 participants, HHI classification, and YoY comparison if prior year available

**Step 3: Register and validate**

**Step 4: Commit**

```bash
git add src/tools/marketShareAnalysis.ts tests/marketShareAnalysis.test.ts src/index.ts
git commit -m "feat: add fdic_market_share_analysis tool"
```

---

### Task 3.3: Franchise Footprint Tool

**Files:**
- Create: `src/tools/franchiseFootprint.ts`
- Test: `tests/franchiseFootprint.test.ts`
- Modify: `src/index.ts`

Tool name: `fdic_franchise_footprint`

Input: `cert` (required), `year` (optional)

Flow:
1. Fetch all SOD branches for the institution: `CERT:{cert} AND YEAR:{year}`
2. Group branches by MSA (or county for non-MSA branches)
3. For each market, compute: branch count, total deposits, deposit share (requires fetching total market deposits per MSA)
4. Return a market-by-market franchise overview sorted by deposit size

This is the inverse view of market share — instead of "who's in this market?" it answers "where is this bank?"

**Commit message:** `feat: add fdic_franchise_footprint tool`

---

## Track 4: Holding Company Layer

### Motivation

Many FDIC-insured institutions are subsidiaries of multi-bank holding companies. Understanding the parent structure is essential for risk assessment — a weak subsidiary may be supported by a strong parent, or a strong subsidiary may be exposed to a troubled parent. The FDIC institutions endpoint already contains holding company fields (`NAMHCR`, `HCTMULT`), enabling an MVP without external API integration.

### Approach

**Phase 1 (this plan):** Use FDIC institution fields to group subsidiaries under holding companies, aggregate financial metrics across the consolidated entity, and identify multi-bank HCs.

**Phase 2 (future):** Integrate FRB NIC API for RSSD identifiers, Y-9C consolidated financials, and formal organizational hierarchy. This is out of scope for this plan but the architecture should accommodate it.

### New Tool

| Tool | Purpose |
|------|---------|
| `fdic_holding_company_profile` | Group subsidiary banks under their holding company, aggregate financials, compare sub performance |

### Task 4.1: Holding Company Aggregation Engine

**Files:**
- Create: `src/tools/shared/holdingCompany.ts`
- Test: `tests/holdingCompany.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/holdingCompany.test.ts
import { describe, expect, it } from "vitest";
import {
  groupByHoldingCompany,
  aggregateSubsidiaryMetrics,
  type SubsidiaryRecord,
} from "../src/tools/shared/holdingCompany.js";

describe("groupByHoldingCompany", () => {
  const institutions: SubsidiaryRecord[] = [
    { cert: 1, name: "Bank A", hc_name: "BigCorp HC", total_assets: 50000, total_deposits: 40000, roa: 1.0, equity_ratio: 10.0, state: "TX", active: true },
    { cert: 2, name: "Bank B", hc_name: "BigCorp HC", total_assets: 30000, total_deposits: 25000, roa: 0.8, equity_ratio: 9.0, state: "CA", active: true },
    { cert: 3, name: "Bank C", hc_name: "SmallCorp HC", total_assets: 10000, total_deposits: 8000, roa: 1.2, equity_ratio: 11.0, state: "TX", active: true },
  ];

  it("groups subsidiaries by holding company name", () => {
    const groups = groupByHoldingCompany(institutions);
    expect(groups).toHaveLength(2);
    const bigCorp = groups.find((g) => g.hc_name === "BigCorp HC");
    expect(bigCorp?.subsidiaries).toHaveLength(2);
  });

  it("aggregates total assets and deposits across subsidiaries", () => {
    const groups = groupByHoldingCompany(institutions);
    const bigCorp = groups.find((g) => g.hc_name === "BigCorp HC")!;
    const agg = aggregateSubsidiaryMetrics(bigCorp.subsidiaries);
    expect(agg.total_assets).toBe(80000);
    expect(agg.total_deposits).toBe(65000);
    expect(agg.weighted_roa).toBeCloseTo(0.925, 2); // asset-weighted
  });
});
```

**Step 2: Implement holding company engine**

```typescript
// src/tools/shared/holdingCompany.ts

export interface SubsidiaryRecord {
  cert: number;
  name: string;
  hc_name: string | null;
  total_assets: number;
  total_deposits: number;
  roa: number | null;
  equity_ratio: number | null;
  state: string;
  active: boolean;
}

export interface HoldingCompanyGroup {
  hc_name: string;
  subsidiaries: SubsidiaryRecord[];
}

export interface AggregateMetrics {
  total_assets: number;
  total_deposits: number;
  subsidiary_count: number;
  states: string[];
  weighted_roa: number | null;
  weighted_equity_ratio: number | null;
}

export function groupByHoldingCompany(institutions: SubsidiaryRecord[]): HoldingCompanyGroup[] {
  const byHC = new Map<string, SubsidiaryRecord[]>();
  for (const inst of institutions) {
    const key = inst.hc_name ?? "(Independent)";
    const existing = byHC.get(key) ?? [];
    existing.push(inst);
    byHC.set(key, existing);
  }
  return [...byHC.entries()]
    .map(([hc_name, subsidiaries]) => ({ hc_name, subsidiaries }))
    .sort((a, b) => {
      const aAssets = a.subsidiaries.reduce((s, i) => s + i.total_assets, 0);
      const bAssets = b.subsidiaries.reduce((s, i) => s + i.total_assets, 0);
      return bAssets - aAssets;
    });
}

export function aggregateSubsidiaryMetrics(subs: SubsidiaryRecord[]): AggregateMetrics {
  const totalAssets = subs.reduce((s, i) => s + i.total_assets, 0);
  const totalDeposits = subs.reduce((s, i) => s + i.total_deposits, 0);
  const states = [...new Set(subs.map((s) => s.state))].sort();

  let weightedRoa: number | null = null;
  if (totalAssets > 0) {
    const roaSum = subs.reduce((s, i) => s + (i.roa ?? 0) * i.total_assets, 0);
    weightedRoa = roaSum / totalAssets;
  }

  let weightedEquity: number | null = null;
  if (totalAssets > 0) {
    const eqSum = subs.reduce((s, i) => s + (i.equity_ratio ?? 0) * i.total_assets, 0);
    weightedEquity = eqSum / totalAssets;
  }

  return {
    total_assets: totalAssets,
    total_deposits: totalDeposits,
    subsidiary_count: subs.length,
    states,
    weighted_roa: weightedRoa,
    weighted_equity_ratio: weightedEquity,
  };
}
```

**Step 3: Run tests, commit**

```bash
git add src/tools/shared/holdingCompany.ts tests/holdingCompany.test.ts
git commit -m "feat: add holding company aggregation engine"
```

---

### Task 4.2: Holding Company Profile Tool

**Files:**
- Create: `src/tools/holdingCompanyProfile.ts`
- Test: `tests/holdingCompanyProfile.test.ts`
- Modify: `src/index.ts`

Tool name: `fdic_holding_company_profile`

Input schema:
- `hc_name` (string, optional): Holding company name to search (fuzzy — uses FDIC filter `NAMHCR:"..."`)
- `cert` (number, optional): Look up holding company of this institution, then profile the entire HC
- At least one of `hc_name` or `cert` required

FDIC institution fields to fetch:
```
CERT,REPDTE,ACTIVE,NAME,STALP,CITY,ASSET,DEP,NAMHCR,HCTMULT,SPECGRP,CHARTER_CLASS
```

Flow:
1. If `cert` provided, fetch institution to get `NAMHCR`, then search all institutions with that `NAMHCR`
2. If `hc_name` provided, search institutions with `NAMHCR:"<hc_name>"`
3. For each active subsidiary, fetch latest financials (ROA, equity ratio, NIM)
4. Group, aggregate, format

Output: HC name, total consolidated assets/deposits, subsidiary list with individual metrics, geographic footprint (states), and comparison table.

**Commit message:** `feat: add fdic_holding_company_profile tool`

---

## Track 5: Macro/Regional Overlays

### Motivation

Bank performance doesn't exist in a vacuum. A bank with rising noncurrent loans in a state experiencing an employment boom may have an idiosyncratic credit problem. The same metric in a state with surging unemployment may simply reflect the local economy. Overlaying macro and regional economic data provides crucial context for peer stress comparisons.

### External API: FRED (Federal Reserve Economic Data)

- **Base URL:** `https://api.stlouisfed.org/fred`
- **Authentication:** API key (free registration). Server works without a key for basic access but rate-limited. Optional `FRED_API_KEY` env var for production use.
- **Key series:**

| Series ID Pattern | Metric | Geography |
|-------------------|--------|-----------|
| `UNRATE` | National unemployment rate | US |
| `{STATE}UR` (e.g., `TXUR`) | State unemployment rate | State |
| `GDP` | National GDP growth | US |
| `{STATE}NGSP` (e.g., `TXNGSP`) | State GDP | State |
| `CSUSHPINSA` | Case-Shiller home price index | National |
| `{MSA}STHPI` | FHFA house price index | MSA |
| `FEDFUNDS` | Federal funds rate | National |

### Task 5.1: FRED API Client

**Files:**
- Create: `src/services/fredClient.ts`
- Test: `tests/fredClient.test.ts`

**Step 1: Write failing test for FRED series fetching**

```typescript
// tests/fredClient.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  buildFredUrl,
  parseFredResponse,
  type FredObservation,
} from "../src/services/fredClient.js";

describe("buildFredUrl", () => {
  it("constructs FRED API URL with series ID and date range", () => {
    const url = buildFredUrl("UNRATE", {
      start: "2024-01-01",
      end: "2024-12-31",
      apiKey: "test-key",
    });
    expect(url).toContain("series_id=UNRATE");
    expect(url).toContain("observation_start=2024-01-01");
    expect(url).toContain("api_key=test-key");
    expect(url).toContain("file_type=json");
  });

  it("omits api_key when not provided", () => {
    const url = buildFredUrl("UNRATE", { start: "2024-01-01", end: "2024-12-31" });
    expect(url).not.toContain("api_key");
  });
});

describe("parseFredResponse", () => {
  it("extracts observations from FRED JSON response", () => {
    const raw = {
      observations: [
        { date: "2024-01-01", value: "3.7" },
        { date: "2024-02-01", value: "3.9" },
        { date: "2024-03-01", value: "." }, // FRED uses "." for missing
      ],
    };
    const obs = parseFredResponse(raw);
    expect(obs).toHaveLength(2); // missing value filtered out
    expect(obs[0]).toEqual({ date: "2024-01-01", value: 3.7 });
    expect(obs[1]).toEqual({ date: "2024-02-01", value: 3.9 });
  });
});
```

**Step 2: Implement FRED client**

```typescript
// src/services/fredClient.ts
import axios from "axios";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

export interface FredObservation {
  date: string;
  value: number;
}

interface FredQueryOptions {
  start: string;
  end: string;
  apiKey?: string;
}

export function buildFredUrl(seriesId: string, opts: FredQueryOptions): string {
  const params = new URLSearchParams({
    series_id: seriesId,
    observation_start: opts.start,
    observation_end: opts.end,
    file_type: "json",
  });
  if (opts.apiKey) params.set("api_key", opts.apiKey);
  return `${FRED_BASE_URL}/series/observations?${params.toString()}`;
}

export function parseFredResponse(raw: unknown): FredObservation[] {
  const data = raw as { observations?: Array<{ date: string; value: string }> };
  if (!data.observations) return [];
  return data.observations
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: Number.parseFloat(o.value) }))
    .filter((o) => Number.isFinite(o.value));
}

export async function fetchFredSeries(
  seriesId: string,
  start: string,
  end: string,
): Promise<FredObservation[]> {
  const apiKey = process.env.FRED_API_KEY;
  const url = buildFredUrl(seriesId, { start, end, apiKey });
  const response = await axios.get(url, { timeout: 15_000 });
  return parseFredResponse(response.data);
}

/**
 * Maps a 2-letter state abbreviation to common FRED series IDs.
 */
export function stateFredSeries(state: string): { unemployment: string; gdp: string } {
  const st = state.toUpperCase();
  return {
    unemployment: `${st}UR`,
    gdp: `${st}NGSP`,
  };
}
```

**Step 3: Run tests, commit**

```bash
git add src/services/fredClient.ts tests/fredClient.test.ts
git commit -m "feat: add FRED API client for macro economic data"
```

---

### Task 5.2: Regional Context Computation Engine

**Files:**
- Create: `src/tools/shared/regionalContext.ts`
- Test: `tests/regionalContext.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/regionalContext.test.ts
import { describe, expect, it } from "vitest";
import {
  buildRegionalOverlay,
  assessMacroContext,
  type RegionalOverlay,
} from "../src/tools/shared/regionalContext.js";

describe("assessMacroContext", () => {
  it("classifies state unemployment trend", () => {
    const ctx = assessMacroContext({
      state_unemployment: [
        { date: "2024-09-01", value: 4.2 },
        { date: "2024-12-01", value: 4.8 },
        { date: "2025-03-01", value: 5.1 },
      ],
      national_unemployment: [
        { date: "2024-09-01", value: 3.8 },
        { date: "2024-12-01", value: 3.9 },
        { date: "2025-03-01", value: 4.0 },
      ],
      fed_funds: [
        { date: "2025-03-01", value: 5.25 },
      ],
    });
    expect(ctx.unemployment_trend).toBe("rising");
    expect(ctx.state_vs_national_unemployment).toBe("above"); // 5.1 > 4.0
    expect(ctx.rate_environment).toBe("elevated"); // > 4%
  });

  it("provides narrative context for bank analysis", () => {
    const ctx = assessMacroContext({
      state_unemployment: [{ date: "2025-03-01", value: 5.1 }],
      national_unemployment: [{ date: "2025-03-01", value: 4.0 }],
      fed_funds: [{ date: "2025-03-01", value: 5.25 }],
    });
    expect(ctx.narrative).toContain("unemployment");
    expect(ctx.narrative.length).toBeGreaterThan(50);
  });
});
```

**Step 2: Implement regional context engine**

Pure functions that take FRED observations and produce analytical context:
- Unemployment trend: rising/falling/stable (compare latest 3 observations)
- State vs national: above/below/at parity
- Rate environment: low (<2%), moderate (2-4%), elevated (>4%)
- Narrative: 2–3 sentence summary for inclusion in bank analysis reports

**Step 3: Run tests, commit**

```bash
git add src/tools/shared/regionalContext.ts tests/regionalContext.test.ts
git commit -m "feat: add regional economic context computation engine"
```

---

### Task 5.3: Regional Context Tool

**Files:**
- Create: `src/tools/regionalContext.ts`
- Test: `tests/regionalContextTool.test.ts`
- Modify: `src/index.ts`

Tool name: `fdic_regional_context`

Input schema:
- `cert` (number, optional): Institution CERT — auto-detects state from institution record
- `state` (string, optional): 2-letter state abbreviation (alternative to cert-based lookup)
- `repdte` (string, optional): Reference date for FRED lookback window

Flow:
1. Determine state (from cert lookup or direct input)
2. Compute date range: 2 years before repdte to repdte
3. Fetch FRED series in parallel: state unemployment, national unemployment, fed funds rate
4. Compute `assessMacroContext()`
5. Format text narrative with economic backdrop
6. Return `structuredContent` with raw observations and assessments

**Important:** The tool should gracefully degrade if the FRED API is unavailable (no API key, rate limited, network error). Return a structured error note in the output rather than failing the entire tool call — the bank analysis is still valuable without macro context.

```typescript
// Error handling pattern:
try {
  const observations = await fetchFredSeries(seriesId, start, end);
  // ... process
} catch {
  return {
    content: [{ type: "text", text: "⚠ FRED API unavailable — macro context omitted. Set FRED_API_KEY environment variable for reliable access." }],
    structuredContent: { error: "fred_unavailable", fallback: true },
  };
}
```

**Commit message:** `feat: add fdic_regional_context tool with FRED macro overlays`

---

## Track 6: Integration & Documentation

### Task 6.1: Update Documentation

**Files:**
- Modify: `docs/tool-reference.md`
- Modify: `docs/prompting-guide.md`
- Modify: `docs/usage-examples.md`

Add sections for each new tool following the existing documentation patterns. Include:
- Tool description and input parameters
- Example prompts
- Sample output snippets
- "Choosing the Right Tool" updates

### Task 6.2: Update Chat UI Suggested Prompts

**Files:**
- Modify: `chatbot/public/chatbot.js`

Add 2–3 new suggested prompts that leverage the new tools:
- "Analyze the credit concentration risk for Silicon Valley Bank"
- "Show me JPMorgan Chase's deposit market share in the Dallas MSA"
- "What's the macro economic context for banks in California?"

### Task 6.3: Release Notes

**Files:**
- Create or modify: `docs/release-notes/v1.3.0.md`

Draft release notes covering all new tools and capabilities.

### Task 6.4: Final Validation

Run full validation suite:
```bash
npm run typecheck
npm test
npm run build
```

Verify all new tools register correctly:
```bash
TRANSPORT=http PORT=3000 node dist/index.js &
# List tools via MCP protocol
curl http://localhost:3000/mcp -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## Summary

| Track | Tools Added | New Files | External APIs | Complexity |
|-------|-------------|-----------|---------------|------------|
| 1. Call Report Detail | 3 tools, 3 engines | 6 src + 6 test | None (FDIC financials) | Low-Medium |
| 2. UBPR Ratios | 1 tool, 1 engine | 2 src + 2 test | None (FDIC financials) | Medium |
| 3. SOD Market Share | 2 tools, 1 engine | 3 src + 3 test | None (FDIC SOD) | Medium |
| 4. Holding Company | 1 tool, 1 engine | 2 src + 2 test | None (FDIC institutions) | Medium |
| 5. Macro/Regional | 1 tool, 1 engine, 1 client | 3 src + 3 test | FRED API (optional) | Medium-High |
| 6. Integration | 0 | 0 new (modify 4-5) | None | Low |
| **Total** | **8 tools** | **16 src + 16 test** | **1 optional** | |

### Execution Order Recommendation

All tracks are independent, so they can be executed in parallel by separate agents. If executing sequentially, the recommended order is:

1. **Track 3** (SOD Market Share) — smallest surface area, highest standalone value
2. **Track 1** (Call Report Detail) — builds on existing patterns, three similar tools
3. **Track 2** (UBPR Ratios) — leverages Track 1 field knowledge
4. **Track 4** (Holding Company) — simple FDIC-only integration
5. **Track 5** (Macro/Regional) — new external dependency, most architectural novelty
6. **Track 6** (Integration) — after all tools are implemented
