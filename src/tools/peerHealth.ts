import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  queryEndpoint,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { FdicPeerHealthOutputSchema } from "../schemas/output.js";
import {
  ANALYSIS_TIMEOUT_MS,
  MAX_CONCURRENCY,
  asNumber,
  buildCertFilters,
  getDefaultReportDate,
  mapWithConcurrency,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import { extractCanonicalMetrics, CANONICAL_FIELDS } from "./shared/metricNormalization.js";
import { computePeerStats, computeWeightedAggregate, type PeerStats } from "./shared/peerEngine.js";
import { assembleProxyAssessment, type OverallBand, type ProxyAssessment } from "./shared/publicCamelsProxy.js";
import { fetchHistoryEvents } from "./shared/historyFetch.js";
import {
  computeCamelsMetrics,
  scoreComponent,
  compositeScore,
  type ComponentScore,
} from "./shared/camelsScoring.js";

interface PeerHealthEntry {
  cert: number;
  name: string;
  name_source: "fdic_institution_profile" | "cert_fallback";
  city: string | null;
  state: string | null;
  total_assets: number | null;
  /** Proxy model overall score on 1.0–4.0 scale */
  proxy_score: number;
  /** Proxy model overall band */
  proxy_band: OverallBand;
  /** Legacy composite rating (1-5) kept for backward compat */
  composite_rating: number;
  composite_label: string;
  component_ratings: Record<string, number>;
  flags: string[];
}

interface PeerHealthMetricRow {
  name: string;
  label: string;
  subject: number | null;
  peer_median: number | null;
  peer_weighted_avg: number | null;
  percentile: number | null;
  higher_is_better: boolean;
  is_outlier: boolean;
  outlier_direction: "high" | "low" | null;
}

interface PeerHealthProxyComponentSummary {
  name: string;
  label: string;
  score: number;
  legacy_rating: number;
  legacy_label: string;
  flags: string[];
}

interface PeerHealthProxySummary {
  model: "public_camels_proxy_v1";
  official_status: "public off-site proxy, not official CAMELS";
  score: number;
  band: OverallBand;
  components: PeerHealthProxyComponentSummary[];
  capital_classification: {
    category: string;
    label: string;
    binding_constraint: string | null;
    ratios_used: Record<string, number | null>;
  };
  management_overlay: {
    level: string;
    caps_band: boolean;
    reason_codes: string[];
  };
  risk_signal_count: number;
  risk_signal_severities: Record<string, number>;
  trend_count: number;
  data_quality: {
    report_date: string;
    staleness: string;
    gaps_count: number;
    gaps: string[];
  };
}

interface PeerHealthDeprecationNotice {
  path: string;
  status: "deprecated";
  replacement: string;
  removal_target: "future_major_release";
  note: string;
}

const PEER_HEALTH_DEPRECATIONS: PeerHealthDeprecationNotice[] = [
  {
    path: "peer_context.subject_percentiles",
    status: "deprecated",
    replacement: "metrics",
    removal_target: "future_major_release",
    note:
      "Use metrics[] for new subject-vs-peer UI bindings. The legacy camelCase percentile map remains for backward compatibility until a coordinated major release.",
  },
];

const PEER_METRICS: {
  key: "roaPct" | "equityCapitalRatioPct" | "netInterestMarginPct" | "efficiencyRatioPct" | "loanToDepositPct";
  legacyKey: string;
  name: string;
  label: string;
  higherIsBetter: boolean;
}[] = [
  // legacyKey preserves the original camelCase peer_context map keys for backward compatibility.
  // New UI consumers should bind to the flat metrics[].name snake_case values instead.
  { key: "roaPct", legacyKey: "roaPct", name: "roa_pct", label: "Return on assets", higherIsBetter: true },
  { key: "equityCapitalRatioPct", legacyKey: "equityCapitalRatioPct", name: "equity_capital_ratio_pct", label: "Equity capital ratio", higherIsBetter: true },
  { key: "netInterestMarginPct", legacyKey: "netInterestMarginPct", name: "net_interest_margin_pct", label: "Net interest margin", higherIsBetter: true },
  { key: "efficiencyRatioPct", legacyKey: "efficiencyRatioPct", name: "efficiency_ratio_pct", label: "Efficiency ratio", higherIsBetter: false },
  { key: "loanToDepositPct", legacyKey: "loanToDepositPct", name: "loan_to_deposit_pct", label: "Loan-to-deposit ratio", higherIsBetter: false },
];

function buildProxySummary(
  proxy: ProxyAssessment | null,
): PeerHealthProxySummary | null {
  if (!proxy) return null;

  const componentEntries = [
    { name: "capital", assessment: proxy.component_assessment.capital },
    { name: "asset_quality", assessment: proxy.component_assessment.asset_quality },
    { name: "earnings", assessment: proxy.component_assessment.earnings },
    { name: "liquidity_funding", assessment: proxy.component_assessment.liquidity_funding },
    { name: "sensitivity_proxy", assessment: proxy.component_assessment.sensitivity_proxy },
  ];

  const riskSignalSeverities: Record<string, number> = {};
  for (const signal of proxy.risk_signals) {
    riskSignalSeverities[signal.severity] =
      (riskSignalSeverities[signal.severity] ?? 0) + 1;
  }

  return {
    model: proxy.model,
    official_status: proxy.official_status,
    score: proxy.overall.score,
    band: proxy.overall.band,
    components: componentEntries.map(({ name, assessment }) => ({
      name,
      label: assessment.label,
      score: assessment.score,
      legacy_rating: assessment.legacy_rating,
      legacy_label: assessment.legacy_label,
      flags: assessment.flags,
    })),
    capital_classification: {
      category: proxy.capital_classification.category,
      label: proxy.capital_classification.label,
      binding_constraint: proxy.capital_classification.binding_constraint ?? null,
      ratios_used: proxy.capital_classification.ratios_used,
    },
    management_overlay: {
      level: proxy.management_overlay.level,
      caps_band: proxy.management_overlay.caps_band,
      reason_codes: proxy.management_overlay.reason_codes,
    },
    risk_signal_count: proxy.risk_signals.length,
    risk_signal_severities: riskSignalSeverities,
    trend_count: proxy.trend_insights.length,
    data_quality: proxy.data_quality,
  };
}

const PeerHealthInputSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Subject institution CERT to highlight in the ranking. Optional."),
  certs: z
    .array(z.number().int().positive())
    .max(50)
    .optional()
    .describe("Explicit list of CERTs to compare (max 50)."),
  state: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe('Two-letter state code to select all active institutions (e.g., "WY").'),
  asset_min: z
    .number()
    .positive()
    .optional()
    .describe("Minimum total assets ($thousands) for peer selection."),
  asset_max: z
    .number()
    .positive()
    .optional()
    .describe("Maximum total assets ($thousands) for peer selection."),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("Report Date (YYYYMMDD). Defaults to the most recent quarter."),
  sort_by: z
    .enum(["composite", "capital", "asset_quality", "earnings", "liquidity", "sensitivity"])
    .default("composite")
    .describe("Sort results by composite or a specific CAMELS component rating."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Max institutions to return in the response."),
});

