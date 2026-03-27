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
  market_share: number; // percentage
  rank: number;
}

export interface MarketConcentration {
  hhi: number;
  classification:
    | "unconcentrated"
    | "moderately_concentrated"
    | "highly_concentrated";
  total_deposits: number;
  institution_count: number;
}

/**
 * Groups branches by cert, sums deposits, computes percentage share,
 * sorts descending by deposits, and assigns rank.
 */
export function computeMarketShare(
  branches: BranchRecord[],
): MarketParticipant[] {
  if (branches.length === 0) return [];

  const byInstitution = new Map<
    number,
    { name: string; deposits: number; branches: number }
  >();

  for (const branch of branches) {
    const existing = byInstitution.get(branch.cert);
    if (existing) {
      existing.deposits += branch.deposits;
      existing.branches += 1;
    } else {
      byInstitution.set(branch.cert, {
        name: branch.name,
        deposits: branch.deposits,
        branches: 1,
      });
    }
  }

  const totalDeposits = Array.from(byInstitution.values()).reduce(
    (sum, inst) => sum + inst.deposits,
    0,
  );

  const participants: MarketParticipant[] = [];
  for (const [cert, inst] of byInstitution.entries()) {
    participants.push({
      cert,
      name: inst.name,
      total_deposits: inst.deposits,
      branch_count: inst.branches,
      market_share:
        totalDeposits > 0 ? (inst.deposits / totalDeposits) * 100 : 0,
      rank: 0, // assigned below
    });
  }

  participants.sort((a, b) => b.total_deposits - a.total_deposits);
  for (let i = 0; i < participants.length; i++) {
    participants[i].rank = i + 1;
  }

  return participants;
}

/**
 * Sum of squared market shares (as percentages, so range 0–10000).
 * A market with a single firm at 100% share yields HHI = 10000.
 */
export function computeHHI(shares: number[]): number {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/**
 * Classifies market concentration per DOJ/FTC merger guidelines:
 *   HHI < 1500 → unconcentrated
 *   1500 ≤ HHI ≤ 2500 → moderately concentrated
 *   HHI > 2500 → highly concentrated
 */
export function classifyConcentration(
  hhi: number,
): MarketConcentration["classification"] {
  if (hhi < 1500) return "unconcentrated";
  if (hhi <= 2500) return "moderately_concentrated";
  return "highly_concentrated";
}

/**
 * Combines HHI, classification, and totals from participants array.
 */
export function buildMarketConcentration(
  participants: MarketParticipant[],
): MarketConcentration {
  const shares = participants.map((p) => p.market_share);
  const hhi = computeHHI(shares);
  return {
    hhi: Math.round(hhi * 100) / 100,
    classification: classifyConcentration(hhi),
    total_deposits: participants.reduce((s, p) => s + p.total_deposits, 0),
    institution_count: participants.length,
  };
}
