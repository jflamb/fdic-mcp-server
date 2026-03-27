/**
 * Peer comparison engine with percentile computation, robust z-score (MAD-based),
 * weighted aggregates, and outlier detection.
 */

export interface PeerStats {
  peer_count: number;
  peer_median: number;
  peer_mean: number;
  subject_value: number;
  subject_percentile: number; // 0-100, where 50 = median
  robust_z_score: number; // MAD-based robust z-score
  is_outlier: boolean; // |robust_z| >= 2.5
  outlier_direction?: "high" | "low";
}

export interface PeerContext {
  peer_count: number;
  peer_definition: string; // human-readable description of how peers were selected
  broadening_steps: string[]; // list of filters relaxed, if any
  subject_rank: number;
  subject_percentiles: Record<string, PeerStats>; // metric name -> stats
}

/**
 * Compute the median of a sorted (or unsorted) array of numbers.
 * Returns null for empty arrays.
 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute the Median Absolute Deviation (MAD).
 * MAD = median(|x_i - median(x)|)
 */
export function computeMAD(values: number[], median: number): number {
  const deviations = values.map((v) => Math.abs(v - median));
  const mad = computeMedian(deviations);
  return mad ?? 0;
}

/**
 * Compute the percentile rank of a value within a sorted array.
 * Percentile = (count of values <= v) / n * 100, clamped to [0, 100].
 * Returns 50 for an empty distribution (no comparison possible).
 */
export function computePercentile(
  value: number,
  sortedValues: number[],
): number {
  if (sortedValues.length === 0) return 50;
  const n = sortedValues.length;
  let count = 0;
  for (const v of sortedValues) {
    if (v <= value) count++;
  }
  return Math.min(100, Math.max(0, (count / n) * 100));
}

/**
 * Compute a MAD-based robust z-score.
 * robust_z = 0.6745 * (value - median) / MAD
 * Returns 0 if MAD is 0 (all values identical) or values is empty.
 */
export function computeRobustZScore(
  value: number,
  values: number[],
): number {
  if (values.length === 0) return 0;
  const median = computeMedian(values);
  if (median === null) return 0;
  const mad = computeMAD(values, median);
  if (mad === 0) return 0;
  return (0.6745 * (value - median)) / mad;
}

/**
 * Compute a weighted aggregate: sum(value_i * weight_i) / sum(weight_i).
 * Returns null if entries is empty or total weight is 0.
 */
export function computeWeightedAggregate(
  entries: { value: number; weight: number }[],
): number | null {
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight === 0) return null;
  return entries.reduce((s, e) => s + e.value * e.weight, 0) / totalWeight;
}

/**
 * Compute full peer statistics for a single metric.
 */
export function computePeerStats(
  subjectValue: number,
  peerValues: number[],
): PeerStats {
  const peerCount = peerValues.length;

  if (peerCount === 0) {
    return {
      peer_count: 0,
      peer_median: 0,
      peer_mean: 0,
      subject_value: subjectValue,
      subject_percentile: 50,
      robust_z_score: 0,
      is_outlier: false,
    };
  }

  const sorted = [...peerValues].sort((a, b) => a - b);
  const median = computeMedian(sorted)!;
  const mean = peerValues.reduce((s, v) => s + v, 0) / peerCount;
  const percentile = computePercentile(subjectValue, sorted);
  const robustZ = computeRobustZScore(subjectValue, peerValues);
  const isOutlier = Math.abs(robustZ) >= 2.5;

  const result: PeerStats = {
    peer_count: peerCount,
    peer_median: median,
    peer_mean: mean,
    subject_value: subjectValue,
    subject_percentile: percentile,
    robust_z_score: robustZ,
    is_outlier: isOutlier,
  };

  if (isOutlier) {
    result.outlier_direction = robustZ >= 2.5 ? "high" : "low";
  }

  return result;
}
