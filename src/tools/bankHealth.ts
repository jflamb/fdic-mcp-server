import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  queryEndpoint,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import {
  ANALYSIS_TIMEOUT_MS,
  getDefaultReportDate,
  getPriorQuarterDates,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  CAMELS_FIELDS,
  computeCamelsMetrics,
  scoreComponent,
  compositeScore,
  analyzeTrend,
  isStale,
  formatRating,
  type CamelsMetrics,
  type ComponentScore,
  type TrendAnalysis,
  type Rating,
} from "./shared/camelsScoring.js";
import { assembleProxyAssessment } from "./shared/publicCamelsProxy.js";

const COMPONENT_NAMES: Record<string, string> = {
  C: "Capital Adequacy",
  A: "Asset Quality",
  E: "Earnings",
  L: "Liquidity",
  S: "Sensitivity to Market Risk",
};

const TREND_METRICS: { key: keyof CamelsMetrics; fdic_field: string; higher_is_better: boolean }[] = [
  { key: "tier1_leverage", fdic_field: "IDT1CER", higher_is_better: true },
  { key: "noncurrent_loans_ratio", fdic_field: "NCLNLSR", higher_is_better: false },
  { key: "roa", fdic_field: "ROA", higher_is_better: true },
  { key: "nim", fdic_field: "NIMY", higher_is_better: true },
  { key: "efficiency_ratio", fdic_field: "EEFFR", higher_is_better: false },
  { key: "loan_to_deposit", fdic_field: "LNLSDEPR", higher_is_better: false },
];

export interface HealthSummary {
  institution: {
    cert: number;
    name: string;
    city: string;
    state: string;
    charter_class: string;
    total_assets: number;
    report_date: string;
    data_staleness: string;
  };
  composite: { rating: number; label: string };
  components: ComponentScore[];
  trends: TrendAnalysis[];
  outliers: string[];
  risk_signals: string[];
  /** Proxy model overall band (e.g. "satisfactory") — added by proxy model */
  proxy_band?: string;
  /** Proxy model overall score on 1.0–4.0 scale */
  proxy_score?: number;
  /** PCA capital classification category (e.g. "well_capitalized") */
  capital_category?: string;
}

