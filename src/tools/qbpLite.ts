import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  formatToolError,
  queryEndpoint,
  truncateIfNeeded,
} from "../services/fdicClient.js";
import { FdicAnalysisOutputSchema } from "../schemas/output.js";
import {
  asNumber,
  getDefaultReportDate,
  getPriorQuarterDates,
  getReportDateOneYearPrior,
  mapWithConcurrency,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";

const QBP_LITE_FETCH_LIMIT = 10_000;

const QBP_LITE_FIELDS = [
  "CERT",
  "NAME",
  "REPDTE",
  "CB",
  "SPECGRP",
  "SPECGRPDESC",
  "ASSET",
  "DEP",
  "DEPDOM",
  "NETINC",
  "ROA",
  "ROE",
  "NIMY",
  "ERNAST",
  "LNLSNET",
  "LNRE",
  "LNCI",
  "LNCON",
  "LNCRCD",
  "LNAG",
  "SC",
  "EQTOT",
  "NCLNLSR",
  "NTLNLSR",
  "RBC",
  "RBC1AAJ",
  "IDT1RWAJR",
  "RBCT1",
  "RBCT1C",
  "RBCT1CER",
  "RBCRWAJ",
  "RWAJ",
  "RWAJT",
  "P3RER",
  "P3CIR",
  "P3CONR",
  "P3CRCDR",
  "P3AGR",
  "NTRER",
  "NTCIR",
  "NTCONR",
  "NTCRCDR",
  "NTAGR",
].join(",");

const QbpLiteSchema = z.object({
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe(
      "Quarter-end Report Date (REPDTE) in YYYYMMDD format. If omitted, the tool searches backward from the latest likely published quarter until data is found.",
    ),
  trend_quarters: z
    .number()
    .int()
    .min(8)
    .max(40)
    .default(20)
    .describe(
      "Number of quarterly observations to return for trend charts, including the current quarter. Default 20 quarters.",
    ),
  include_community_banks: z
    .boolean()
    .default(true)
    .describe(
      "Include a compact community-bank-vs-industry comparison using the public community-bank flag.",
    ),
});

type QbpLiteParams = z.infer<typeof QbpLiteSchema>;
type FinancialRecord = Record<string, unknown>;

interface AggregateMetrics {
  institution_count: number;
  total_assets: number | null;
  total_loans_and_leases: number | null;
  domestic_deposits: number | null;
  total_deposits: number | null;
  securities: number | null;
  equity_capital: number | null;
  net_income: number | null;
  roa_pct: number | null;
  roe_pct: number | null;
  net_interest_margin_pct: number | null;
  noncurrent_loans_pct: number | null;
  net_chargeoffs_pct: number | null;
  leverage_ratio_pct: number | null;
  common_equity_tier1_ratio_pct: number | null;
  tier1_risk_based_ratio_pct: number | null;
  total_risk_based_ratio_pct: number | null;
}

interface MetricComparison {
  id: string;
  label: string;
  unit: "$thousands" | "count" | "percent";
  change_unit: "$thousands" | "count" | "percentage_points";
  current: number | null;
  prior_quarter_change: number | null;
  prior_quarter_change_pct: number | null;
  year_over_year_change: number | null;
  year_over_year_change_pct: number | null;
}

const EXECUTIVE_METRICS: Array<{
  id: keyof AggregateMetrics;
  label: string;
  unit: MetricComparison["unit"];
}> = [
  {
    id: "institution_count",
    label: "Number of institutions reporting",
    unit: "count",
  },
  { id: "total_assets", label: "Total assets", unit: "$thousands" },
  {
    id: "total_loans_and_leases",
    label: "Total loans and leases",
    unit: "$thousands",
  },
  { id: "domestic_deposits", label: "Domestic deposits", unit: "$thousands" },
  { id: "net_income", label: "Net income", unit: "$thousands" },
  { id: "roa_pct", label: "Return on assets", unit: "percent" },
  { id: "roe_pct", label: "Return on equity", unit: "percent" },
  { id: "net_interest_margin_pct", label: "Net interest margin", unit: "percent" },
  { id: "noncurrent_loans_pct", label: "Noncurrent loans to loans", unit: "percent" },
  { id: "net_chargeoffs_pct", label: "Net charge-offs to loans", unit: "percent" },
  { id: "leverage_ratio_pct", label: "Core capital (leverage) ratio", unit: "percent" },
];

function sumField(records: FinancialRecord[], field: string): number | null {
  let total = 0;
  let seen = false;

  for (const record of records) {
    const value = asNumber(record[field]);
    if (value !== null) {
      total += value;
      seen = true;
    }
  }

  return seen ? total : null;
}

function weightedAverage(
  records: FinancialRecord[],
  valueField: string,
  weightField: string,
): number | null {
  let weightedSum = 0;
  let weightSum = 0;

  for (const record of records) {
    const value = asNumber(record[valueField]);
    const weight = asNumber(record[weightField]);
    if (value !== null && weight !== null && weight > 0) {
      weightedSum += value * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? weightedSum / weightSum : null;
}

function pctChange(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function change(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null;
  return current - prior;
}

function dividePct(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function sumRatioPct(
  records: FinancialRecord[],
  numeratorField: string,
  denominatorField: string,
): number | null {
  return dividePct(sumField(records, numeratorField), sumField(records, denominatorField));
}

export function aggregateFinancialRecords(records: FinancialRecord[]): AggregateMetrics {
  const totalAssets = sumField(records, "ASSET");
  const totalLoans = sumField(records, "LNLSNET");
  const equityCapital = sumField(records, "EQTOT");

  return {
    institution_count: records.length,
    total_assets: totalAssets,
    total_loans_and_leases: totalLoans,
    domestic_deposits: sumField(records, "DEPDOM"),
    total_deposits: sumField(records, "DEP"),
    securities: sumField(records, "SC"),
    equity_capital: equityCapital,
    net_income: sumField(records, "NETINC"),
    roa_pct: weightedAverage(records, "ROA", "ASSET"),
    roe_pct: weightedAverage(records, "ROE", "EQTOT"),
    net_interest_margin_pct: weightedAverage(records, "NIMY", "ERNAST"),
    noncurrent_loans_pct: weightedAverage(records, "NCLNLSR", "LNLSNET"),
    net_chargeoffs_pct: weightedAverage(records, "NTLNLSR", "LNLSNET"),
    leverage_ratio_pct: weightedAverage(records, "RBC1AAJ", "ASSET"),
    common_equity_tier1_ratio_pct:
      sumRatioPct(records, "RBCT1C", "RWAJ") ??
      weightedAverage(records, "RBCT1CER", "RWAJ"),
    tier1_risk_based_ratio_pct:
      sumRatioPct(records, "RBCT1", "RWAJ") ??
      weightedAverage(records, "IDT1RWAJR", "RWAJ"),
    total_risk_based_ratio_pct:
      sumRatioPct(records, "RBC", "RWAJT") ??
      weightedAverage(records, "RBCRWAJ", "RWAJT"),
  };
}

export function buildExecutiveSnapshot(
  current: AggregateMetrics,
  priorQuarter: AggregateMetrics | null,
  yearAgo: AggregateMetrics | null,
): MetricComparison[] {
  return EXECUTIVE_METRICS.map(({ id, label, unit }) => {
    const currentValue = current[id];
    const priorValue = priorQuarter?.[id] ?? null;
    const yearAgoValue = yearAgo?.[id] ?? null;

    return {
      id,
      label,
      unit,
      change_unit: unit === "percent" ? "percentage_points" : unit,
      current: currentValue,
      prior_quarter_change: change(currentValue, priorValue),
      prior_quarter_change_pct:
        unit === "percent" ? null : pctChange(currentValue, priorValue),
      year_over_year_change: change(currentValue, yearAgoValue),
      year_over_year_change_pct:
        unit === "percent" ? null : pctChange(currentValue, yearAgoValue),
    };
  });
}

function isCommunityBank(record: FinancialRecord): boolean {
  const value = record.CB;
  return value === 1 || value === "1";
}

function assetSizeGroup(asset: number | null): string {
  if (asset === null) return "Unknown";
  if (asset < 100_000) return "Assets < $100 Million";
  if (asset < 1_000_000) return "Assets $100 Million - $1 Billion";
  if (asset < 10_000_000) return "Assets $1 Billion - $10 Billion";
  if (asset < 250_000_000) return "Assets $10 Billion - $250 Billion";
  return "Assets > $250 Billion";
}

function buildSeriesPoint(repdte: string, records: FinancialRecord[]) {
  const metrics = aggregateFinancialRecords(records);
  return {
    repdte,
    ...metrics,
  };
}

function buildAssetSizeNimSeries(
  groupedRecords: Map<string, FinancialRecord[]>,
) {
  const rows: Array<{
    repdte: string;
    group: string;
    institution_count: number;
    total_assets: number | null;
    net_interest_margin_pct: number | null;
  }> = [];

  for (const [repdte, records] of groupedRecords) {
    const groups = new Map<string, FinancialRecord[]>();
    for (const record of records) {
      const group = assetSizeGroup(asNumber(record.ASSET));
      const groupRecords = groups.get(group);
      if (groupRecords) {
        groupRecords.push(record);
      } else {
        groups.set(group, [record]);
      }
    }

    rows.push({
      repdte,
      group: "Industry",
      institution_count: records.length,
      total_assets: sumField(records, "ASSET"),
      net_interest_margin_pct: weightedAverage(records, "NIMY", "ERNAST"),
    });

    for (const [group, groupRecords] of groups) {
      rows.push({
        repdte,
        group,
        institution_count: groupRecords.length,
        total_assets: sumField(groupRecords, "ASSET"),
        net_interest_margin_pct: weightedAverage(groupRecords, "NIMY", "ERNAST"),
      });
    }
  }

  return rows;
}

export function buildLoanAndDepositSeries(
  series: ReturnType<typeof buildSeriesPoint>[],
) {
  const byDate = new Map(series.map((point) => [point.repdte, point]));

  return series.map((point) => {
    const priorQuarter = getPriorQuarterDates(point.repdte, 1)[0];
    const yearAgo = getReportDateOneYearPrior(point.repdte);
    const priorPoint = byDate.get(priorQuarter);
    const yearAgoPoint = byDate.get(yearAgo);

    return {
      repdte: point.repdte,
      total_loans_and_leases: point.total_loans_and_leases,
      quarterly_loan_change: change(
        point.total_loans_and_leases,
        priorPoint?.total_loans_and_leases ?? null,
      ),
      loan_growth_12_month_pct: pctChange(
        point.total_loans_and_leases,
        yearAgoPoint?.total_loans_and_leases ?? null,
      ),
      domestic_deposits: point.domestic_deposits,
      quarterly_domestic_deposit_change: change(
        point.domestic_deposits,
        priorPoint?.domestic_deposits ?? null,
      ),
      domestic_deposit_growth_12_month_pct: pctChange(
        point.domestic_deposits,
        yearAgoPoint?.domestic_deposits ?? null,
      ),
    };
  });
}

export function buildPortfolioPerformance(records: FinancialRecord[]) {
  const portfolios = [
    {
      id: "real_estate",
      label: "Real estate loans",
      balanceField: "LNRE",
      noncurrentRateField: "P3RER",
      chargeoffRateField: "NTRER",
    },
    {
      id: "commercial_industrial",
      label: "Commercial and industrial loans",
      balanceField: "LNCI",
      noncurrentRateField: "P3CIR",
      chargeoffRateField: "NTCIR",
    },
    {
      id: "consumer",
      label: "Consumer loans",
      balanceField: "LNCON",
      noncurrentRateField: "P3CONR",
      chargeoffRateField: "NTCONR",
    },
    {
      id: "credit_card",
      label: "Credit card loans",
      balanceField: "LNCRCD",
      noncurrentRateField: "P3CRCDR",
      chargeoffRateField: "NTCRCDR",
    },
    {
      id: "farm",
      label: "Farm loans",
      balanceField: "LNAG",
      noncurrentRateField: "P3AGR",
      chargeoffRateField: "NTAGR",
    },
  ];

  return portfolios.map((portfolio) => ({
    id: portfolio.id,
    label: portfolio.label,
    balance: sumField(records, portfolio.balanceField),
    balance_share_of_total_loans_pct: dividePct(
      sumField(records, portfolio.balanceField),
      sumField(records, "LNLSNET"),
    ),
    noncurrent_rate_pct: weightedAverage(
      records,
      portfolio.noncurrentRateField,
      portfolio.balanceField,
    ),
    net_chargeoff_rate_pct: weightedAverage(
      records,
      portfolio.chargeoffRateField,
      portfolio.balanceField,
    ),
  }));
}

export function buildCommunityComparison(
  groupedRecords: Map<string, FinancialRecord[]>,
) {
  const rows: Array<{
    repdte: string;
    group: "Industry" | "Community Banks";
    institution_count: number;
    total_assets: number | null;
    total_loans_and_leases: number | null;
    domestic_deposits: number | null;
    net_income: number | null;
    roa_pct: number | null;
    net_interest_margin_pct: number | null;
    noncurrent_loans_pct: number | null;
    net_chargeoffs_pct: number | null;
  }> = [];

  for (const [repdte, records] of groupedRecords) {
    for (const [group, groupRecords] of [
      ["Industry", records],
      ["Community Banks", records.filter(isCommunityBank)],
    ] as const) {
      const metrics = aggregateFinancialRecords(groupRecords);
      rows.push({
        repdte,
        group,
        institution_count: metrics.institution_count,
        total_assets: metrics.total_assets,
        total_loans_and_leases: metrics.total_loans_and_leases,
        domestic_deposits: metrics.domestic_deposits,
        net_income: metrics.net_income,
        roa_pct: metrics.roa_pct,
        net_interest_margin_pct: metrics.net_interest_margin_pct,
        noncurrent_loans_pct: metrics.noncurrent_loans_pct,
        net_chargeoffs_pct: metrics.net_chargeoffs_pct,
      });
    }
  }

  return rows;
}

export function buildTruncationWarning(
  repdte: string,
  returnedCount: number,
  totalCount: number,
  limit = QBP_LITE_FETCH_LIMIT,
): string | null {
  if (returnedCount >= limit && totalCount > limit) {
    return `REPDTE ${repdte}: results truncated at ${limit.toLocaleString()} of ${totalCount.toLocaleString()} institutions.`;
  }

  return null;
}

async function fetchRecordsForRepdte(
  repdte: string,
): Promise<{ records: FinancialRecord[]; total: number; truncationWarning: string | null }> {
  const response = await queryEndpoint(ENDPOINTS.FINANCIALS, {
    filters: `REPDTE:${repdte}`,
    fields: QBP_LITE_FIELDS,
    limit: QBP_LITE_FETCH_LIMIT,
    sort_by: "CERT",
    sort_order: "ASC",
  });
  const records = extractRecords(response);
  return {
    records,
    total: response.meta.total,
    truncationWarning: buildTruncationWarning(
      repdte,
      records.length,
      response.meta.total,
    ),
  };
}

async function hasFinancialData(repdte: string): Promise<boolean> {
  const response = await queryEndpoint(ENDPOINTS.FINANCIALS, {
    filters: `REPDTE:${repdte}`,
    fields: "CERT,REPDTE",
    limit: 1,
  });
  return response.meta.total > 0;
}

async function resolveReportDate(params: QbpLiteParams): Promise<string> {
  if (params.repdte) {
    const validationError = validateQuarterEndDate(params.repdte, "repdte");
    if (validationError) {
      throw new Error(validationError);
    }
    return params.repdte;
  }

  const candidates = [getDefaultReportDate(), ...getPriorQuarterDates(getDefaultReportDate(), 7)];
  for (const candidate of candidates) {
    if (await hasFinancialData(candidate)) {
      return candidate;
    }
  }

  throw new Error("No BankFind financial data found in the latest eight expected reporting quarters.");
}

export async function buildQbpLiteData(params: QbpLiteParams) {
  const trendQuarters = params.trend_quarters ?? 20;
  const includeCommunityBanks = params.include_community_banks ?? true;
  const repdte = await resolveReportDate(params);
  const priorQuarterRepdte = getPriorQuarterDates(repdte, 1)[0];
  const yearAgoRepdte = getReportDateOneYearPrior(repdte);
  const trendDates = [...getPriorQuarterDates(repdte, trendQuarters - 1)].reverse();
  const requiredDates = [...new Set([...trendDates, repdte, priorQuarterRepdte, yearAgoRepdte])].sort();

  const recordsByDate = new Map<string, FinancialRecord[]>();
  const warnings: string[] = [];

  // QBP Lite keeps one raw quarter in memory per requested reporting date so
  // the current quarter can still feed portfolio and community-bank slices.
  // The public institution universe is currently well below the 10k cap; if a
  // historical query exceeds it, the tool warns instead of silently treating
  // the partial aggregate as complete.
  await mapWithConcurrency(requiredDates, 4, async (date) => {
    const { records, truncationWarning } = await fetchRecordsForRepdte(date);
    recordsByDate.set(date, records);
    if (records.length === 0) {
      warnings.push(`No financial records found for REPDTE ${date}.`);
    }
    if (truncationWarning) {
      warnings.push(truncationWarning);
    }
  });

  const currentRecords = recordsByDate.get(repdte) ?? [];
  if (currentRecords.length === 0) {
    throw new Error(`No financial records found for current REPDTE ${repdte}.`);
  }

  const trendRecords = new Map(
    [...trendDates, repdte]
      .filter((date) => (recordsByDate.get(date)?.length ?? 0) > 0)
      .map((date) => [date, recordsByDate.get(date) ?? []] as const),
  );
  const trendSeries = [...trendRecords.entries()].map(([date, records]) =>
    buildSeriesPoint(date, records),
  );
  const current = aggregateFinancialRecords(currentRecords);
  const priorQuarter = recordsByDate.has(priorQuarterRepdte)
    ? aggregateFinancialRecords(recordsByDate.get(priorQuarterRepdte) ?? [])
    : null;
  const yearAgo = recordsByDate.has(yearAgoRepdte)
    ? aggregateFinancialRecords(recordsByDate.get(yearAgoRepdte) ?? [])
    : null;

  return {
    report: {
      title: "QBP Lite: FDIC-Insured Institutions",
      repdte,
      prior_quarter_repdte: priorQuarterRepdte,
      year_ago_repdte: yearAgoRepdte,
      trend_start_repdte: trendSeries[0]?.repdte ?? repdte,
      trend_end_repdte: repdte,
    },
    executive_snapshot: buildExecutiveSnapshot(current, priorQuarter, yearAgo),
    charts: {
      quarterly_net_income_and_roa: trendSeries.map((point) => ({
        repdte: point.repdte,
        net_income: point.net_income,
        roa_pct: point.roa_pct,
      })),
      net_interest_margin_by_asset_size: buildAssetSizeNimSeries(trendRecords),
      loans_and_deposits: buildLoanAndDepositSeries(trendSeries),
      credit_quality: trendSeries.map((point) => ({
        repdte: point.repdte,
        noncurrent_loans_pct: point.noncurrent_loans_pct,
        net_chargeoffs_pct: point.net_chargeoffs_pct,
      })),
      loan_performance_by_portfolio: buildPortfolioPerformance(currentRecords),
      capital_ratios: trendSeries.map((point) => ({
        repdte: point.repdte,
        leverage_ratio_pct: point.leverage_ratio_pct,
        common_equity_tier1_ratio_pct: point.common_equity_tier1_ratio_pct,
        tier1_risk_based_ratio_pct: point.tier1_risk_based_ratio_pct,
        total_risk_based_ratio_pct: point.total_risk_based_ratio_pct,
      })),
      community_banks_vs_industry: includeCommunityBanks
        ? buildCommunityComparison(trendRecords)
        : [],
    },
    data_notes: {
      source_dataset: "FDIC BankFind financials endpoint",
      date_field: "REPDTE",
      dollar_units: "Thousands of dollars unless converted by the client.",
      aggregation_notes: [
        "Dollar fields are summed across reporting institutions.",
        "ROA, ROE, credit-quality ratios, and leverage ratio are weighted using the closest available public denominator field.",
        "Leverage ratio is asset-weighted using period-end ASSET as a proxy for average assets because the average-asset denominator is not exposed as a separate public BankFind field.",
        "Net interest margin is weighted by earning assets.",
        "Risk-based capital ratios are calculated from summed public capital-dollar and risk-weighted-asset fields when available, with public ratio fields used only as a fallback.",
        "The report uses public quarterly Call Report-derived BankFind data; it is not an official FDIC QBP publication.",
      ],
      known_exclusions: [
        "Official Problem Bank List counts are excluded because they depend on confidential CAMELS ratings.",
        "Deposit Insurance Fund balance, reserve ratio, assessments earned, and fund income or expense are excluded because they are DIF accounting data rather than BankFind institution financials.",
        "Assessment-rate distribution data is excluded because public BankFind financials do not provide institution assessment-rate ranges.",
        "Community-bank merger-adjusted prior-period series are excluded; community-bank comparisons use the public CB flag available in BankFind records.",
      ],
      warnings,
    },
  };
}

function formatMetricValue(value: number | null, unit: MetricComparison["unit"]): string {
  if (value === null) return "n/a";
  if (unit === "percent") return `${value.toFixed(2)}%`;
  return Math.round(value).toLocaleString();
}

function formatChangeValue(
  value: number | null,
  unit: MetricComparison["change_unit"],
): string {
  if (value === null) return "n/a";
  if (unit === "percentage_points") return `${value.toFixed(2)} ppts`;
  return Math.round(value).toLocaleString();
}

function formatQbpLiteText(data: Awaited<ReturnType<typeof buildQbpLiteData>>): string {
  const lines = [
    `${data.report.title}`,
    `Quarter ended: ${data.report.repdte}`,
    `Prior quarter: ${data.report.prior_quarter_repdte} | Year ago: ${data.report.year_ago_repdte}`,
    "",
    "Executive Snapshot",
  ];

  for (const metric of data.executive_snapshot) {
    const current = formatMetricValue(metric.current, metric.unit);
    const qoq = formatChangeValue(
      metric.prior_quarter_change,
      metric.change_unit,
    );
    const yoy = formatChangeValue(
      metric.year_over_year_change,
      metric.change_unit,
    );
    lines.push(`- ${metric.label}: ${current}; QoQ change ${qoq}; YoY change ${yoy}`);
  }

  lines.push(
    "",
    "Chart-ready datasets included: quarterly_net_income_and_roa, net_interest_margin_by_asset_size, loans_and_deposits, credit_quality, loan_performance_by_portfolio, capital_ratios, community_banks_vs_industry.",
    "",
    "Known exclusions: official Problem Bank List counts, DIF accounting, assessment-rate distributions, and merger-adjusted community-bank prior-period series.",
  );

  return truncateIfNeeded(
    lines.join("\n"),
    CHARACTER_LIMIT,
    "Use structuredContent for the complete QBP Lite dataset.",
  );
}

export function registerQbpLiteTools(server: McpServer): void {
  server.registerTool(
    "fdic_qbp_lite_data",
    {
      title: "Generate QBP Lite Data Bundle",
      description:
        "Build chart-ready data for a concise QBP Lite report from reproducible public BankFind quarterly financials. Includes executive snapshot metrics, trend series, community-bank comparison data, source notes, and explicit exclusions for non-public or non-BankFind QBP items.",
      inputSchema: QbpLiteSchema,
      outputSchema: FdicAnalysisOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await buildQbpLiteData(params);
        return {
          content: [{ type: "text", text: formatQbpLiteText(data) }],
          structuredContent: data,
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
