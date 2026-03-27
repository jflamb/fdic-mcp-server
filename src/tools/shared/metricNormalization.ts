import { asNumber } from "./queryUtils.js";
import type { CamelsMetrics } from "./camelsScoring.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanonicalMetrics {
  // Amounts
  totalAssets: number | null;
  totalDeposits: number | null;
  domesticDeposits: number | null;
  equityCapital: number | null;
  netIncome: number | null;
  // Capital
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
  // Liquidity
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
  // Sensitivity
  securitiesToAssetsPct: number | null;
  longTermAssetsPct: number | null;
  volatileLiabilitiesToAssetsPct: number | null;
}

export interface MetricProvenanceEntry {
  source: "direct" | "derived";
  fdicField?: string;
  formula?: string;
}

export type MetricProvenance = Partial<
  Record<keyof CanonicalMetrics, MetricProvenanceEntry>
>;

export interface DataGap {
  metric: string;
  reason: string;
}

export interface MetricExtractionResult {
  metrics: CanonicalMetrics;
  provenance: MetricProvenance;
  dataGaps: DataGap[];
}

// ---------------------------------------------------------------------------
// Canonical FDIC fields
// ---------------------------------------------------------------------------

export const CANONICAL_FIELDS = [
  "CERT",
  "REPDTE",
  "ASSET",
  "DEP",
  "DEPDOM",
  "EQTOT",
  "EQV",
  "NETINC",
  "IDT1CER",
  "IDT1RWAJR",
  "RBCT1J",
  "RBCRWAJ",
  "ROA",
  "ROAPTX",
  "ROE",
  "NIMY",
  "EEFFR",
  "INTINC",
  "EINTEXP",
  "NONII",
  "NONIX",
  "LNLSDEPR",
  "DEPDASTR",
  "COREDEP",
  "BROR",
  "CHBALR",
  "NCLNLSR",
  "NTLNLSR",
  "NPERFV",
  "LNRESNCR",
  "LNATRESR",
  "ELNATRY",
  "SC",
  "ASSTLT",
  "VOLIAB",
].join(",");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeDivPct(
  num: number | null,
  den: number | null,
): number | null {
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

// ---------------------------------------------------------------------------
// Metric extraction
// ---------------------------------------------------------------------------

export function extractCanonicalMetrics(
  raw: Record<string, unknown>,
): MetricExtractionResult {
  const provenance: MetricProvenance = {};
  const dataGaps: DataGap[] = [];

  // Helper: read a direct FDIC field and record provenance
  function direct(
    metric: keyof CanonicalMetrics,
    fdicField: string,
  ): number | null {
    const v = asNumber(raw[fdicField]);
    if (v !== null) {
      provenance[metric] = { source: "direct", fdicField };
    }
    return v;
  }

  // Helper: try direct first, fall back to derivation
  function directOrDerived(
    metric: keyof CanonicalMetrics,
    fdicField: string | null,
    deriveFn: () => number | null,
    formula: string,
  ): number | null {
    if (fdicField !== null) {
      const v = asNumber(raw[fdicField]);
      if (v !== null) {
        provenance[metric] = { source: "direct", fdicField };
        return v;
      }
    }
    const derived = deriveFn();
    if (derived !== null) {
      provenance[metric] = { source: "derived", formula };
      return derived;
    }
    return null;
  }

  // Helper: derived-only metric
  function derived(
    metric: keyof CanonicalMetrics,
    deriveFn: () => number | null,
    formula: string,
  ): number | null {
    const v = deriveFn();
    if (v !== null) {
      provenance[metric] = { source: "derived", formula };
    }
    return v;
  }

  // Read raw amount fields for use in derivations
  const asset = asNumber(raw.ASSET);
  const eqtot = asNumber(raw.EQTOT);
  const depdom = asNumber(raw.DEPDOM);
  const coredep = asNumber(raw.COREDEP);
  const sc = asNumber(raw.SC);
  const asstlt = asNumber(raw.ASSTLT);
  const voliab = asNumber(raw.VOLIAB);

  const metrics: CanonicalMetrics = {
    // Amounts
    totalAssets: direct("totalAssets", "ASSET"),
    totalDeposits: direct("totalDeposits", "DEP"),
    domesticDeposits: direct("domesticDeposits", "DEPDOM"),
    equityCapital: direct("equityCapital", "EQTOT"),
    netIncome: direct("netIncome", "NETINC"),

    // Capital
    tier1LeveragePct: direct("tier1LeveragePct", "IDT1CER"),
    cet1RatioPct: direct("cet1RatioPct", "RBCT1J"),
    tier1RiskBasedPct: direct("tier1RiskBasedPct", "IDT1RWAJR"),
    totalRiskBasedPct: direct("totalRiskBasedPct", "RBCRWAJ"),
    equityCapitalRatioPct: directOrDerived(
      "equityCapitalRatioPct",
      "EQV",
      () => safeDivPct(eqtot, asset),
      "EQTOT / ASSET * 100",
    ),

    // Earnings
    roaPct: direct("roaPct", "ROA"),
    roePct: direct("roePct", "ROE"),
    netInterestMarginPct: direct("netInterestMarginPct", "NIMY"),
    efficiencyRatioPct: direct("efficiencyRatioPct", "EEFFR"),
    pretaxRoaPct: direct("pretaxRoaPct", "ROAPTX"),

    // Liquidity
    loanToDepositPct: direct("loanToDepositPct", "LNLSDEPR"),
    domesticDepositsToAssetsPct: directOrDerived(
      "domesticDepositsToAssetsPct",
      "DEPDASTR",
      () => safeDivPct(depdom, asset),
      "DEPDOM / ASSET * 100",
    ),
    coreDepositsToAssetsPct: derived(
      "coreDepositsToAssetsPct",
      () => safeDivPct(coredep, asset),
      "COREDEP / ASSET * 100",
    ),
    brokeredDepositsSharePct: direct("brokeredDepositsSharePct", "BROR"),
    cashAndDueToAssetsPct: direct("cashAndDueToAssetsPct", "CHBALR"),

    // Asset Quality
    noncurrentLoansPct: direct("noncurrentLoansPct", "NCLNLSR"),
    netChargeOffsPct: direct("netChargeOffsPct", "NTLNLSR"),
    reserveCoveragePct: direct("reserveCoveragePct", "LNRESNCR"),
    noncurrentAssetsPct: direct("noncurrentAssetsPct", "NPERFV"),
    provisionToLoansPct: direct("provisionToLoansPct", "ELNATRY"),

    // Sensitivity
    securitiesToAssetsPct: derived(
      "securitiesToAssetsPct",
      () => safeDivPct(sc, asset),
      "SC / ASSET * 100",
    ),
    longTermAssetsPct: derived(
      "longTermAssetsPct",
      () => safeDivPct(asstlt, asset),
      "ASSTLT / ASSET * 100",
    ),
    volatileLiabilitiesToAssetsPct: derived(
      "volatileLiabilitiesToAssetsPct",
      () => safeDivPct(voliab, asset),
      "VOLIAB / ASSET * 100",
    ),
  };

  // Record data gaps for any metric that ended up null
  for (const [key, value] of Object.entries(metrics)) {
    if (value === null && !provenance[key as keyof CanonicalMetrics]) {
      dataGaps.push({
        metric: key,
        reason: "Required FDIC field(s) missing or non-numeric in source data",
      });
    }
  }

  return { metrics, provenance, dataGaps };
}

// ---------------------------------------------------------------------------
// Legacy bridge
// ---------------------------------------------------------------------------

export function toLegacyCamelsMetrics(
  cm: CanonicalMetrics,
  nim4qChange: number | null,
): CamelsMetrics {
  return {
    equity_ratio: cm.equityCapitalRatioPct,
    tier1_leverage: cm.tier1LeveragePct,
    tier1_rbc: cm.tier1RiskBasedPct,
    noncurrent_assets_ratio: cm.noncurrentAssetsPct,
    noncurrent_loans_ratio: cm.noncurrentLoansPct,
    net_chargeoff_ratio: cm.netChargeOffsPct,
    reserve_to_loans: null, // LNATRESR not in canonical — compat stub
    reserve_coverage: cm.reserveCoveragePct,
    provision_ratio: cm.provisionToLoansPct,
    roa: cm.roaPct,
    roe: cm.roePct,
    nim: cm.netInterestMarginPct,
    efficiency_ratio: cm.efficiencyRatioPct,
    pretax_roa: cm.pretaxRoaPct,
    noninterest_income_share: null, // derived in legacy, not canonical
    loan_to_deposit: cm.loanToDepositPct,
    deposits_to_assets: cm.domesticDepositsToAssetsPct,
    core_deposit_ratio: cm.coreDepositsToAssetsPct,
    brokered_deposit_ratio: cm.brokeredDepositsSharePct,
    cash_ratio: cm.cashAndDueToAssetsPct,
    securities_to_assets: cm.securitiesToAssetsPct,
    nim_4q_change: nim4qChange,
  };
}