export function formatHealthSummaryText(summary: HealthSummary): string {
  const parts: string[] = [];
  const { institution: inst, composite } = summary;

  parts.push(`CAMELS-Style Health Assessment: ${inst.name} (CERT ${inst.cert})`);
  parts.push(`${inst.city}, ${inst.state} | Charter: ${inst.charter_class} | Assets: $${Math.round(inst.total_assets).toLocaleString()}k`);
  parts.push(`Report Date: ${inst.report_date} | Data: ${inst.data_staleness}`);
  parts.push("");
  parts.push("NOTE: This is a public off-site analytical proxy based on public financial data — not an official CAMELS rating or confidential supervisory conclusion.");
  parts.push("");
  parts.push(`Composite Rating: ${formatRating(composite.rating as Rating)}`);
  if (summary.proxy_band !== undefined && summary.proxy_score !== undefined) {
    parts.push(`Overall Assessment: ${summary.proxy_band} (score ${summary.proxy_score}/4.0)`);
  }
  if (summary.capital_category !== undefined) {
    parts.push(`Capital Classification: ${summary.capital_category}`);
  }
  parts.push("");

  for (const comp of summary.components) {
    const name = COMPONENT_NAMES[comp.component] ?? comp.component;
    parts.push(`${name} (${comp.component}): ${formatRating(comp.rating)}`);
    for (const m of comp.metrics) {
      const val = m.value !== null ? `${m.value.toFixed(2)}${m.unit}` : "n/a";
      parts.push(`  ${m.label.padEnd(30)} ${val.padStart(10)}  ${m.rating_label}`);
    }
    if (comp.flags.length > 0) {
      for (const flag of comp.flags) {
        parts.push(`  ⚠ ${flag}`);
      }
    }
    parts.push("");
  }

  if (summary.trends.length > 0) {
    parts.push("Trend Analysis:");
    for (const t of summary.trends) {
      if (t.direction !== "stable") {
        parts.push(`  ${t.label}: ${t.direction} (${t.magnitude}, ${t.quarters_analyzed}Q analyzed)`);
      }
    }
    parts.push("");
  }

  if (summary.risk_signals.length > 0) {
    parts.push("Risk Signals:");
    for (const signal of summary.risk_signals) {
      parts.push(`  • ${signal}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

function collectRiskSignals(
  metrics: CamelsMetrics,
  components: ComponentScore[],
  trends: TrendAnalysis[],
): string[] {
  const signals: string[] = [];

  if (metrics.tier1_leverage !== null && metrics.tier1_leverage < 5) {
    signals.push(`Tier 1 leverage ratio at ${metrics.tier1_leverage.toFixed(2)}% — below well-capitalized threshold (5%)`);
  }
  if (metrics.roa !== null && metrics.roa < 0) {
    signals.push(`Operating losses: ROA at ${metrics.roa.toFixed(2)}%`);
  }
  if (metrics.reserve_coverage !== null && metrics.reserve_coverage < 50) {
    signals.push(`Reserve coverage critically low at ${metrics.reserve_coverage.toFixed(1)}%`);
  }
  if (metrics.brokered_deposit_ratio !== null && metrics.brokered_deposit_ratio > 15) {
    signals.push(`High brokered deposit reliance: ${metrics.brokered_deposit_ratio.toFixed(1)}%`);
  }
  if (metrics.noncurrent_loans_ratio !== null && metrics.noncurrent_loans_ratio > 3) {
    signals.push(`Elevated noncurrent loans: ${metrics.noncurrent_loans_ratio.toFixed(2)}%`);
  }

  for (const comp of components) {
    if (comp.rating >= 4) {
      const name = COMPONENT_NAMES[comp.component] ?? comp.component;
      signals.push(`${name} component rated ${comp.rating} (${comp.label})`);
    }
  }

  for (const t of trends) {
    if (t.direction === "deteriorating" && t.magnitude === "significant") {
      signals.push(`${t.label} deteriorating significantly over ${t.quarters_analyzed} quarters`);
    }
  }

  return signals;
}

const BankHealthInputSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .describe("FDIC Certificate Number of the institution to analyze."),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe(
      "Report Date (YYYYMMDD). Defaults to the most recent quarter likely to have published data.",
    ),
  quarters: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(8)
    .describe("Number of prior quarters to fetch for trend analysis (default 8)."),
});

export function registerBankHealthTools(server: McpServer): void {
  server.registerTool(
    "fdic_analyze_bank_health",
    {
      title: "Analyze Bank Health (CAMELS-Style)",
      description: `Produce a CAMELS-style analytical assessment for a single FDIC-insured institution using the public off-site proxy model.

Scores five components — Capital (C), Asset Quality (A), Earnings (E), Liquidity (L), Sensitivity (S) — using published FDIC financial data and derives a weighted composite rating (1=Strong to 5=Unsatisfactory), plus a proxy model overall band (1.0–4.0 scale).

Output includes:
  - Composite and component ratings with individual metric scores
  - Proxy model overall assessment band with capital classification
  - Management overlay assessment (inferred from public data patterns)
  - Trend analysis across prior quarters for key metrics
  - Risk signals flagging critical and warning-level concerns
  - Structured JSON for programmatic consumption (legacy + proxy fields)

NOTE: Management (M) is omitted from component scoring — cannot be assessed from public data. Sensitivity (S) uses proxy metrics (NIM trend, securities concentration). This is a public off-site analytical proxy, not an official CAMELS rating.`,
      inputSchema: BankHealthInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (rawParams, extra) => {
      const params = { ...rawParams, repdte: rawParams.repdte ?? getDefaultReportDate() };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
      const progressToken = extra._meta?.progressToken;

      try {
        const dateError = validateQuarterEndDate(params.repdte, "repdte");
        if (dateError) {
          return formatToolError(new Error(dateError));
        }

        await sendProgressNotification(server.server, progressToken, 0.1, "Fetching institution profile");

        const [profileResponse, financialsResponse] = await Promise.all([
          queryEndpoint(
            ENDPOINTS.INSTITUTIONS,
            {
              filters: `CERT:${params.cert}`,
              fields: "CERT,NAME,CITY,STALP,BKCLASS,ASSET,ACTIVE",
              limit: 1,
            },
            { signal: controller.signal },
          ),
          queryEndpoint(
            ENDPOINTS.FINANCIALS,
            {
              filters: `CERT:${params.cert} AND REPDTE:${params.repdte}`,
              fields: CAMELS_FIELDS,
              limit: 1,
            },
            { signal: controller.signal },
          ),
        ]);

        const profileRecords = extractRecords(profileResponse);
        if (profileRecords.length === 0) {
          return formatToolError(new Error(`No institution found with CERT number ${params.cert}.`));
        }
        const profile = profileRecords[0];

        const financialRecords = extractRecords(financialsResponse);
        if (financialRecords.length === 0) {
          return formatToolError(
            new Error(
              `No financial data for CERT ${params.cert} at report date ${params.repdte}. ` +
              `Try an earlier quarter-end date (0331, 0630, 0930, 1231).`,
            ),
          );
        }
        const currentFinancials = financialRecords[0];

        await sendProgressNotification(server.server, progressToken, 0.3, "Fetching prior quarters for trend analysis");

        const priorDates = getPriorQuarterDates(params.repdte, params.quarters);
        let priorQuarters: Record<string, unknown>[] = [];

        if (priorDates.length > 0) {
          const dateFilter = priorDates.map((d) => `REPDTE:${d}`).join(" OR ");
          const priorResponse = await queryEndpoint(
            ENDPOINTS.FINANCIALS,
            {
              filters: `CERT:${params.cert} AND (${dateFilter})`,
              fields: CAMELS_FIELDS,
              sort_by: "REPDTE",
              sort_order: "DESC",
              limit: params.quarters,
            },
            { signal: controller.signal },
          );
          priorQuarters = extractRecords(priorResponse);
        }

        await sendProgressNotification(server.server, progressToken, 0.6, "Computing CAMELS scores");

        const metrics = computeCamelsMetrics(currentFinancials, priorQuarters);

        const components: ComponentScore[] = (["C", "A", "E", "L", "S"] as const).map(
          (c) => scoreComponent(c, metrics),
        );
        const composite = compositeScore(components);

        await sendProgressNotification(server.server, progressToken, 0.8, "Analyzing trends");

        const allQuarters = [currentFinancials, ...priorQuarters];
        const trends: TrendAnalysis[] = [];
        for (const tm of TREND_METRICS) {
          const timeseries = allQuarters.map((q) => ({
            repdte: String(q.REPDTE ?? ""),
            value: typeof q[tm.fdic_field] === "number" ? (q[tm.fdic_field] as number) : null,
          }));
          timeseries.reverse();
          trends.push(analyzeTrend(String(tm.key), timeseries, tm.higher_is_better));
        }

        const riskSignals = collectRiskSignals(metrics, components, trends);
        const staleness = isStale(params.repdte) ? "stale (>120 days old)" : "current";

        // Assemble the new proxy model assessment alongside legacy scoring
        const proxyAssessment = assembleProxyAssessment({
          rawFinancials: currentFinancials,
          priorQuarters,
          repdte: params.repdte,
        });

        const summary: HealthSummary = {
          institution: {
            cert: params.cert,
            name: String(profile.NAME ?? ""),
            city: String(profile.CITY ?? ""),
            state: String(profile.STALP ?? ""),
            charter_class: String(profile.BKCLASS ?? ""),
            total_assets: typeof currentFinancials.ASSET === "number" ? currentFinancials.ASSET : 0,
            report_date: params.repdte,
            data_staleness: staleness,
          },
          composite: { rating: composite.rating, label: composite.label },
          components,
          trends,
          outliers: [],
          risk_signals: riskSignals,
          proxy_band: proxyAssessment.overall.band,
          proxy_score: proxyAssessment.overall.score,
          capital_category: proxyAssessment.capital_classification.category,
        };

        const text = truncateIfNeeded(
          formatHealthSummaryText(summary),
          CHARACTER_LIMIT,
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            // NEW primary output — proxy assessment fields
            ...proxyAssessment,

            // LEGACY compatibility fields (existing shape retained)
            institution: summary.institution,
            composite: summary.composite,
            components: summary.components,
            trends: summary.trends,
            outliers: summary.outliers,
            risk_signals: summary.risk_signals,
          } as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return formatToolError(err);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
