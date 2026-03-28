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
  MAX_CONCURRENCY,
  asNumber,
  buildCertFilters,
  getDefaultReportDate,
  getPriorQuarterDates,
  mapWithConcurrency,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  computeCamelsMetrics,
  scoreComponent,
  compositeScore,
  formatRating,
  type CamelsMetrics,
  type ComponentScore,
  type TrendAnalysis,
  type Rating,
} from "./shared/camelsScoring.js";
import { CANONICAL_FIELDS } from "./shared/metricNormalization.js";
import { assembleProxyAssessment } from "./shared/publicCamelsProxy.js";
import type { RiskSignalV2 } from "./shared/riskSignalEngine.js";
import { fetchHistoryEvents } from "./shared/historyFetch.js";

export type RiskSeverity = "critical" | "warning" | "info";
export type RiskCategory = "capital" | "asset_quality" | "earnings" | "liquidity" | "sensitivity" | "trend";

export interface RiskSignal {
  severity: RiskSeverity;
  category: RiskCategory;
  message: string;
}

export function classifyRiskSignals(
  metrics: CamelsMetrics,
  trends: Pick<TrendAnalysis, "metric" | "label" | "direction" | "magnitude" | "quarters_analyzed">[],
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Critical: capital below well-capitalized
  if (metrics.tier1_leverage !== null && metrics.tier1_leverage < 5) {
    signals.push({ severity: "critical", category: "capital", message: `Tier 1 leverage at ${metrics.tier1_leverage.toFixed(2)}% — below well-capitalized threshold (5%)` });
  }
  if (metrics.tier1_rbc !== null && metrics.tier1_rbc < 6) {
    signals.push({ severity: "critical", category: "capital", message: `Tier 1 risk-based capital at ${metrics.tier1_rbc.toFixed(2)}% — below well-capitalized threshold (6%)` });
  }

  // Critical: operating losses
  if (metrics.roa !== null && metrics.roa < 0) {
    signals.push({ severity: "critical", category: "earnings", message: `Operating losses: ROA at ${metrics.roa.toFixed(2)}%` });
  }

  // Critical: reserve coverage
  if (metrics.reserve_coverage !== null && metrics.reserve_coverage < 50) {
    signals.push({ severity: "critical", category: "asset_quality", message: `Reserve coverage critically low at ${metrics.reserve_coverage.toFixed(1)}%` });
  }

  // Warning: elevated problem loans
  if (metrics.noncurrent_loans_ratio !== null && metrics.noncurrent_loans_ratio > 3) {
    signals.push({ severity: "warning", category: "asset_quality", message: `Noncurrent loans elevated at ${metrics.noncurrent_loans_ratio.toFixed(2)}%` });
  }

  // Warning: brokered deposit reliance
  if (metrics.brokered_deposit_ratio !== null && metrics.brokered_deposit_ratio > 15) {
    signals.push({ severity: "warning", category: "liquidity", message: `High brokered deposit reliance: ${metrics.brokered_deposit_ratio.toFixed(1)}%` });
  }

  // Warning: NIM compression
  if (metrics.nim_4q_change !== null && metrics.nim_4q_change < -0.30) {
    signals.push({ severity: "warning", category: "sensitivity", message: `NIM compressed ${Math.abs(metrics.nim_4q_change).toFixed(2)}pp over 4 quarters` });
  }

  // Warning: CAMELS component scores
  const components: ComponentScore[] = (["C", "A", "E", "L", "S"] as const).map(
    (c) => scoreComponent(c, metrics),
  );
  const componentCategoryMap: Record<string, RiskCategory> = {
    C: "capital", A: "asset_quality", E: "earnings", L: "liquidity", S: "sensitivity",
  };
  const componentNames: Record<string, string> = {
    C: "Capital", A: "Asset Quality", E: "Earnings", L: "Liquidity", S: "Sensitivity",
  };
  for (const comp of components) {
    if (comp.rating >= 4) {
      signals.push({
        severity: "warning",
        category: componentCategoryMap[comp.component],
        message: `${componentNames[comp.component]} component rated ${formatRating(comp.rating)}`,
      });
    }
  }

  // Warning/Info: deteriorating trends
  const trendCategoryMap: Record<string, RiskCategory> = {
    tier1_leverage: "capital",
    noncurrent_loans_ratio: "asset_quality",
    roa: "earnings",
    nim: "earnings",
    efficiency_ratio: "earnings",
    loan_to_deposit: "liquidity",
  };
  for (const t of trends) {
    if (t.direction === "deteriorating") {
      const cat = trendCategoryMap[t.metric] ?? "trend";
      if (t.magnitude === "significant") {
        signals.push({ severity: "warning", category: cat, message: `${t.label} deteriorating significantly over ${t.quarters_analyzed} quarters` });
      } else if (t.magnitude === "moderate") {
        signals.push({ severity: "info", category: cat, message: `${t.label} deteriorating moderately over ${t.quarters_analyzed} quarters` });
      }
    }
  }

  return signals;
}

