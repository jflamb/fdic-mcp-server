export const CHUNK_SIZE = 25;
export const MAX_CONCURRENCY = 4;
export const ANALYSIS_TIMEOUT_MS = 90_000;

export function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
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
