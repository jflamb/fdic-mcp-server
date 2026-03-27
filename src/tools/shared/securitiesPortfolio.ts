import { asNumber } from "./queryUtils.js";

// NOTE: SCAFS and SCHTML are not available in the FDIC financials endpoint.
// Only SC and SCRES are used; afs_share and htm_share will always be null.
export const SECURITIES_FIELDS = "CERT,REPDTE,ASSET,EQTOT,SC,SCRES";

export interface SecuritiesMetrics {
  securities_to_assets: number | null;
  securities_to_capital: number | null;
  mbs_share: number | null;
  afs_share: number | null;
  htm_share: number | null;
}

export interface SecuritiesSignal {
  severity: "critical" | "warning" | "info";
  category: "securities_risk";
  message: string;
}

function safePct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

export function computeSecuritiesMetrics(raw: Record<string, unknown>): SecuritiesMetrics {
  const asset = asNumber(raw.ASSET);
  const eqtot = asNumber(raw.EQTOT);
  const sc = asNumber(raw.SC);
  const scres = asNumber(raw.SCRES);

  return {
    securities_to_assets: safePct(sc, asset),
    securities_to_capital: safePct(sc, eqtot),
    mbs_share: safePct(scres, sc),
    afs_share: null, // SCAFS not available in FDIC API
    htm_share: null, // SCHTML not available in FDIC API
  };
}

/**
 * Evaluates securities portfolio against concentration and interest rate risk thresholds.
 * High securities-to-capital ratios and MBS concentration are key risk indicators.
 */
export function scoreSecuritiesRisks(m: SecuritiesMetrics): SecuritiesSignal[] {
  const signals: SecuritiesSignal[] = [];

  if (m.securities_to_assets !== null && m.securities_to_assets > 40) {
    signals.push({
      severity: "info",
      category: "securities_risk",
      message: `Securities at ${m.securities_to_assets.toFixed(1)}% of assets indicates high concentration in the investment portfolio`,
    });
  }

  if (m.securities_to_capital !== null && m.securities_to_capital > 300) {
    signals.push({
      severity: "warning",
      category: "securities_risk",
      message: `Securities at ${m.securities_to_capital.toFixed(0)}% of capital exceeds 300% threshold, indicating significant portfolio exposure`,
    });
  }

  if (m.mbs_share !== null && m.mbs_share > 60) {
    signals.push({
      severity: "info",
      category: "securities_risk",
      message: `MBS concentration at ${m.mbs_share.toFixed(1)}% of securities portfolio indicates elevated interest rate risk`,
    });
  }

  return signals;
}
