import { describe, expect, it } from "vitest";
import {
  extractCanonicalMetrics,
  toLegacyCamelsMetrics,
  CANONICAL_FIELDS,
  FIELD_ALIASES,
  type CanonicalMetrics,
} from "../src/tools/shared/metricNormalization.js";
import { CAMELS_FIELDS } from "../src/tools/shared/camelsScoring.js";

describe("extractCanonicalMetrics", () => {
  it("extracts metrics from FDIC record using direct fields", () => {
    const raw: Record<string, unknown> = {
      ASSET: 500000, DEP: 400000, DEPDOM: 380000,
      EQTOT: 50000, NETINC: 5000,
      IDT1CER: 9.5, IDT1RWAJR: 14.2, EQV: 10.0,
      ROA: 1.0, ROE: 10.0, NIMY: 3.5, EEFFR: 60.0, ROAPTX: 1.2,
      LNLSDEPR: 80.0, DEPDASTR: 76.0,
      COREDEP: 350000, BROR: 5.0, CHBALR: 8.0,
      NCLNLSR: 1.0, NTLNLSR: 0.3, NPERFV: 0.5, LNRESNCR: 120.0, ELNATRY: 0.4,
      SC: 100000,
    };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.totalAssets).toBe(500000);
    expect(result.metrics.tier1LeveragePct).toBe(9.5);
    expect(result.metrics.roaPct).toBe(1.0);
    expect(result.metrics.netInterestMarginPct).toBe(3.5);
    expect(result.metrics.equityCapitalRatioPct).toBe(10.0);
    expect(result.metrics.loanToDepositPct).toBe(80.0);
    expect(result.metrics.coreDepositsToAssetsPct).toBe(70.0); // 350000/500000*100
    expect(result.metrics.securitiesToAssetsPct).toBe(20.0); // 100000/500000*100
    expect(result.provenance.roaPct?.source).toBe("direct");
    expect(result.provenance.roaPct?.fdicField).toBe("ROA");
    expect(result.provenance.coreDepositsToAssetsPct?.source).toBe("derived");
  });

  it("derives equityCapitalRatioPct when EQV is missing", () => {
    const raw: Record<string, unknown> = { EQTOT: 50000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.equityCapitalRatioPct).toBe(10.0);
    expect(result.provenance.equityCapitalRatioPct?.source).toBe("derived");
    expect(result.provenance.equityCapitalRatioPct?.formula).toContain("EQTOT / ASSET");
  });

  it("prefers direct EQV over derivation when both available", () => {
    const raw: Record<string, unknown> = { EQV: 11.0, EQTOT: 50000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.equityCapitalRatioPct).toBe(11.0);
    expect(result.provenance.equityCapitalRatioPct?.source).toBe("direct");
  });

  it("returns null with data gaps for all missing fields", () => {
    const result = extractCanonicalMetrics({});
    expect(result.metrics.totalAssets).toBeNull();
    expect(result.metrics.tier1LeveragePct).toBeNull();
    expect(result.metrics.roaPct).toBeNull();
    expect(result.dataGaps.length).toBeGreaterThan(0);
  });

  it("falls back to alias fields when primary is missing", () => {
    // NIMY is the primary field for NIM; NIM is the alias
    const raw: Record<string, unknown> = { NIM: 3.2 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.netInterestMarginPct).toBe(3.2);
    expect(result.provenance.netInterestMarginPct?.source).toBe("direct");
    expect(result.provenance.netInterestMarginPct?.fdicField).toBe("NIM");
  });

  it("prefers primary field over alias when both present", () => {
    const raw: Record<string, unknown> = { NIMY: 3.5, NIM: 3.2 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.netInterestMarginPct).toBe(3.5);
    expect(result.provenance.netInterestMarginPct?.fdicField).toBe("NIMY");
  });

  it("handles division by zero in derived metrics", () => {
    const raw: Record<string, unknown> = { COREDEP: 350000, ASSET: 0 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.coreDepositsToAssetsPct).toBeNull();
  });

  it("derives borrowedFundsToAssetsPct from OTHBRF/ASSET", () => {
    const raw: Record<string, unknown> = { OTHBRF: 25000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.borrowedFundsToAssetsPct).toBeCloseTo(5.0, 1);
    expect(result.provenance.borrowedFundsToAssetsPct?.source).toBe("derived");
    expect(result.provenance.borrowedFundsToAssetsPct?.formula).toContain("OTHBRF / ASSET");
  });

  it("computes coreDepositsToDepositsPct from COREDEP/DEP", () => {
    const raw: Record<string, unknown> = { COREDEP: 350000, DEP: 400000, ASSET: 500000 };
    const result = extractCanonicalMetrics(raw);
    expect(result.metrics.coreDepositsToDepositsPct).toBeCloseTo(87.5, 1);
    expect(result.metrics.coreDepositsToAssetsPct).toBeCloseTo(70.0, 1);
  });
});

