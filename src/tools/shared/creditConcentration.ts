import { asNumber } from "./queryUtils.js";

export const CREDIT_FIELDS = [
  "CERT", "REPDTE", "ASSET", "EQTOT", "EQV",
  "LNLSNET", "LNRE", "LNRERES", "LNRECONS", "LNREMULT", "LNRENRES",
  "LNREAG", "LNRELOC", "LNCI", "LNCON", "LNAG", "LNOTH",
  "LNREDOM", "LNREFOR",
].join(",");

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

function safePct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

export function computeCreditMetrics(raw: Record<string, unknown>): CreditMetrics {
  const lnlsnet = asNumber(raw.LNLSNET);
  const lnrecons = asNumber(raw.LNRECONS);
  const lnremult = asNumber(raw.LNREMULT);
  const lnrenres = asNumber(raw.LNRENRES);
  const eqtot = asNumber(raw.EQTOT);
  const asset = asNumber(raw.ASSET);
  const lnci = asNumber(raw.LNCI);
  const lncon = asNumber(raw.LNCON);
  const lnreres = asNumber(raw.LNRERES);
  const lnag = asNumber(raw.LNAG);

  const cre =
    lnrecons !== null && lnremult !== null && lnrenres !== null
      ? lnrecons + lnremult + lnrenres
      : null;

  return {
    total_loans: lnlsnet,
    cre_to_total_loans: safePct(cre, lnlsnet),
    cre_to_capital: safePct(cre, eqtot),
    construction_to_capital: safePct(lnrecons, eqtot),
    ci_share: safePct(lnci, lnlsnet),
    consumer_share: safePct(lncon, lnlsnet),
    residential_re_share: safePct(lnreres, lnlsnet),
    ag_share: safePct(lnag, lnlsnet),
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

  if (m.cre_to_capital !== null && m.cre_to_capital > 300) {
    signals.push({
      severity: "warning",
      category: "credit_concentration",
      message: `CRE concentration at ${m.cre_to_capital.toFixed(0)}% of capital exceeds 300% interagency guidance threshold`,
    });
  }

  if (m.construction_to_capital !== null && m.construction_to_capital > 100) {
    signals.push({
      severity: "warning",
      category: "credit_concentration",
      message: `construction loan concentration at ${m.construction_to_capital.toFixed(0)}% of capital exceeds 100% interagency guidance threshold`,
    });
  }

  if (m.loans_to_assets !== null && m.loans_to_assets > 80) {
    signals.push({
      severity: "info",
      category: "credit_concentration",
      message: `High loan-to-asset ratio at ${m.loans_to_assets.toFixed(1)}% indicates elevated lending relative to total assets`,
    });
  }

  return signals;
}