const SEVERITY_ORDER: Record<RiskSeverity, number> = { critical: 0, warning: 1, info: 2 };

interface InstitutionRiskResult {
  cert: number;
  name: string;
  city: string | null;
  state: string | null;
  total_assets: number | null;
  composite_rating: number;
  composite_label: string;
  signals: RiskSignalV2[];
  critical_count: number;
  warning_count: number;
  legacy_signals: RiskSignal[];
  proxy_summary?: {
    overall: { score: number; band: string };
    capital_classification: { category: string; label: string };
    data_quality: { report_date: string; staleness: string; gaps_count: number };
  };
}

const RiskSignalsInputSchema = z.object({
  state: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe("Scan all active institutions in this state."),
  certs: z
    .array(z.number().int().positive())
    .max(50)
    .optional()
    .describe("Specific CERTs to scan (max 50)."),
  asset_min: z
    .number()
    .positive()
    .optional()
    .describe("Minimum total assets ($thousands) filter."),
  asset_max: z
    .number()
    .positive()
    .optional()
    .describe("Maximum total assets ($thousands) filter."),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("Report Date (YYYYMMDD). Defaults to the most recent quarter."),
  min_severity: z
    .enum(["info", "warning", "critical"])
    .default("warning")
    .describe("Minimum severity level to include in results (default: warning)."),
  quarters: z
    .number()
    .int()
    .min(1)
    .max(12)
    .default(4)
    .describe("Prior quarters to fetch for trend analysis (default 4)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Max flagged institutions to return."),
});

