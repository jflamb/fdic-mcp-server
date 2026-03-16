import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  buildPaginationInfo,
  buildTruncationWarning,
  extractRecords,
  formatToolError,
  queryEndpoint,
  truncateIfNeeded,
} from "../services/fdicClient.js";

type InstitutionRecord = Record<string, unknown>;
type ComparisonRecord = Record<string, unknown>;

const CHUNK_SIZE = 25;
const MAX_CONCURRENCY = 4;
const ANALYSIS_TIMEOUT_MS = 90_000;

const SortFieldSchema = z.enum([
  "asset_growth",
  "asset_growth_pct",
  "dep_growth",
  "dep_growth_pct",
  "netinc_change",
  "netinc_change_pct",
  "roa_change",
  "roe_change",
  "offices_change",
  "assets_per_office_change",
  "deposits_per_office_change",
  "deposits_to_assets_change",
]);

const AnalysisModeSchema = z.enum(["snapshot", "timeseries"]);

const SnapshotAnalysisSchema = z
  .object({
    state: z
      .string()
      .optional()
      .describe(
        'State name for the institution roster filter. Example: "North Carolina"',
      ),
    certs: z
      .array(z.number().int().positive())
      .max(100)
      .optional()
      .describe(
        "Optional list of FDIC certificate numbers to compare directly. Max 100.",
      ),
    institution_filters: z
      .string()
      .optional()
      .describe(
        'Additional institution-level filter used when building the comparison set. Example: BKCLASS:N or CITY:"Charlotte"',
      ),
    active_only: z
      .boolean()
      .default(true)
      .describe("Limit the comparison set to currently active institutions."),
    start_repdte: z
      .string()
      .regex(/^\d{8}$/)
      .describe("Starting report date in YYYYMMDD format."),
    end_repdte: z
      .string()
      .regex(/^\d{8}$/)
      .describe("Ending report date in YYYYMMDD format."),
    analysis_mode: AnalysisModeSchema.default("snapshot").describe(
      "Use snapshot for two-point comparison or timeseries for quarterly trend analysis across the date range.",
    ),
    include_demographics: z
      .boolean()
      .default(true)
      .describe(
        "Include office-count changes from the demographics dataset when available.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe("Maximum number of ranked comparisons to return."),
    sort_by: SortFieldSchema.default("asset_growth").describe(
      "Comparison field used to rank institutions.",
    ),
    sort_order: z
      .enum(["ASC", "DESC"])
      .default("DESC")
      .describe("Sort direction for the ranked comparisons."),
  })
  .superRefine((value, ctx) => {
    if (!value.state && (!value.certs || value.certs.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either state or certs.",
        path: ["state"],
      });
    }
  });

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function maxOrNull(values: Array<number | null>): number | null {
  const nonNullValues = values.filter((value): value is number => value !== null);
  return nonNullValues.length > 0 ? Math.max(...nonNullValues) : null;
}

function buildCertFilters(certs: number[]): string[] {
  const filters: string[] = [];

  for (let i = 0; i < certs.length; i += CHUNK_SIZE) {
    const chunk = certs.slice(i, i + CHUNK_SIZE);
    filters.push(chunk.map((cert) => `CERT:${cert}`).join(" OR "));
  }

  return filters;
}

async function mapWithConcurrency<T, R>(
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

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function pctChange(start: number | null, end: number | null): number | null {
  if (start === null || end === null || start === 0) return null;
  return ((end - start) / start) * 100;
}

function change(start: number | null, end: number | null): number | null {
  if (start === null || end === null) return null;
  return end - start;
}

function getQuarterIndex(repdte: string): number | null {
  const year = Number.parseInt(repdte.slice(0, 4), 10);
  const month = Number.parseInt(repdte.slice(4, 6), 10);
  const quarter = month / 3;

  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return null;
  }

  return year * 4 + quarter;
}

