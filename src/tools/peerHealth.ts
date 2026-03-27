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
  mapWithConcurrency,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import { extractCanonicalMetrics, CANONICAL_FIELDS } from "./shared/metricNormalization.js";
import { computePeerStats, type PeerStats } from "./shared/peerEngine.js";
import { assembleProxyAssessment, type OverallBand } from "./shared/publicCamelsProxy.js";
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

Output: Ranked list of institutions with CAMELS composite and component scores, sorted by composite or any individual component. When a subject cert is provided, includes peer percentile context for key metrics (ROA, equity ratio, NIM, efficiency ratio, loan-to-deposit).

NOTE: Public off-site analytical proxy — not official supervisory ratings.`,
      inputSchema: PeerHealthInputSchema,
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

        let peerCerts: number[];

        if (params.certs) {
          peerCerts = [...params.certs];
          if (params.cert && !peerCerts.includes(params.cert)) {
            peerCerts.push(params.cert);
          }
        } else {
          const filterParts: string[] = ["ACTIVE:1"];
          if (params.state) filterParts.push(`STALP:${params.state}`);
          if (params.asset_min !== undefined || params.asset_max !== undefined) {
            const min = params.asset_min ?? 0;
            const max = params.asset_max ?? "*";
            filterParts.push(`ASSET:[${min} TO ${max}]`);
          }
          if (params.cert && !params.state && params.asset_min === undefined) {
            const profileResp = await queryEndpoint(
              ENDPOINTS.INSTITUTIONS,
              {
                filters: `CERT:${params.cert}`,
                fields: "CERT,ASSET,STALP,BKCLASS",
                limit: 1,
              },
              { signal: controller.signal },
            );
            const profileRecs = extractRecords(profileResp);
            if (profileRecs.length === 0) {
              return formatToolError(new Error(`No institution found with CERT ${params.cert}.`));
            }
            const subjectAsset = asNumber(profileRecs[0].ASSET);
            if (subjectAsset !== null) {
              filterParts.push(`ASSET:[${subjectAsset * 0.5} TO ${subjectAsset * 2.0}]`);
            }
            const bkclass = profileRecs[0].BKCLASS;
            if (typeof bkclass === "string") {
              filterParts.push(`BKCLASS:${bkclass}`);
            }
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
          peerCerts = extractRecords(rosterResp)
            .map((r) => asNumber(r.CERT))
            .filter((c): c is number => c !== null);
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

        await sendProgressNotification(server.server, progressToken, 0.7, "Computing proxy assessments");

        // Fetch history for subject bank if specified (best-effort, additive)
        const subjectHistory = params.cert
          ? await fetchHistoryEvents(params.cert, { signal: controller.signal })
          : [];

        const entries: PeerHealthEntry[] = [];
        for (const fin of allFinancials) {
          const cert = asNumber(fin.CERT);
          if (cert === null) continue;

          const proxyAssessment = assembleProxyAssessment({
            rawFinancials: fin,
            repdte: params.repdte,
            historyEvents: cert === params.cert ? subjectHistory : undefined,
          });

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
            name: String(profile?.NAME ?? `CERT ${cert}`),
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
          subject_rank: number | null;
          subject_percentiles: Record<string, PeerStats>;
        } | null = null;

        if (params.cert) {
          const subjectFin = allFinancials.find((f) => asNumber(f.CERT) === params.cert);
          if (subjectFin) {
            const subjectExtraction = extractCanonicalMetrics(subjectFin);
            const sm = subjectExtraction.metrics;

            const PEER_METRICS: { key: keyof typeof sm; label: string; higherIsBetter: boolean }[] = [
              { key: "roaPct", label: "roaPct", higherIsBetter: true },
              { key: "equityCapitalRatioPct", label: "equityCapitalRatioPct", higherIsBetter: true },
              { key: "netInterestMarginPct", label: "netInterestMarginPct", higherIsBetter: true },
              { key: "efficiencyRatioPct", label: "efficiencyRatioPct", higherIsBetter: false },
              { key: "loanToDepositPct", label: "loanToDepositPct", higherIsBetter: false },
            ];

            // Collect metric values from all peers (excluding subject)
            const peerFinancials = allFinancials.filter((f) => asNumber(f.CERT) !== params.cert);
            const peerExtractions = peerFinancials.map((f) => extractCanonicalMetrics(f).metrics);

            const subjectPercentiles: Record<string, PeerStats> = {};
            for (const pm of PEER_METRICS) {
              const subjectVal = sm[pm.key];
              if (subjectVal === null) continue;
              const peerValues = peerExtractions
                .map((pe) => pe[pm.key])
                .filter((v): v is number => v !== null);
              if (peerValues.length === 0) continue;
              subjectPercentiles[pm.label] = computePeerStats(subjectVal, peerValues, {
                higherIsBetter: pm.higherIsBetter,
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
              subject_rank: subjectRank,
              subject_percentiles: subjectPercentiles,
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
            report_date: params.repdte,
            sort_by: params.sort_by,
            total_institutions: entries.length,
            returned_count: returned.length,
            subject_cert: params.cert ?? null,
            subject_rank: subjectRank,
            institutions: returned,
            peer_context: peerContext,
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