export function registerRiskSignalTools(server: McpServer): void {
  server.registerTool(
    "fdic_detect_risk_signals",
    {
      title: "Detect Risk Signals (Early Warning)",
      description: `Scan FDIC-insured institutions for early warning risk signals using CAMELS-style analysis.

Scans institutions for:
  - Critical: undercapitalized (Tier 1 < 5%), operating losses (ROA < 0), reserve coverage < 50%
  - Warning: CAMELS component rated 4+, significant deteriorating trends, brokered deposits > 15%, noncurrent loans > 3%
  - Info: moderate deteriorating trends

Three scan modes:
  - State-wide: provide state to scan all active institutions
  - Explicit list: provide certs (up to 50)
  - Asset-based: provide asset_min/asset_max

Output: Ranked list of flagged institutions sorted by signal severity count.

NOTE: Analytical screening tool, not official supervisory ratings.`,
      inputSchema: RiskSignalsInputSchema,
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
        if (!params.certs && !params.state && params.asset_min === undefined && params.asset_max === undefined) {
          return formatToolError(new Error("At least one selection criteria required: certs, state, or asset_min/asset_max."));
        }

        const dateError = validateQuarterEndDate(params.repdte, "repdte");
        if (dateError) {
          return formatToolError(new Error(dateError));
        }

        await sendProgressNotification(server.server, progressToken, 0.1, "Building institution roster");

        let targetCerts: number[];

        if (params.certs) {
          targetCerts = [...params.certs];
        } else {
          const filterParts: string[] = ["ACTIVE:1"];
          if (params.state) filterParts.push(`STALP:${params.state}`);
          if (params.asset_min !== undefined || params.asset_max !== undefined) {
            const min = params.asset_min ?? 0;
            const max = params.asset_max ?? "*";
            filterParts.push(`ASSET:[${min} TO ${max}]`);
          }

          const rosterResp = await queryEndpoint(
            ENDPOINTS.INSTITUTIONS,
            {
              filters: filterParts.join(" AND "),
              fields: "CERT",
              limit: 10_000,
              sort_by: "CERT",
              sort_order: "ASC",
            },
            { signal: controller.signal },
          );
          targetCerts = extractRecords(rosterResp)
            .map((r) => asNumber(r.CERT))
            .filter((c): c is number => c !== null);
        }

        if (targetCerts.length === 0) {
          return formatToolError(new Error("No institutions matched the specified criteria."));
        }

        await sendProgressNotification(server.server, progressToken, 0.3, `Fetching financials for ${targetCerts.length} institutions`);

        // Fetch current quarter financials
        const certFilters = buildCertFilters(targetCerts);
        const currentResponses = await mapWithConcurrency(
          certFilters,
          MAX_CONCURRENCY,
          async (certFilter) =>
            queryEndpoint(
              ENDPOINTS.FINANCIALS,
              {
                filters: `(${certFilter}) AND REPDTE:${params.repdte}`,
                fields: CANONICAL_FIELDS,
                limit: 10_000,
                sort_by: "CERT",
                sort_order: "ASC",
              },
              { signal: controller.signal },
            ),
        );
        const allCurrentFinancials = currentResponses.flatMap(extractRecords);

        // Fetch prior quarters for trend analysis
        const priorDates = getPriorQuarterDates(params.repdte, params.quarters);
        let priorByInstitution = new Map<number, Record<string, unknown>[]>();

        if (priorDates.length > 0) {
          await sendProgressNotification(server.server, progressToken, 0.5, "Fetching prior quarters for trends");

          const dateFilter = priorDates.map((d) => `REPDTE:${d}`).join(" OR ");
          const priorResponses = await mapWithConcurrency(
            certFilters,
            MAX_CONCURRENCY,
            async (certFilter) =>
              queryEndpoint(
                ENDPOINTS.FINANCIALS,
                {
                  filters: `(${certFilter}) AND (${dateFilter})`,
                  fields: CANONICAL_FIELDS,
                  limit: 10_000,
                  sort_by: "REPDTE",
                  sort_order: "DESC",
                },
                { signal: controller.signal },
              ),
          );

          for (const rec of priorResponses.flatMap(extractRecords)) {
            const cert = asNumber(rec.CERT);
            if (cert === null) continue;
            const existing = priorByInstitution.get(cert) ?? [];
            existing.push(rec);
            priorByInstitution.set(cert, existing);
          }
        }

        // Fetch profiles
        const profileResp = await queryEndpoint(
          ENDPOINTS.INSTITUTIONS,
          {
            filters: targetCerts.length <= 25
              ? targetCerts.map((c) => `CERT:${c}`).join(" OR ")
              : `CERT:[${Math.min(...targetCerts)} TO ${Math.max(...targetCerts)}]`,
            fields: "CERT,NAME,CITY,STALP",
            limit: 10_000,
            sort_by: "CERT",
            sort_order: "ASC",
          },
          { signal: controller.signal },
        );
        const profileMap = new Map<number, Record<string, unknown>>();
        for (const r of extractRecords(profileResp)) {
          const c = asNumber(r.CERT);
          if (c !== null) profileMap.set(c, r);
        }

        await sendProgressNotification(server.server, progressToken, 0.7, "Fetching history and analyzing risk signals");

        // Fetch history events for all target certs in parallel (best-effort)
        const historyByCert = new Map<number, Awaited<ReturnType<typeof fetchHistoryEvents>>>();
        const historyResults = await mapWithConcurrency(
          targetCerts,
          MAX_CONCURRENCY,
          async (cert) => ({ cert, events: await fetchHistoryEvents(cert, { signal: controller.signal, repdte: params.repdte }) }),
        );
        for (const { cert, events } of historyResults) {
          if (events.length > 0) historyByCert.set(cert, events);
        }

        const minSeverityOrder = SEVERITY_ORDER[params.min_severity];
        const results: InstitutionRiskResult[] = [];

        for (const fin of allCurrentFinancials) {
          const cert = asNumber(fin.CERT);
          if (cert === null) continue;

          const priorQuarters = priorByInstitution.get(cert) ?? [];

          // Use the shared proxy assessment as the primary analysis path.
          // This runs the enhanced trend engine (real consecutive_worsening, yoy_change)
          // and classifies V2 risk signals from the unified engine.
          const proxyAssessment = assembleProxyAssessment({
            rawFinancials: fin,
            priorQuarters,
            repdte: params.repdte,
            historyEvents: historyByCert.get(cert),
          });

          // V2 signals are the primary screening path
          const v2Signals = proxyAssessment.risk_signals;
          const filteredSignals = v2Signals.filter(
            (s) => SEVERITY_ORDER[s.severity] <= minSeverityOrder,
          );

          if (filteredSignals.length === 0) continue;

          // Also compute legacy signals for backward-compat text rendering
          const metrics = computeCamelsMetrics(fin, priorQuarters);
          const legacySignals = classifyRiskSignals(metrics, proxyAssessment.trend_insights);

          const components: ComponentScore[] = (["C", "A", "E", "L", "S"] as const).map((c) => scoreComponent(c, metrics));
          const comp = compositeScore(components);
          const profile = profileMap.get(cert);

          results.push({
            cert,
            name: String(profile?.NAME ?? `CERT ${cert}`),
            city: profile?.CITY ? String(profile.CITY) : null,
            state: profile?.STALP ? String(profile.STALP) : null,
            total_assets: asNumber(fin.ASSET),
            composite_rating: comp.rating,
            composite_label: comp.label,
            signals: filteredSignals,
            critical_count: filteredSignals.filter((s) => s.severity === "critical").length,
            warning_count: filteredSignals.filter((s) => s.severity === "warning").length,
            legacy_signals: legacySignals,
            proxy_summary: {
              overall: proxyAssessment.overall,
              capital_classification: {
                category: proxyAssessment.capital_classification.category,
                label: proxyAssessment.capital_classification.label,
              },
              data_quality: proxyAssessment.data_quality,
            },
          });
        }

        // Sort by severity: most critical first, then warning count, then composite rating
        results.sort((a, b) => {
          if (a.critical_count !== b.critical_count) return b.critical_count - a.critical_count;
          if (a.warning_count !== b.warning_count) return b.warning_count - a.warning_count;
          return b.composite_rating - a.composite_rating;
        });

        const returned = results.slice(0, params.limit);

        await sendProgressNotification(server.server, progressToken, 0.9, "Formatting results");

        const parts: string[] = [];
        parts.push(`Risk Signal Scan — ${results.length} flagged of ${allCurrentFinancials.length} institutions scanned`);
        parts.push(`Report Date: ${params.repdte} | Min Severity: ${params.min_severity}`);
        parts.push("NOTE: Public off-site analytical proxy — not official supervisory ratings.");
        parts.push("");

        if (returned.length === 0) {
          parts.push("No institutions flagged at the specified severity level.");
        }

        for (let i = 0; i < returned.length; i++) {
          const r = returned[i];
          const location = [r.city, r.state].filter(Boolean).join(", ");
          const assetStr = r.total_assets !== null ? `$${Math.round(r.total_assets).toLocaleString()}k` : "n/a";
          parts.push(`${i + 1}. ${r.name} (${location}) CERT ${r.cert} | Assets: ${assetStr}`);
          parts.push(`   Composite: ${formatRating(r.composite_rating as Rating)} | Critical: ${r.critical_count} | Warnings: ${r.warning_count}`);
          for (const s of r.signals) {
            const icon = s.severity === "critical" ? "🔴" : s.severity === "warning" ? "🟡" : "🔵";
            parts.push(`   ${icon} [${s.severity}] ${s.message}`);
          }
          parts.push("");
        }

        if (results.length > returned.length) {
          parts.push(`Showing ${returned.length} of ${results.length} flagged institutions. Increase limit to see more.`);
        }

        const text = truncateIfNeeded(parts.join("\n"), CHARACTER_LIMIT);

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            model: "public_camels_proxy_v1" as const,
            official_status: "public off-site proxy, not official CAMELS" as const,
            proxy: null,
            report_date: params.repdte,
            min_severity: params.min_severity,
            institutions_scanned: allCurrentFinancials.length,
            institutions_flagged: results.length,
            returned_count: returned.length,
            institutions: returned,
          },
        };
      } catch (err) {
        return formatToolError(err);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