export function yearsBetween(startRepdte: string, endRepdte: string): number {
  const startQuarterIndex = getQuarterIndex(startRepdte);
  const endQuarterIndex = getQuarterIndex(endRepdte);

  if (startQuarterIndex !== null && endQuarterIndex !== null) {
    return Math.max((endQuarterIndex - startQuarterIndex) / 4, 0);
  }

  const start = new Date(
    `${startRepdte.slice(0, 4)}-${startRepdte.slice(4, 6)}-${startRepdte.slice(6, 8)}T00:00:00Z`,
  );
  const end = new Date(
    `${endRepdte.slice(0, 4)}-${endRepdte.slice(4, 6)}-${endRepdte.slice(6, 8)}T00:00:00Z`,
  );

  return Math.max(
    (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    0,
  );
}

function cagr(start: number | null, end: number | null, years: number): number | null {
  if (start === null || end === null || start <= 0 || end <= 0 || years <= 0) {
    return null;
  }
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

function formatChange(value: number | null, digits = 4): string {
  if (value === null) return "n/a";
  return value.toFixed(digits);
}

function formatInteger(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value).toLocaleString()}`;
}

function sortComparisons(
  comparisons: ComparisonRecord[],
  sortBy: z.infer<typeof SortFieldSchema>,
  sortOrder: "ASC" | "DESC",
): ComparisonRecord[] {
  const direction = sortOrder === "ASC" ? 1 : -1;

  return [...comparisons].sort((left, right) => {
    const leftValue = asNumber(left[sortBy]) ?? Number.NEGATIVE_INFINITY;
    const rightValue = asNumber(right[sortBy]) ?? Number.NEGATIVE_INFINITY;
    return (leftValue - rightValue) * direction;
  });
}

function classifyInsights(comparison: ComparisonRecord): string[] {
  const insights: string[] = [];
  const assetGrowthPct = asNumber(comparison.asset_growth_pct);
  const depGrowthPct = asNumber(comparison.dep_growth_pct);
  const roaChange = asNumber(comparison.roa_change);
  const roeChange = asNumber(comparison.roe_change);
  const officesChange = asNumber(comparison.offices_change);
  const depositsToAssetsChange = asNumber(comparison.deposits_to_assets_change);

  if (
    assetGrowthPct !== null &&
    assetGrowthPct >= 25 &&
    depGrowthPct !== null &&
    depGrowthPct >= 15 &&
    roaChange !== null &&
    roaChange > 0
  ) {
    insights.push("growth_with_better_profitability");
  }

  if (
    assetGrowthPct !== null &&
    assetGrowthPct >= 25 &&
    depGrowthPct !== null &&
    depGrowthPct >= 15 &&
    officesChange !== null &&
    officesChange > 0
  ) {
    insights.push("growth_with_branch_expansion");
  }

  if (
    assetGrowthPct !== null &&
    assetGrowthPct >= 20 &&
    (roaChange === null || roaChange <= 0) &&
    (roeChange === null || roeChange <= 0)
  ) {
    insights.push("balance_sheet_growth_without_profitability");
  }

  if (
    assetGrowthPct !== null &&
    assetGrowthPct > 0 &&
    officesChange !== null &&
    officesChange < 0
  ) {
    insights.push("growth_with_branch_consolidation");
  }

  if (
    depositsToAssetsChange !== null &&
    depositsToAssetsChange < 0 &&
    depGrowthPct !== null &&
    depGrowthPct < 0
  ) {
    insights.push("deposit_mix_softening");
  }

  return insights;
}

function buildTopLevelInsights(comparisons: ComparisonRecord[]): Record<string, string[]> {
  return {
    growth_with_better_profitability: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "growth_with_better_profitability",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
    growth_with_branch_expansion: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "growth_with_branch_expansion",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
    balance_sheet_growth_without_profitability: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "balance_sheet_growth_without_profitability",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
    growth_with_branch_consolidation: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "growth_with_branch_consolidation",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
    deposit_mix_softening: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "deposit_mix_softening",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
    sustained_asset_growth: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "sustained_asset_growth",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
    multi_quarter_roa_decline: comparisons
      .filter((comparison) =>
        (comparison.insights as string[] | undefined)?.includes(
          "multi_quarter_roa_decline",
        ),
      )
      .slice(0, 5)
      .map((comparison) => String(comparison.name)),
  };
}

function longestMonotonicStreak(
  values: Array<number | null>,
  direction: "up" | "down",
): number {
  let longest = 0;
  let current = 0;

  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1];
    const next = values[i];
    if (previous === null || next === null) {
      current = 0;
      continue;
    }

    const matches = direction === "up" ? next > previous : next < previous;
    if (matches) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function summarizeTimeSeries(
  records: InstitutionRecord[],
  demographicsByDate: Map<string, InstitutionRecord>,
  institution: InstitutionRecord,
): ComparisonRecord | null {
  if (records.length < 2) return null;

  const sorted = [...records].sort((left, right) =>
    String(left.REPDTE).localeCompare(String(right.REPDTE)),
  );
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const startRepdte = String(start.REPDTE);
  const endRepdte = String(end.REPDTE);
  const years = yearsBetween(startRepdte, endRepdte);
  const assetSeries = sorted.map((record) => asNumber(record.ASSET));
  const roaSeries = sorted.map((record) => asNumber(record.ROA));
  const roeSeries = sorted.map((record) => asNumber(record.ROE));
  const officesSeries = sorted.map(
    (record) => asNumber(demographicsByDate.get(String(record.REPDTE))?.OFFTOT),
  );
  const assetStart = asNumber(start.ASSET);
  const assetEnd = asNumber(end.ASSET);
  const depStart = asNumber(start.DEP);
  const depEnd = asNumber(end.DEP);
  const roaStart = asNumber(start.ROA);
  const roaEnd = asNumber(end.ROA);
  const roeStart = asNumber(start.ROE);
  const roeEnd = asNumber(end.ROE);
  const netIncStart = asNumber(start.NETINC);
  const netIncEnd = asNumber(end.NETINC);
  const officesStart = officesSeries[0] ?? null;
  const officesEnd = officesSeries[officesSeries.length - 1] ?? null;
  const assetsPerOfficeStart = ratio(assetStart, officesStart);
  const assetsPerOfficeEnd = ratio(assetEnd, officesEnd);
  const depositsPerOfficeStart = ratio(depStart, officesStart);
  const depositsPerOfficeEnd = ratio(depEnd, officesEnd);
  const depositsToAssetsStart = ratio(depStart, assetStart);
  const depositsToAssetsEnd = ratio(depEnd, assetEnd);
  const peakAsset = maxOrNull(assetSeries);
  const troughRoaValues = roaSeries.filter((value): value is number => value !== null);
  const troughRoa = troughRoaValues.length > 0 ? Math.min(...troughRoaValues) : null;
  const comparison: ComparisonRecord = {
    cert: asNumber(start.CERT),
    name: end.NAME ?? start.NAME ?? institution.NAME,
    city: institution.CITY,
    stalp: institution.STALP,
    analysis_mode: "timeseries",
    start_repdte: startRepdte,
    end_repdte: endRepdte,
    periods_analyzed: sorted.length,
    asset_start: assetStart,
    asset_end: assetEnd,
    asset_growth: change(assetStart, assetEnd),
    asset_growth_pct: pctChange(assetStart, assetEnd),
    asset_cagr: cagr(assetStart, assetEnd, years),
    dep_start: depStart,
    dep_end: depEnd,
    dep_growth: change(depStart, depEnd),
    dep_growth_pct: pctChange(depStart, depEnd),
    netinc_start: netIncStart,
    netinc_end: netIncEnd,
    netinc_change: change(netIncStart, netIncEnd),
    netinc_change_pct: pctChange(netIncStart, netIncEnd),
    roa_start: roaStart,
    roa_end: roaEnd,
    roa_change: change(roaStart, roaEnd),
    roe_start: roeStart,
    roe_end: roeEnd,
    roe_change: change(roeStart, roeEnd),
    offices_start: officesStart,
    offices_end: officesEnd,
    offices_change: change(officesStart, officesEnd),
    assets_per_office_start: assetsPerOfficeStart,
    assets_per_office_end: assetsPerOfficeEnd,
    assets_per_office_change: change(assetsPerOfficeStart, assetsPerOfficeEnd),
    deposits_per_office_start: depositsPerOfficeStart,
    deposits_per_office_end: depositsPerOfficeEnd,
    deposits_per_office_change: change(
      depositsPerOfficeStart,
      depositsPerOfficeEnd,
    ),
    deposits_to_assets_start: depositsToAssetsStart,
    deposits_to_assets_end: depositsToAssetsEnd,
    deposits_to_assets_change: change(
      depositsToAssetsStart,
      depositsToAssetsEnd,
    ),
    asset_peak: peakAsset,
    roa_trough: troughRoa,
    asset_growth_streak: longestMonotonicStreak(assetSeries, "up"),
    roa_decline_streak: longestMonotonicStreak(roaSeries, "down"),
    roe_decline_streak: longestMonotonicStreak(roeSeries, "down"),
    time_series: sorted.map((record) => {
      const repdte = String(record.REPDTE);
      const demo = demographicsByDate.get(repdte);
      return {
        repdte,
        asset: asNumber(record.ASSET),
        dep: asNumber(record.DEP),
        netinc: asNumber(record.NETINC),
        roa: asNumber(record.ROA),
        roe: asNumber(record.ROE),
        offices: asNumber(demo?.OFFTOT),
      };
    }),
  };

  comparison.insights = classifyInsights(comparison);
  if ((comparison.asset_growth_streak as number) >= 3) {
    (comparison.insights as string[]).push("sustained_asset_growth");
  }
  if ((comparison.roa_decline_streak as number) >= 2) {
    (comparison.insights as string[]).push("multi_quarter_roa_decline");
  }

  return comparison;
}

function formatComparisonText(output: {
  analyzed_count: number;
  total_candidates: number;
  start_repdte: string;
  end_repdte: string;
  sort_by: string;
  analysis_mode: "snapshot" | "timeseries";
  comparisons: ComparisonRecord[];
  insights?: Record<string, string[]>;
}): string {
  const header =
    `Compared ${output.analyzed_count} institutions from ${output.start_repdte} ` +
    `to ${output.end_repdte} (from ${output.total_candidates} candidates), ` +
    `ranked by ${output.sort_by} using ${output.analysis_mode} analysis.`;

  if (output.comparisons.length === 0) {
    return header;
  }

  const rows = output.comparisons.map((comparison, index) => {
    const name = String(comparison.name ?? comparison.cert);
    const city = comparison.city ? `, ${comparison.city}` : "";
    const base =
      `${index + 1}. ${name}${city} | ` +
      `Asset growth: ${formatInteger(asNumber(comparison.asset_growth))} ` +
      `(${formatPercent(asNumber(comparison.asset_growth_pct))}) | ` +
      `Deposit growth: ${formatPercent(asNumber(comparison.dep_growth_pct))} | ` +
      `Offices: ${formatInteger(asNumber(comparison.offices_change))} | ` +
      `ROA: ${formatChange(asNumber(comparison.roa_change))} | ` +
      `ROE: ${formatChange(asNumber(comparison.roe_change))}`;

    if (output.analysis_mode === "timeseries") {
      return (
        `${base} | ` +
        `Asset CAGR: ${formatPercent(asNumber(comparison.asset_cagr))} | ` +
        `Streaks: asset ${formatInteger(asNumber(comparison.asset_growth_streak))}, ` +
        `ROA decline ${formatInteger(asNumber(comparison.roa_decline_streak))}`
      );
    }

    return base;
  });

  const insights = output.insights
    ? Object.entries(output.insights)
        .filter(([, names]) => names.length > 0)
        .map(([label, names]) => `${label}: ${names.join(", ")}`)
        .join("\n")
    : "";

  return insights ? `${header}\n${rows.join("\n")}\nInsights\n${insights}` : `${header}\n${rows.join("\n")}`;
}

async function fetchInstitutionRoster(
  state: string | undefined,
  institutionFilters: string | undefined,
  activeOnly: boolean,
  signal?: AbortSignal,
): Promise<{
  records: InstitutionRecord[];
  warning?: string;
}> {
  const filterParts: string[] = [];
  if (state) filterParts.push(`STNAME:"${state}"`);
  if (activeOnly) filterParts.push("ACTIVE:1");
  if (institutionFilters) filterParts.push(`(${institutionFilters})`);

  const response = await queryEndpoint(ENDPOINTS.INSTITUTIONS, {
    filters: filterParts.join(" AND "),
    fields: "CERT,NAME,CITY,STALP,ACTIVE",
    limit: 10_000,
    offset: 0,
    sort_by: "CERT",
    sort_order: "ASC",
  }, { signal });

  const records = extractRecords(response);
  const warning =
    response.meta.total > records.length
      ? `Institution roster truncated to ${records.length.toLocaleString()} records out of ${response.meta.total.toLocaleString()} matched institutions. Narrow the comparison set with institution_filters or certs for complete analysis.`
      : undefined;

  return { records, warning };
}

async function fetchBatchedRecordsForDates(
  endpoint: string,
  certs: number[],
  repdteFilters: string[],
  fields: string,
  signal?: AbortSignal,
): Promise<{
  byDate: Map<string, Map<number, InstitutionRecord>>;
  warnings: string[];
}> {
  const certFilters = buildCertFilters(certs);
  const tasks = repdteFilters.flatMap((repdteFilter) =>
    certFilters.map((certFilter) => ({
      repdteFilter,
      certFilter,
    })),
  );

  const responses = await mapWithConcurrency(
    tasks,
    MAX_CONCURRENCY,
    async (task) => {
      const response = await queryEndpoint(
        endpoint,
        {
          filters: `(${task.certFilter}) AND ${task.repdteFilter}`,
          fields,
          limit: 10_000,
          offset: 0,
          sort_by: "CERT",
          sort_order: "ASC",
        },
        { signal },
      );

      return { repdteFilter: task.repdteFilter, response };
    },
  );

  const byDate = new Map<string, Map<number, InstitutionRecord>>();
  const warnings = new Set<string>();
  for (const { repdteFilter, response } of responses) {
    if (!byDate.has(repdteFilter)) {
      byDate.set(repdteFilter, new Map<number, InstitutionRecord>());
    }
    const records = extractRecords(response);
    const warning = buildTruncationWarning(
      `${endpoint} batch for ${repdteFilter}`,
      response.meta.total,
      records.length,
      "Narrow the comparison set with institution_filters or certs for complete analysis.",
    );
    if (warning) warnings.add(warning);
    const target = byDate.get(repdteFilter)!;
    for (const record of records) {
      const cert = asNumber(record.CERT);
      if (cert !== null) target.set(cert, record);
    }
  }

  return { byDate, warnings: [...warnings] };
}

async function fetchSeriesRecords(
  endpoint: string,
  certs: number[],
  startRepdte: string,
  endRepdte: string,
  fields: string,
  signal?: AbortSignal,
): Promise<{ grouped: Map<number, InstitutionRecord[]>; warnings: string[] }> {
  const certFilters = buildCertFilters(certs);
  const responses = await mapWithConcurrency(
    certFilters,
    MAX_CONCURRENCY,
    async (certFilter) =>
      queryEndpoint(endpoint, {
        filters: `(${certFilter}) AND REPDTE:[${startRepdte} TO ${endRepdte}]`,
        fields,
        limit: 10_000,
        offset: 0,
        sort_by: "REPDTE",
        sort_order: "ASC",
      }, { signal }),
  );

  const grouped = new Map<number, InstitutionRecord[]>();
  const warnings = new Set<string>();
  for (const response of responses) {
    const records = extractRecords(response);
    const warning = buildTruncationWarning(
      `${endpoint} batch for REPDTE:[${startRepdte} TO ${endRepdte}]`,
      response.meta.total,
      records.length,
      "Narrow the comparison set with certs or a shorter date range for complete analysis.",
    );
    if (warning) warnings.add(warning);
    for (const record of records) {
      const cert = asNumber(record.CERT);
      if (cert === null) continue;
      if (!grouped.has(cert)) grouped.set(cert, []);
      grouped.get(cert)!.push(record);
    }
  }

  return { grouped, warnings: [...warnings] };
}

function buildSnapshotComparison(
  cert: number,
  institution: InstitutionRecord,
  startFinancial: InstitutionRecord,
  endFinancial: InstitutionRecord,
  startDemo: InstitutionRecord | undefined,
  endDemo: InstitutionRecord | undefined,
  startRepdte: string,
  endRepdte: string,
): ComparisonRecord {
  const assetStart = asNumber(startFinancial.ASSET);
  const assetEnd = asNumber(endFinancial.ASSET);
  const depStart = asNumber(startFinancial.DEP);
  const depEnd = asNumber(endFinancial.DEP);
  const netIncStart = asNumber(startFinancial.NETINC);
  const netIncEnd = asNumber(endFinancial.NETINC);
  const roaStart = asNumber(startFinancial.ROA);
  const roaEnd = asNumber(endFinancial.ROA);
  const roeStart = asNumber(startFinancial.ROE);
  const roeEnd = asNumber(endFinancial.ROE);
  const officesStart = asNumber(startDemo?.OFFTOT);
  const officesEnd = asNumber(endDemo?.OFFTOT);
  const assetsPerOfficeStart = ratio(assetStart, officesStart);
  const assetsPerOfficeEnd = ratio(assetEnd, officesEnd);
  const depositsPerOfficeStart = ratio(depStart, officesStart);
  const depositsPerOfficeEnd = ratio(depEnd, officesEnd);
  const depositsToAssetsStart = ratio(depStart, assetStart);
  const depositsToAssetsEnd = ratio(depEnd, assetEnd);

  const comparison: ComparisonRecord = {
    cert,
    name: endFinancial.NAME ?? startFinancial.NAME ?? institution.NAME,
    city: institution.CITY,
    stalp: institution.STALP,
    analysis_mode: "snapshot",
    start_repdte: startRepdte,
    end_repdte: endRepdte,
    asset_start: assetStart,
    asset_end: assetEnd,
    asset_growth: change(assetStart, assetEnd),
    asset_growth_pct: pctChange(assetStart, assetEnd),
    dep_start: depStart,
    dep_end: depEnd,
    dep_growth: change(depStart, depEnd),
    dep_growth_pct: pctChange(depStart, depEnd),
    netinc_start: netIncStart,
    netinc_end: netIncEnd,
    netinc_change: change(netIncStart, netIncEnd),
    netinc_change_pct: pctChange(netIncStart, netIncEnd),
    roa_start: roaStart,
    roa_end: roaEnd,
    roa_change: change(roaStart, roaEnd),
    roe_start: roeStart,
    roe_end: roeEnd,
    roe_change: change(roeStart, roeEnd),
    offices_start: officesStart,
    offices_end: officesEnd,
    offices_change: change(officesStart, officesEnd),
    assets_per_office_start: assetsPerOfficeStart,
    assets_per_office_end: assetsPerOfficeEnd,
    assets_per_office_change: change(assetsPerOfficeStart, assetsPerOfficeEnd),
    deposits_per_office_start: depositsPerOfficeStart,
    deposits_per_office_end: depositsPerOfficeEnd,
    deposits_per_office_change: change(
      depositsPerOfficeStart,
      depositsPerOfficeEnd,
    ),
    deposits_to_assets_start: depositsToAssetsStart,
    deposits_to_assets_end: depositsToAssetsEnd,
    deposits_to_assets_change: change(
      depositsToAssetsStart,
      depositsToAssetsEnd,
    ),
    cbsa_start: startDemo?.CBSANAME,
    cbsa_end: endDemo?.CBSANAME,
  };

  comparison.insights = classifyInsights(comparison);
  return comparison;
}

export function registerAnalysisTools(server: McpServer): void {
  server.registerTool(
    "fdic_compare_bank_snapshots",
    {
      title: "Compare Bank Snapshot Trends",
      description: `Compare FDIC reporting snapshots across a set of institutions and rank the results by growth, profitability, or efficiency changes.

This tool is designed for heavier analytical prompts that would otherwise require many separate MCP calls. It batches institution roster lookup, financial snapshots, optional office-count snapshots, and can also fetch a quarterly time series inside the server.

Good uses:
  - Identify North Carolina banks with the strongest asset growth from 2021 to 2025
  - Compare whether deposit growth came with branch expansion or profitability improvement
  - Rank a specific cert list by ROA, ROE, asset-per-office, or deposit-to-asset changes
  - Pull a quarterly trend series and highlight inflection points, streaks, and structural shifts

Inputs:
  - state or certs: choose a geographic roster or provide a direct comparison set
  - start_repdte, end_repdte: report dates in YYYYMMDD format
  - analysis_mode: snapshot or timeseries
  - institution_filters: optional extra institution filter when building the roster
  - active_only: default true
  - include_demographics: default true, adds office-count comparisons when available
  - sort_by: ranking field such as asset_growth, dep_growth_pct, roa_change, assets_per_office_change
  - sort_order: ASC or DESC
  - limit: maximum ranked results to return

Returns concise comparison text plus structured deltas, derived metrics, and insight tags for each institution.`,
      inputSchema: SnapshotAnalysisSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      state,
      certs,
      institution_filters,
      active_only,
      start_repdte,
      end_repdte,
      analysis_mode,
      include_demographics,
      limit,
      sort_by,
      sort_order,
    }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

      try {
        const rosterResult =
          certs && certs.length > 0
            ? {
                records: certs.map((cert) => ({ CERT: cert })),
                warning: undefined,
              }
            : await fetchInstitutionRoster(
                state,
                institution_filters,
                active_only,
                controller.signal,
              );
        const roster = rosterResult.records;

        const candidateCerts = roster
          .map((record) => asNumber(record.CERT))
          .filter((cert): cert is number => cert !== null);

        if (candidateCerts.length === 0) {
          const output = {
            total_candidates: 0,
            analyzed_count: 0,
            start_repdte,
            end_repdte,
            analysis_mode,
            sort_by,
            sort_order,
            comparisons: [],
          };

          return {
            content: [
              { type: "text", text: "No institutions matched the comparison set." },
            ],
            structuredContent: output,
          };
        }

        const rosterByCert = new Map(
          roster
            .map((record) => [asNumber(record.CERT), record] as const)
            .filter(
              (entry): entry is readonly [number, InstitutionRecord] =>
                entry[0] !== null,
            ),
        );

        let comparisons: ComparisonRecord[] = [];
        const warnings = rosterResult.warning ? [rosterResult.warning] : [];

        if (analysis_mode === "timeseries") {
          const [financialSeriesResult, demographicsSeriesResult] = await Promise.all([
            fetchSeriesRecords(
              ENDPOINTS.FINANCIALS,
              candidateCerts,
              start_repdte,
              end_repdte,
              "CERT,NAME,REPDTE,ASSET,DEP,NETINC,ROA,ROE",
              controller.signal,
            ),
            include_demographics
              ? fetchSeriesRecords(
                  ENDPOINTS.DEMOGRAPHICS,
                  candidateCerts,
                  start_repdte,
                  end_repdte,
                  "CERT,REPDTE,OFFTOT,OFFSTATE,CBSANAME",
                  controller.signal,
                )
              : Promise.resolve({
                  grouped: new Map<number, InstitutionRecord[]>(),
                  warnings: [],
                }),
          ]);
          warnings.push(
            ...financialSeriesResult.warnings,
            ...demographicsSeriesResult.warnings,
          );
          const financialSeries = financialSeriesResult.grouped;
          const demographicsSeries = demographicsSeriesResult.grouped;

          comparisons = candidateCerts
            .map((cert) =>
              summarizeTimeSeries(
                financialSeries.get(cert) ?? [],
                new Map(
                  (demographicsSeries.get(cert) ?? []).map((record) => [
                    String(record.REPDTE),
                    record,
                  ]),
                ),
                rosterByCert.get(cert) ?? {},
              ),
            )
            .filter((comparison): comparison is ComparisonRecord => comparison !== null);
        } else {
          const [financialSnapshotsResult, demographicSnapshotsResult] = await Promise.all([
            fetchBatchedRecordsForDates(
              ENDPOINTS.FINANCIALS,
              candidateCerts,
              [`REPDTE:${start_repdte}`, `REPDTE:${end_repdte}`],
              "CERT,NAME,REPDTE,ASSET,DEP,NETINC,ROA,ROE",
              controller.signal,
            ),
            include_demographics
              ? fetchBatchedRecordsForDates(
                  ENDPOINTS.DEMOGRAPHICS,
                  candidateCerts,
                  [`REPDTE:${start_repdte}`, `REPDTE:${end_repdte}`],
                  "CERT,REPDTE,OFFTOT,OFFSTATE,CBSANAME",
                  controller.signal,
                )
              : Promise.resolve({
                  byDate: new Map<string, Map<number, InstitutionRecord>>(),
                  warnings: [],
                }),
          ]);
          warnings.push(
            ...financialSnapshotsResult.warnings,
            ...demographicSnapshotsResult.warnings,
          );
          const financialSnapshots = financialSnapshotsResult.byDate;
          const demographicSnapshots = demographicSnapshotsResult.byDate;

          const startFinancials =
            financialSnapshots.get(`REPDTE:${start_repdte}`) ??
            new Map<number, InstitutionRecord>();
          const endFinancials =
            financialSnapshots.get(`REPDTE:${end_repdte}`) ??
            new Map<number, InstitutionRecord>();
          const startDemographics =
            demographicSnapshots.get(`REPDTE:${start_repdte}`) ??
            new Map<number, InstitutionRecord>();
          const endDemographics =
            demographicSnapshots.get(`REPDTE:${end_repdte}`) ??
            new Map<number, InstitutionRecord>();

          comparisons = candidateCerts
            .map((cert) => {
              const startFinancial = startFinancials.get(cert);
              const endFinancial = endFinancials.get(cert);
              if (!startFinancial || !endFinancial) return null;
              return buildSnapshotComparison(
                cert,
                rosterByCert.get(cert) ?? {},
                startFinancial,
                endFinancial,
                startDemographics.get(cert),
                endDemographics.get(cert),
                start_repdte,
                end_repdte,
              );
            })
            .filter((comparison): comparison is ComparisonRecord => comparison !== null);
        }

        const sortedComparisons = sortComparisons(
          comparisons,
          sort_by,
          sort_order,
        );
        const ranked = sortedComparisons.slice(0, limit);
        const pagination = buildPaginationInfo(comparisons.length, 0, ranked.length);
        const output = {
          total_candidates: candidateCerts.length,
          analyzed_count: comparisons.length,
          start_repdte,
          end_repdte,
          analysis_mode,
          sort_by,
          sort_order,
          warnings,
          insights: buildTopLevelInsights(sortedComparisons),
          ...pagination,
          comparisons: ranked,
        };

        const text = truncateIfNeeded(
          [
            ...warnings.map((warning) => `Warning: ${warning}`),
            formatComparisonText(output),
          ]
            .filter((value): value is string => value !== null)
            .join("\n\n"),
          CHARACTER_LIMIT,
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: output,
        };
      } catch (err) {
        if (controller.signal.aborted) {
          return formatToolError(
            new Error(
              `Analysis timed out after ${Math.floor(ANALYSIS_TIMEOUT_MS / 1000)} seconds. Narrow the comparison set with certs or institution_filters and try again.`,
            ),
          );
        }
        return formatToolError(err);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
