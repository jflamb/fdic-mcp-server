export const CHUNK_SIZE = 25;
export const MAX_CONCURRENCY = 4;
export const ANALYSIS_TIMEOUT_MS = 90_000;

/**
 * Returns the most recent FDIC quarter-end report date (YYYYMMDD) likely to
 * have published data, accounting for the ~90-day FDIC publishing lag.
 *
 * Quarter-end dates: March 31, June 30, September 30, December 31.
 */
export function getDefaultReportDate(): string {
  const target = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  if (month >= 10) return `${year}0930`;
  if (month >= 7) return `${year}0630`;
  if (month >= 4) return `${year}0331`;
  return `${year - 1}1231`;
}

/**
 * Returns the quarter-end report date exactly one year before the given
 * YYYYMMDD report date. Preserves the same quarter (month/day suffix).
 */
export function getReportDateOneYearPrior(repdte: string): string {
  const year = Number.parseInt(repdte.slice(0, 4), 10);
  return `${year - 1}${repdte.slice(4)}`;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

interface BuildFilterStringOptions {
  cert?: number;
  dateField?: string;
  dateValue?: string | number;
  rawFilters?: string;
  rawFiltersPosition?: "first" | "last";
}

export function buildFilterString({
  cert,
  dateField,
  dateValue,
  rawFilters,
  rawFiltersPosition = "first",
}: BuildFilterStringOptions): string | undefined {
  const filterParts: string[] = [];
  const rawFilter = rawFilters ? `(${rawFilters})` : undefined;

  if (rawFiltersPosition === "first" && rawFilter) {
    filterParts.push(rawFilter);
  }
  if (cert !== undefined) {
    filterParts.push(`CERT:${cert}`);
  }
  if (dateField && dateValue !== undefined) {
    filterParts.push(`${dateField}:${dateValue}`);
  }
  if (rawFiltersPosition === "last" && rawFilter) {
    filterParts.push(rawFilter);
  }

  return filterParts.length > 0 ? filterParts.join(" AND ") : undefined;
}

export function buildCertFilters(certs: number[]): string[] {
  const filters: string[] = [];

  for (let i = 0; i < certs.length; i += CHUNK_SIZE) {
    const chunk = certs.slice(i, i + CHUNK_SIZE);
    filters.push(chunk.map((cert) => `CERT:${cert}`).join(" OR "));
  }

  return filters;
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      // Safe under JS async concurrency: no `await` occurs between reading and
      // incrementing `nextIndex`, so workers cannot interleave during assignment.
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= values.length) return;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );

  return results;
}
