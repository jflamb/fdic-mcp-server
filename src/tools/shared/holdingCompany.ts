import { asNumber } from "./queryUtils.js";

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

const INDEPENDENT_LABEL = "(Independent)";

/**
 * Groups institutions by their holding company name.
 * Institutions without an HC go to "(Independent)".
 * Groups are sorted by total assets descending.
 */
export function groupByHoldingCompany(
  institutions: SubsidiaryRecord[],
): HoldingCompanyGroup[] {
  const map = new Map<string, SubsidiaryRecord[]>();

  for (const inst of institutions) {
    const key = inst.hc_name ?? INDEPENDENT_LABEL;
    const group = map.get(key);
    if (group) {
      group.push(inst);
    } else {
      map.set(key, [inst]);
    }
  }

  const groups: HoldingCompanyGroup[] = [];
  for (const [hc_name, subsidiaries] of map) {
    groups.push({ hc_name, subsidiaries });
  }

  // Sort by total assets descending
  groups.sort((a, b) => {
    const assetsA = a.subsidiaries.reduce((sum, s) => sum + s.total_assets, 0);
    const assetsB = b.subsidiaries.reduce((sum, s) => sum + s.total_assets, 0);
    return assetsB - assetsA;
  });

  return groups;
}

/**
 * Aggregates financial metrics across subsidiaries.
 * Weighted ROA and equity ratio are asset-weighted, skipping nulls.
 */
export function aggregateSubsidiaryMetrics(
  subs: SubsidiaryRecord[],
): AggregateMetrics {
  let totalAssets = 0;
  let totalDeposits = 0;
  const stateSet = new Set<string>();

  let roaWeightedSum = 0;
  let roaAssetSum = 0;
  let equityWeightedSum = 0;
  let equityAssetSum = 0;

  for (const sub of subs) {
    totalAssets += sub.total_assets;
    totalDeposits += sub.total_deposits;
    if (sub.state) {
      stateSet.add(sub.state);
    }

    if (sub.roa !== null) {
      roaWeightedSum += sub.roa * sub.total_assets;
      roaAssetSum += sub.total_assets;
    }

    if (sub.equity_ratio !== null) {
      equityWeightedSum += sub.equity_ratio * sub.total_assets;
      equityAssetSum += sub.total_assets;
    }
  }

  const states = Array.from(stateSet).sort();

  return {
    total_assets: totalAssets,
    total_deposits: totalDeposits,
    subsidiary_count: subs.length,
    states,
    weighted_roa: roaAssetSum > 0 ? roaWeightedSum / roaAssetSum : null,
    weighted_equity_ratio:
      equityAssetSum > 0 ? equityWeightedSum / equityAssetSum : null,
  };
}

/**
 * Build a SubsidiaryRecord from raw FDIC institution + financials data.
 */
export function buildSubsidiaryRecord(
  inst: Record<string, unknown>,
  financials?: Record<string, unknown>,
): SubsidiaryRecord {
  return {
    cert: typeof inst.CERT === "number" ? inst.CERT : 0,
    name: String(inst.NAME ?? ""),
    hc_name: inst.NAMEHCR ? String(inst.NAMEHCR) : null,
    total_assets: typeof inst.ASSET === "number" ? inst.ASSET : 0,
    total_deposits: typeof inst.DEP === "number" ? inst.DEP : 0,
    roa: financials ? asNumber(financials.ROA) : null,
    equity_ratio: financials ? asNumber(financials.EQV) : null,
    state: String(inst.STALP ?? ""),
    active: inst.ACTIVE === 1 || inst.ACTIVE === true,
  };
}