describe("toLegacyCamelsMetrics", () => {
  it("maps canonical metrics to legacy CamelsMetrics shape", () => {
    const cm: CanonicalMetrics = {
      totalAssets: 500000, totalDeposits: 400000, domesticDeposits: 380000,
      equityCapital: 50000, netIncome: 5000,
      tier1LeveragePct: 9.5, cet1RatioPct: 8.0, tier1RiskBasedPct: 14.2,
      totalRiskBasedPct: 15.0, equityCapitalRatioPct: 10.0,
      roaPct: 1.0, roePct: 10.0, netInterestMarginPct: 3.5,
      efficiencyRatioPct: 60.0, pretaxRoaPct: 1.2,
      loanToDepositPct: 80.0, domesticDepositsToAssetsPct: 76.0,
      coreDepositsToAssetsPct: 70.0, coreDepositsToDepositsPct: 87.5,
      brokeredDepositsSharePct: 5.0, cashAndDueToAssetsPct: 8.0,
      noncurrentLoansPct: 1.0, netChargeOffsPct: 0.3,
      reserveCoveragePct: 120.0, noncurrentAssetsPct: 0.5, provisionToLoansPct: 0.4,
      securitiesToAssetsPct: 20.0, longTermAssetsPct: null,
      volatileLiabilitiesToAssetsPct: null, borrowedFundsToAssetsPct: null,
    };
    const legacy = toLegacyCamelsMetrics(cm, -0.15);
    expect(legacy.tier1_leverage).toBe(9.5);
    expect(legacy.roa).toBe(1.0);
    expect(legacy.nim).toBe(3.5);
    expect(legacy.nim_4q_change).toBe(-0.15);
    expect(legacy.reserve_to_loans).toBeNull(); // compat stub
    expect(legacy.noninterest_income_share).toBeNull(); // not canonical
  });

  it("maps core_deposit_ratio from deposits-based metric, not assets-based", () => {
    const cm: CanonicalMetrics = {
      totalAssets: 500000, totalDeposits: 400000, domesticDeposits: 380000,
      equityCapital: 50000, netIncome: 5000,
      tier1LeveragePct: 9.5, cet1RatioPct: 8.0, tier1RiskBasedPct: 14.2,
      totalRiskBasedPct: 15.0, equityCapitalRatioPct: 10.0,
      roaPct: 1.0, roePct: 10.0, netInterestMarginPct: 3.5,
      efficiencyRatioPct: 60.0, pretaxRoaPct: 1.2,
      loanToDepositPct: 80.0, domesticDepositsToAssetsPct: 76.0,
      coreDepositsToAssetsPct: 70.0, coreDepositsToDepositsPct: 87.5,
      brokeredDepositsSharePct: 5.0, cashAndDueToAssetsPct: 8.0,
      noncurrentLoansPct: 1.0, netChargeOffsPct: 0.3,
      reserveCoveragePct: 120.0, noncurrentAssetsPct: 0.5, provisionToLoansPct: 0.4,
      securitiesToAssetsPct: 20.0, longTermAssetsPct: null,
      volatileLiabilitiesToAssetsPct: null, borrowedFundsToAssetsPct: null,
    };
    const legacy = toLegacyCamelsMetrics(cm, null);
    expect(legacy.core_deposit_ratio).toBeCloseTo(87.5, 1);
  });
});

describe("FIELD_ALIASES", () => {
  it("defines aliases for key metrics", () => {
    expect(FIELD_ALIASES.NIMY).toContain("NIM");
    expect(FIELD_ALIASES.IDT1CER).toBeDefined();
    expect(FIELD_ALIASES.ROA).toBeDefined();
  });
});

describe("CANONICAL_FIELDS", () => {
  it("is a non-empty comma-separated string", () => {
    expect(CANONICAL_FIELDS).toContain("CERT");
    expect(CANONICAL_FIELDS).toContain("ASSET");
    expect(CANONICAL_FIELDS).toContain("ROA");
    expect(CANONICAL_FIELDS.split(",").length).toBeGreaterThan(25);
  });

  it("is a superset of CAMELS_FIELDS and includes proxy-specific fields", () => {
    const canonicalSet = new Set(CANONICAL_FIELDS.split(","));
    const camelsArr = CAMELS_FIELDS.split(",");
    for (const field of camelsArr) {
      expect(canonicalSet.has(field), `CANONICAL_FIELDS missing CAMELS field: ${field}`).toBe(true);
    }
    // Proxy-specific fields required for capital classification, sensitivity, and liquidity
    for (const field of ["RBCT1J", "RBCRWAJ", "ASSTLT", "VOLIAB", "DEPDOM", "OTHBRF"]) {
      expect(canonicalSet.has(field), `CANONICAL_FIELDS missing proxy field: ${field}`).toBe(true);
    }
  });
});
