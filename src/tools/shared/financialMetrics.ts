import { asNumber } from "./queryUtils.js";

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
  if (numerator === null || denominator === null || denominator <= 0) {
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

  const equityRatioRaw = safeRatio(eqtot, asset);
  const efficiencyRatioRaw = safeRatioPositiveDenom(nonix, revenueDenominator);

  return {
    asset,
    dep,
    roa: asNumber(raw.ROA),
    roe: asNumber(raw.ROE),
    netnim: asNumber(raw.NETNIM),
    equity_ratio: equityRatioRaw !== null ? equityRatioRaw * 100 : null,
    efficiency_ratio:
      efficiencyRatioRaw !== null ? efficiencyRatioRaw * 100 : null,
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
