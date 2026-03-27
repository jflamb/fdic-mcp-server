import { asNumber } from "./queryUtils.js";

export const UBPR_FIELDS = "CERT,REPDTE,ASSET,ROA,ROE,ROAPTX,NIMY,EEFFR,INTINC,EINTEXP,NONII,NONIX,NETINC,ELNATRY,LNLSNET,LNRE,LNCI,LNCON,LNAG,LNOTH,DEP,COREDEP,DEPDOM,DEPFOR,BROR,FREPP,IDT1CER,IDT1RWAJR,EQV,EQTOT,LNLSDEPR,DEPDASTR,CHBALR,NPERFV,NCLNLSR,NTLNLSR,LNATRESR,LNRESNCR,SC";

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

function safePct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

function growthRate(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function computeUbprRatios(raw: Record<string, unknown>): UbprRatioGroup {
  const lnlsnet = asNumber(raw.LNLSNET);
  const lnre = asNumber(raw.LNRE);
  const lnci = asNumber(raw.LNCI);
  const lncon = asNumber(raw.LNCON);
  const lnag = asNumber(raw.LNAG);
  const dep = asNumber(raw.DEP);
  const coredep = asNumber(raw.COREDEP);
  const asset = asNumber(raw.ASSET);
  const eqtot = asNumber(raw.EQTOT);

  return {
    summary: {
      roa: asNumber(raw.ROA),
      roe: asNumber(raw.ROE),
      nim: asNumber(raw.NIMY),
      efficiency_ratio: asNumber(raw.EEFFR),
      pretax_roa: asNumber(raw.ROAPTX),
    },
    loan_mix: {
      re_share: safePct(lnre, lnlsnet),
      ci_share: safePct(lnci, lnlsnet),
      consumer_share: safePct(lncon, lnlsnet),
      ag_share: safePct(lnag, lnlsnet),
    },
    capital: {
      tier1_leverage: asNumber(raw.IDT1CER),
      tier1_rbc: asNumber(raw.IDT1RWAJR),
      equity_ratio: safePct(eqtot, asset),
    },
    liquidity: {
      loan_to_deposit: safePct(lnlsnet, dep),
      core_deposit_ratio: safePct(coredep, dep),
      brokered_ratio: asNumber(raw.BROR),
      cash_ratio: asNumber(raw.CHBALR),
    },
  };
}

export function computeGrowthRates(
  current: Record<string, unknown>,
  prior: Record<string, unknown>,
): UbprGrowth {
  return {
    asset_growth: growthRate(asNumber(current.ASSET), asNumber(prior.ASSET)),
    loan_growth: growthRate(asNumber(current.LNLSNET), asNumber(prior.LNLSNET)),
    deposit_growth: growthRate(asNumber(current.DEP), asNumber(prior.DEP)),
  };
}
