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

function safePct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

export function computeFundingMetrics(raw: Record<string, unknown>): FundingMetrics {
  const asset = asNumber(raw.ASSET);
  const dep = asNumber(raw.DEP);
  const depfor = asNumber(raw.DEPFOR);
  const coredep = asNumber(raw.COREDEP);
  const bror = asNumber(raw.BROR);
  const frepp = asNumber(raw.FREPP);
  const chbalr = asNumber(raw.CHBALR);

  // Wholesale funding = (non-core deposits + FHLB borrowings) / assets
  const wholesaleNum =
    dep !== null && coredep !== null && frepp !== null
      ? dep - coredep + frepp
      : null;

  return {
    core_deposit_ratio: safePct(coredep, dep),
    brokered_deposit_ratio: bror,
    wholesale_funding_ratio: safePct(wholesaleNum, asset),
    fhlb_to_assets: safePct(frepp, asset),
    foreign_deposit_share: safePct(depfor, dep),
    deposits_to_assets: safePct(dep, asset),
    cost_of_funds: null, // needs prior quarter data — future enhancement
    cash_ratio: chbalr,
  };
}

/**
 * Evaluates funding profile against common supervisory thresholds.
 * Brokered deposit reliance, wholesale funding concentration, and
 * core deposit adequacy are key indicators of funding stability.
 */
export function scoreFundingRisks(m: FundingMetrics): FundingSignal[] {
  const signals: FundingSignal[] = [];

  if (m.brokered_deposit_ratio !== null && m.brokered_deposit_ratio > 15) {
    signals.push({
      severity: "warning",
      category: "funding_risk",
      message: `Brokered deposits at ${m.brokered_deposit_ratio.toFixed(1)}% exceed 15% threshold, indicating potential funding volatility`,
    });
  }

  if (m.wholesale_funding_ratio !== null && m.wholesale_funding_ratio > 25) {
    signals.push({
      severity: "warning",
      category: "funding_risk",
      message: `Wholesale funding at ${m.wholesale_funding_ratio.toFixed(1)}% of assets exceeds 25% threshold`,
    });
  }

  if (m.core_deposit_ratio !== null && m.core_deposit_ratio < 60) {
    signals.push({
      severity: "warning",
      category: "funding_risk",
      message: `Core deposit ratio at ${m.core_deposit_ratio.toFixed(1)}% is below 60% threshold, indicating reliance on less stable funding`,
    });
  }

  if (m.fhlb_to_assets !== null && m.fhlb_to_assets > 15) {
    signals.push({
      severity: "info",
      category: "funding_risk",
      message: `FHLB borrowings at ${m.fhlb_to_assets.toFixed(1)}% of assets exceed 15%, indicating elevated reliance on wholesale borrowing`,
    });
  }

  return signals;
}