function sortKeyToComponent(key: string): string | null {
  const map: Record<string, string> = {
    capital: "C",
    asset_quality: "A",
    earnings: "E",
    liquidity: "L",
    sensitivity: "S",
  };
  return map[key] ?? null;
}

export function registerPeerHealthTools(server: McpServer): void {
  server.registerTool(
    "fdic_compare_peer_health",
    {
      title: "Compare Peer Health (CAMELS Rankings)",
      description: `Compare CAMELS-style health scores across a group of FDIC-insured institutions.

Three usage modes:
  - Explicit list: provide certs (up to 50) for a specific comparison set
  - State-wide scan: provide state to compare all active institutions in that state
  - Asset-based: provide asset_min/asset_max to compare institutions by size

Optionally provide cert to highlight a subject institution's position in the ranking.

Output: structuredContent includes {model, official_status, report_date, institutions, metrics, peer_context, proxy_summary, proxy, deprecations}. Institutions include proxy scores and name_source. When a subject cert is provided, metrics[] is the preferred subject-vs-peer array for new UI bindings and proxy_summary is a flattened subject proxy. peer_context.subject_percentiles is deprecated, remains for backward compatibility, and is targeted for removal only in a future coordinated major release. Auto-peer selection derives asset bands from report-date financials and broadens the cohort if fewer than 10 peers match.

NOTE: Public off-site analytical proxy — not official supervisory ratings.`,
      inputSchema: PeerHealthInputSchema,
      outputSchema: FdicPeerHealthOutputSchema,
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
        if (!params.certs && !params.state && params.asset_min === undefined && params.asset_max === undefined && !params.cert) {
          return formatToolError(new Error("At least one selection criteria required: certs, state, asset_min/asset_max, or cert."));
        }

        const dateError = validateQuarterEndDate(params.repdte, "repdte");
        if (dateError) {
          return formatToolError(new Error(dateError));
        }

        await sendProgressNotification(server.server, progressToken, 0.1, "Building peer roster");

        const MIN_PEER_COUNT = 10;
        let peerCerts: number[];
        const broadeningSteps: string[] = [];

        if (params.certs) {
          peerCerts = [...params.certs];
          if (params.cert && !peerCerts.includes(params.cert)) {
            peerCerts.push(params.cert);
          }
        } else {
          // Peer roster construction uses two-stage filtering:
          // 1. Non-financial filters (state, charter class, active status) via institutions endpoint
          // 2. Asset-range filters via financials endpoint at the requested repdte
          //    (institutions ASSET is a current snapshot; financials ASSET is report-date consistent)
          const institutionFilters: string[] = ["ACTIVE:1"];
          if (params.state) institutionFilters.push(`STALP:${params.state}`);

          // Track asset range separately — applied to financials, not institutions
          let assetMin: number | null = params.asset_min ?? null;
          let assetMax: number | null = params.asset_max ?? null;

          // Auto-peer selection: derive asset band from report-date financials
          let subjectAsset: number | null = null;
          let bkclass: string | null = null;
          if (params.cert && !params.state && params.asset_min === undefined) {
            const [subjectFinResp, profileResp] = await Promise.all([
              queryEndpoint(
                ENDPOINTS.FINANCIALS,
                {
                  filters: `CERT:${params.cert} AND REPDTE:${params.repdte}`,
                  fields: "CERT,ASSET",
                  limit: 1,
                },
                { signal: controller.signal },
              ),
              queryEndpoint(
                ENDPOINTS.INSTITUTIONS,
                {
                  filters: `CERT:${params.cert}`,
                  fields: "CERT,STALP,BKCLASS",
                  limit: 1,
                },
                { signal: controller.signal },
              ),
            ]);
            const profileRecs = extractRecords(profileResp);
            if (profileRecs.length === 0) {
              return formatToolError(new Error(`No institution found with CERT ${params.cert}.`));
            }
            const subjectFinRecs = extractRecords(subjectFinResp);
            subjectAsset = subjectFinRecs.length > 0
              ? asNumber(subjectFinRecs[0].ASSET)
              : null;
            if (subjectAsset !== null) {
              assetMin = subjectAsset * 0.5;
              assetMax = subjectAsset * 2.0;
            }
            bkclass = typeof profileRecs[0].BKCLASS === "string"
              ? profileRecs[0].BKCLASS as string
              : null;
            if (bkclass) {
              institutionFilters.push(`BKCLASS:${bkclass}`);
            }
          }

          // Helper: query institutions endpoint for non-financial filters
          async function queryInstitutionCerts(filters: string[]): Promise<number[]> {
            const resp = await queryEndpoint(
              ENDPOINTS.INSTITUTIONS,
              {
                filters: filters.join(" AND "),
                fields: "CERT",
                limit: 10_000,
                sort_by: "CERT",
                sort_order: "ASC",
              },
              { signal: controller.signal },
            );
            return extractRecords(resp)
              .map((r) => asNumber(r.CERT))
              .filter((c): c is number => c !== null);
          }

          // Helper: filter CERTs by report-date asset range via financials endpoint
          async function filterByRepdateAssets(
            certs: number[],
            min: number,
            max: number,
          ): Promise<number[]> {
            const certFilterStrs = buildCertFilters(certs);
            const responses = await mapWithConcurrency(
              certFilterStrs,
              MAX_CONCURRENCY,
              async (certFilter) =>
                queryEndpoint(
                  ENDPOINTS.FINANCIALS,
                  {
                    filters: `(${certFilter}) AND REPDTE:${params.repdte} AND ASSET:[${min} TO ${max}]`,
                    fields: "CERT",
                    limit: 10_000,
                  },
                  { signal: controller.signal },
                ),
            );
            return responses
              .flatMap(extractRecords)
              .map((r) => asNumber(r.CERT))
              .filter((c): c is number => c !== null);
          }

          // Helper: build full peer roster with current filter state
          async function buildRoster(
            instFilters: string[],
            aMin: number | null,
            aMax: number | null,
          ): Promise<number[]> {
            const baseCerts = await queryInstitutionCerts(instFilters);
            if (baseCerts.length === 0) return [];
            if (aMin !== null && aMax !== null) {
              return filterByRepdateAssets(baseCerts, aMin, aMax);
            }
            return baseCerts;
          }

          peerCerts = await buildRoster(institutionFilters, assetMin, assetMax);

          // Broadening: if auto-peer cohort is too small, progressively relax filters
          if (params.cert && !params.certs && peerCerts.length < MIN_PEER_COUNT) {
            // Step 1: Drop charter class filter
            if (bkclass) {
              const withoutBkclass = institutionFilters.filter(f => !f.startsWith("BKCLASS:"));
              const broader = await buildRoster(withoutBkclass, assetMin, assetMax);
              if (broader.length > peerCerts.length) {
                peerCerts = broader;
                broadeningSteps.push(`Relaxed charter class filter (was BKCLASS:${bkclass})`);
                institutionFilters.length = 0;
                institutionFilters.push(...withoutBkclass);
              }
            }

            // Step 2: Widen asset band to 0.25x–4.0x if still too small
            if (peerCerts.length < MIN_PEER_COUNT && subjectAsset !== null) {
              const widerMin = subjectAsset * 0.25;
              const widerMax = subjectAsset * 4.0;
              const broader = await buildRoster(institutionFilters, widerMin, widerMax);
              if (broader.length > peerCerts.length) {
                peerCerts = broader;
                assetMin = widerMin;
                assetMax = widerMax;
                broadeningSteps.push(`Widened asset band from 0.5x–2.0x to 0.25x–4.0x`);
              }
            }
          }
        }

        if (peerCerts.length === 0) {
          return formatToolError(new Error("No institutions matched the specified criteria."));
        }

        await sendProgressNotification(server.server, progressToken, 0.4, `Fetching financials for ${peerCerts.length} institutions`);

        const certFilters = buildCertFilters(peerCerts);
        const financialResponses = await mapWithConcurrency(
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

        const allFinancials = financialResponses.flatMap(extractRecords);

        const rosterResp2 = await queryEndpoint(
          ENDPOINTS.INSTITUTIONS,
          {
            filters: peerCerts.length <= 25
              ? peerCerts.map((c) => `CERT:${c}`).join(" OR ")
              : `CERT:[${Math.min(...peerCerts)} TO ${Math.max(...peerCerts)}]`,
            fields: "CERT,NAME,CITY,STALP",
            limit: 10_000,
            sort_by: "CERT",
            sort_order: "ASC",
          },
          { signal: controller.signal },
        );
        const profileMap = new Map<number, Record<string, unknown>>();
        for (const r of extractRecords(rosterResp2)) {
          const c = asNumber(r.CERT);
          if (c !== null) profileMap.set(c, r);
        }

        const financialCerts = allFinancials
          .map((r) => asNumber(r.CERT))
          .filter((cert): cert is number => cert !== null);
        const missingProfileCerts = financialCerts.filter((cert) => {
          const profile = profileMap.get(cert);
          return !profile || typeof profile.NAME !== "string" || profile.NAME.length === 0;
        });
        if (missingProfileCerts.length > 0) {
          const missingProfileFilters = buildCertFilters(missingProfileCerts);
          const missingProfileResponses = await mapWithConcurrency(
            missingProfileFilters,
            MAX_CONCURRENCY,
            async (certFilter) =>
              queryEndpoint(
                ENDPOINTS.INSTITUTIONS,
                {
                  filters: certFilter,
                  fields: "CERT,NAME,CITY,STALP",
                  limit: 10_000,
                  sort_by: "CERT",
                  sort_order: "ASC",
                },
                { signal: controller.signal },
              ),
          );
          for (const r of missingProfileResponses.flatMap(extractRecords)) {
            const c = asNumber(r.CERT);
            if (c !== null) profileMap.set(c, r);
          }
        }

        await sendProgressNotification(server.server, progressToken, 0.7, "Computing proxy assessments");

        // Fetch history for subject bank if specified (best-effort, additive)
        const subjectHistory = params.cert
          ? await fetchHistoryEvents(params.cert, { signal: controller.signal, repdte: params.repdte })
          : [];

        let subjectProxy: ProxyAssessment | null = null;
        const entries: PeerHealthEntry[] = [];
        for (const fin of allFinancials) {
          const cert = asNumber(fin.CERT);
          if (cert === null) continue;

          const proxyAssessment = assembleProxyAssessment({
            rawFinancials: fin,
            repdte: params.repdte,
            historyEvents: cert === params.cert ? subjectHistory : undefined,
          });
          if (cert === params.cert) {
            subjectProxy = proxyAssessment;
          }

          const legacyMetrics = computeCamelsMetrics(fin);
          const legacyComponents: ComponentScore[] = (["C", "A", "E", "L", "S"] as const).map(
            (c) => scoreComponent(c, legacyMetrics),
          );
          const legacyComposite = compositeScore(legacyComponents);

          const profile = profileMap.get(cert);
          const ca = proxyAssessment.component_assessment;

          // Map component assessments to legacy-style ratings for backward compat
          const componentRatings: Record<string, number> = {
            C: ca.capital.legacy_rating,
            A: ca.asset_quality.legacy_rating,
            E: ca.earnings.legacy_rating,
            L: ca.liquidity_funding.legacy_rating,
            S: ca.sensitivity_proxy.legacy_rating,
          };

          // Collect flags from all components
          const flags = [
            ...ca.capital.flags,
            ...ca.asset_quality.flags,
            ...ca.earnings.flags,
            ...ca.liquidity_funding.flags,
            ...ca.sensitivity_proxy.flags,
          ];

          entries.push({
            cert,
            name: typeof profile?.NAME === "string" && profile.NAME.length > 0
              ? profile.NAME
              : `CERT ${cert}`,
            name_source: typeof profile?.NAME === "string" && profile.NAME.length > 0
              ? "fdic_institution_profile"
              : "cert_fallback",
            city: profile?.CITY ? String(profile.CITY) : null,
            state: profile?.STALP ? String(profile.STALP) : null,
            total_assets: asNumber(fin.ASSET),
            proxy_score: proxyAssessment.overall.score,
            proxy_band: proxyAssessment.overall.band,
            composite_rating: legacyComposite.rating,
            composite_label: legacyComposite.label,
            component_ratings: componentRatings,
            flags,
          });
        }

        const sortComponent = sortKeyToComponent(params.sort_by);
        entries.sort((a, b) => {
          if (sortComponent) {
            const aVal = a.component_ratings[sortComponent] ?? 3;
            const bVal = b.component_ratings[sortComponent] ?? 3;
            if (aVal !== bVal) return aVal - bVal;
          } else {
            // Sort by proxy score descending (higher = healthier)
            if (a.proxy_score !== b.proxy_score) return b.proxy_score - a.proxy_score;
          }
          return (b.total_assets ?? 0) - (a.total_assets ?? 0);
        });

        const subjectRank = params.cert
          ? entries.findIndex((e) => e.cert === params.cert) + 1
          : null;

        // Compute peer percentile context for the subject institution
        let peerContext: {
          peer_count: number;
          peer_definition: string;
          broadening_steps: string[];
          subject_rank: number | null;
          subject_percentiles: Record<string, PeerStats>;
          weighted_peer_averages: Record<string, number>;
        } | null = null;
        let metricRows: PeerHealthMetricRow[] = [];

        if (params.cert) {
          const subjectFin = allFinancials.find((f) => asNumber(f.CERT) === params.cert);
          if (subjectFin) {
            const subjectExtraction = extractCanonicalMetrics(subjectFin);
            const sm = subjectExtraction.metrics;

            // Collect metric values from all peers (excluding subject)
            const peerFinancials = allFinancials.filter((f) => asNumber(f.CERT) !== params.cert);
            const peerExtractions = peerFinancials.map((f) => extractCanonicalMetrics(f));

            const subjectPercentiles: Record<string, PeerStats> = {};
            const weightedPeerAverages: Record<string, number> = {};
            for (const pm of PEER_METRICS) {
              const subjectVal = sm[pm.key];
              // Build value + weight pairs for weighted aggregate (weight = totalAssets)
              const weightedEntries: { value: number; weight: number }[] = [];
              const peerValues: number[] = [];
              for (const pe of peerExtractions) {
                const v = pe.metrics[pm.key];
                if (v === null) continue;
                peerValues.push(v);
                const w = pe.metrics.totalAssets;
                if (w !== null && w > 0) {
                  weightedEntries.push({ value: v, weight: w });
                }
              }
              if (peerValues.length === 0) continue;
              let stats: PeerStats | null = null;
              if (subjectVal !== null) {
                stats = computePeerStats(subjectVal, peerValues, {
                  higherIsBetter: pm.higherIsBetter,
                });
                subjectPercentiles[pm.legacyKey] = stats;
              }
              const weighted = computeWeightedAggregate(weightedEntries);
              if (weighted !== null) {
                weightedPeerAverages[pm.legacyKey] = Math.round(weighted * 100) / 100;
              }
              metricRows.push({
                name: pm.name,
                label: pm.label,
                subject: subjectVal,
                peer_median: stats?.peer_median ?? null,
                peer_weighted_avg: weighted !== null ? Math.round(weighted * 100) / 100 : null,
                percentile: stats?.subject_percentile ?? null,
                higher_is_better: pm.higherIsBetter,
                is_outlier: stats?.is_outlier ?? false,
                outlier_direction: stats?.outlier_direction ?? null,
              });
            }

            // Build peer definition string
            let peerDef: string;
            if (params.certs) {
              peerDef = `CERTs ${params.certs.join(",")}`;
            } else if (params.state) {
              peerDef = `Active institutions in ${params.state}`;
            } else if (params.asset_min !== undefined || params.asset_max !== undefined) {
              const minStr = params.asset_min !== undefined ? `$${params.asset_min.toLocaleString()}k` : "any";
              const maxStr = params.asset_max !== undefined ? `$${params.asset_max.toLocaleString()}k` : "any";
              peerDef = `Active institutions with assets ${minStr}–${maxStr}`;
            } else {
              peerDef = `Auto-selected peers by asset size and charter class`;
            }

            peerContext = {
              peer_count: entries.length,
              peer_definition: peerDef,
              broadening_steps: broadeningSteps,
              subject_rank: subjectRank,
              subject_percentiles: subjectPercentiles,
              weighted_peer_averages: weightedPeerAverages,
            };
          }
        }

        const returned = entries.slice(0, params.limit);

        await sendProgressNotification(server.server, progressToken, 0.9, "Formatting results");

        const parts: string[] = [];
        parts.push(`Peer Health Comparison — ${entries.length} institutions ranked by ${params.sort_by}`);
        parts.push(`Report Date: ${params.repdte}`);
        parts.push("NOTE: Public off-site analytical proxy — not official supervisory ratings.");
        parts.push("");

        if (broadeningSteps.length > 0) {
          parts.push(`Peer broadening: ${broadeningSteps.join("; ")}`);
          parts.push("");
        }

        if (subjectRank && subjectRank > 0 && params.cert) {
          const subj = entries[subjectRank - 1];
          parts.push(`Subject: ${subj.name} (CERT ${subj.cert}) — Rank ${subjectRank} of ${entries.length}, Assessment: ${subj.proxy_band} (${subj.proxy_score.toFixed(2)}/4.0)`);
          if (peerContext && Object.keys(peerContext.subject_percentiles).length > 0) {
            const pctParts: string[] = [];
            for (const [metric, stats] of Object.entries(peerContext.subject_percentiles)) {
              pctParts.push(`${metric}: P${Math.round(stats.subject_percentile)}`);
            }
            parts.push(`  Peer percentiles: ${pctParts.join(", ")}`);
          }
          parts.push("");
        }

        for (let i = 0; i < returned.length; i++) {
          const e = returned[i];
          const rank = entries.indexOf(e) + 1;
          const marker = params.cert && e.cert === params.cert ? " ◄ SUBJECT" : "";
          const location = [e.city, e.state].filter(Boolean).join(", ");
          const compStr = (["C", "A", "E", "L", "S"] as const)
            .map((c) => `${c}:${e.component_ratings[c] ?? "?"}`)
            .join(" ");
          const assetStr = e.total_assets !== null ? `$${Math.round(e.total_assets).toLocaleString()}k` : "n/a";
          parts.push(
            `${String(rank).padStart(3)}. ${e.name} (${location}) CERT ${e.cert}${marker}`,
          );
          parts.push(
            `     Assessment: ${e.proxy_band} (${e.proxy_score.toFixed(2)}/4.0) | ${compStr} | Assets: ${assetStr}`,
          );
          if (e.flags.length > 0) {
            parts.push(`     Flags: ${e.flags.join("; ")}`);
          }
        }

        if (entries.length > returned.length) {
          parts.push("");
          parts.push(`Showing ${returned.length} of ${entries.length}. Increase limit to see more.`);
        }

        const text = truncateIfNeeded(parts.join("\n"), CHARACTER_LIMIT);

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            model: "public_camels_proxy_v1" as const,
            official_status: "public off-site proxy, not official CAMELS" as const,
            proxy: subjectProxy,
            proxy_summary: buildProxySummary(subjectProxy),
            report_date: params.repdte,
            sort_by: params.sort_by,
            total_institutions: entries.length,
            returned_count: returned.length,
            subject_cert: params.cert ?? null,
            subject_rank: subjectRank,
            metrics: metricRows,
            institutions: returned,
            peer_context: peerContext,
            deprecations: PEER_HEALTH_DEPRECATIONS,
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
