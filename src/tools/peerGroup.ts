import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  computeMedian,
  deriveMetrics,
  type DerivedMetrics,
} from "./shared/financialMetrics.js";
import {
  buildTruncationWarning,
  queryEndpoint,
  extractRecords,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import {
  buildInvalidFieldError,
  findInvalidEndpointFields,
} from "../services/fdicSchema.js";
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

export interface RankResult {
  rank: number;
  of: number;
  percentile: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function computeCompetitionRank(
  subjectValue: number,
  peerValues: number[],
  higherIsBetter: boolean | null,
): RankResult | null {
  if (peerValues.length === 0) return null;

  const ascending = higherIsBetter === false;
  const all = [...peerValues, subjectValue];
  const sorted = [...all].sort((a, b) =>
    ascending ? a - b : b - a,
  );

  // Assign competition ranks: tied values get the same rank
  const ranks = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    if (!ranks.has(sorted[i])) {
      ranks.set(sorted[i], i + 1);
    }
  }

  const rank = ranks.get(subjectValue)!;
  const of = all.length;
  const percentile = Math.round((1 - (rank - 1) / of) * 100);

  return { rank, of, percentile };
}

export function formatRepdteHuman(repdte: string): string {
  if (repdte.length !== 8) return repdte;
  const year = Number.parseInt(repdte.slice(0, 4), 10);
  const month = Number.parseInt(repdte.slice(4, 6), 10);
  const day = Number.parseInt(repdte.slice(6, 8), 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return repdte;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return repdte;
  }

  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

interface MetricDefinition {
  higher_is_better: boolean | null;
  unit: string;
  label: string;
  ranking_note?: string;
}

export const METRIC_KEYS = [
  "asset",
  "dep",
  "roa",
  "roe",
  "netnim",
  "equity_ratio",
  "efficiency_ratio",
  "loan_to_deposit",
  "deposits_to_assets",
  "noninterest_income_share",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  asset: { higher_is_better: true, unit: "$thousands", label: "Total Assets" },
  dep: { higher_is_better: true, unit: "$thousands", label: "Total Deposits" },
  roa: { higher_is_better: true, unit: "%", label: "Return on Assets" },
  roe: { higher_is_better: true, unit: "%", label: "Return on Equity" },
  netnim: {
    higher_is_better: true,
    unit: "%",
    label: "Net Interest Margin",
  },
  equity_ratio: {
    higher_is_better: true,
    unit: "%",
    label: "Equity Capital Ratio",
  },
  efficiency_ratio: {
    higher_is_better: false,
    unit: "%",
    label: "Efficiency Ratio",
  },
  loan_to_deposit: {
    higher_is_better: null,
    unit: "ratio",
    label: "Loan-to-Deposit Ratio",
    ranking_note:
      "Rank and percentile reflect position by value (1 = highest). Directionality is context-dependent.",
  },
  deposits_to_assets: {
    higher_is_better: null,
    unit: "ratio",
    label: "Deposits-to-Assets Ratio",
    ranking_note:
      "Rank and percentile reflect position by value (1 = highest). Directionality is context-dependent.",
  },
  noninterest_income_share: {
    higher_is_better: true,
    unit: "ratio",
    label: "Non-Interest Income Share",
  },
};

export const PeerGroupInputSchema = z
  .object({
    cert: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Subject institution CERT number. When provided, auto-derives peer criteria and ranks this bank against peers.",
      ),
    repdte: z
      .string()
      .regex(/^\d{8}$/)
      .optional()
      .describe(
        "Report Date (REPDTE) in YYYYMMDD format. FDIC data is published quarterly on: March 31, June 30, September 30, and December 31. Example: 20231231 for Q4 2023. If omitted, defaults to the most recent quarter-end date likely to have published data (~90-day lag).",
      ),
    asset_min: z
      .number()
      .positive()
      .optional()
      .describe(
        "Minimum total assets ($thousands) for peer selection. Defaults to 50% of subject's report-date assets when cert is provided.",
      ),
    asset_max: z
      .number()
      .positive()
      .optional()
      .describe(
        "Maximum total assets ($thousands) for peer selection. Defaults to 200% of subject's report-date assets when cert is provided.",
      ),
    charter_classes: z
      .array(z.string())
      .optional()
      .describe(
        'Charter class codes to include (e.g., ["N", "SM"]). Defaults to the subject\'s charter class when cert is provided.',
      ),
    state: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .describe('Two-letter state code (e.g., "NC", "TX").'),
    raw_filter: z
      .string()
      .optional()
      .describe(
        "Advanced: raw ElasticSearch query string appended to peer selection criteria with AND.",
      ),
    active_only: z
      .boolean()
      .default(true)
      .describe(
        "Limit to institutions where ACTIVE:1 (currently operating, FDIC-insured).",
      ),
    extra_fields: z
      .array(z.string())
      .optional()
      .describe(
        "Additional FDIC field names to include as raw values in the response. Does not affect peer selection.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe(
        "Max peer records returned in the response. All matched peers are used for ranking regardless of this limit.",
      ),
  });

type PeerGroupParams = z.infer<typeof PeerGroupInputSchema>;

function validatePeerGroupParams(value: PeerGroupParams): string | null {
  if (
    !value.cert &&
    value.asset_min === undefined &&
    value.asset_max === undefined &&
    !value.charter_classes &&
    !value.state &&
    !value.raw_filter
  ) {
    return "At least one peer-group constructor is required: cert, asset_min, asset_max, charter_classes, state, or raw_filter.";
  }

  if (
    value.asset_min !== undefined &&
    value.asset_max !== undefined &&
    value.asset_min > value.asset_max
  ) {
    return "asset_min must be <= asset_max.";
  }

  return null;
}

function validateExtraFields(
  extraFields: string[] | undefined,
): Error | null {
  if (!extraFields || extraFields.length === 0) {
    return null;
  }

  const invalidFields = findInvalidEndpointFields(
    ENDPOINTS.FINANCIALS,
    extraFields,
  );
  if (invalidFields.length === 0) {
    return null;
  }

  return buildInvalidFieldError(ENDPOINTS.FINANCIALS, invalidFields);
}

const FINANCIAL_FIELDS =
  "CERT,ASSET,DEP,NETINC,ROA,ROE,NETNIM,EQTOT,LNLSNET,INTINC,EINTEXP,NONII,NONIX";

interface PeerEntry {
  cert: number;
  name: string;
  city: string | null;
  stalp: string | null;
  bkclass: string | null;
  metrics: DerivedMetrics;
  extraFields: Record<string, unknown>;
}

function comparePeerEntriesByAsset(left: PeerEntry, right: PeerEntry): number {
  const primary = (right.metrics.asset ?? 0) - (left.metrics.asset ?? 0);
  if (primary !== 0) {
    return primary;
  }

  // Tie-break by CERT/name so peer ordering is deterministic across runs.
  if (left.cert !== right.cert) {
    return left.cert - right.cert;
  }

  return left.name.localeCompare(right.name);
}

function formatMetricValue(key: MetricKey, value: number | null): string {
  if (value === null) return "n/a";
  const def = METRIC_DEFINITIONS[key];
  if (def.unit === "$thousands")
    return `$${Math.round(value).toLocaleString()}k`;
  if (def.unit === "%") return `${value.toFixed(4)}%`;
  return value.toFixed(4);
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function formatPeerGroupText(
  repdte: string,
  subjectProfile: Record<string, unknown> | null,
  subjectMetrics: DerivedMetrics | null,
  rankings: Record<string, RankResult | null>,
  medians: Record<string, number | null>,
  returnedPeers: PeerEntry[],
  peerCount: number,
  warnings: string[],
): string {
  const parts: string[] = [];

  for (const warning of warnings) {
    parts.push(`Warning: ${warning}`);
  }

  const dateStr = formatRepdteHuman(repdte);
  const subjectLabel = subjectProfile
    ? ` for ${subjectProfile.NAME} (CERT ${subjectProfile.CERT ?? ""})`
    : "";
  parts.push(`Peer group analysis${subjectLabel} as of ${dateStr}.`);
  parts.push(`${peerCount} peers matched.`);

  if (subjectMetrics && subjectProfile) {
    parts.push("");
    parts.push("Subject rankings:");
    for (const key of METRIC_KEYS) {
      const def = METRIC_DEFINITIONS[key];
      const ranking = rankings[key];
      const value = formatMetricValue(key, subjectMetrics[key]);
      const medianValue = formatMetricValue(key, medians[key] ?? null);
      if (ranking) {
        const pctLabel = `${ordinalSuffix(ranking.percentile)} percentile`;
        parts.push(
          `  ${def.label.padEnd(28)} rank ${String(ranking.rank).padStart(2)} of ${String(ranking.of).padEnd(4)} (${pctLabel.padEnd(18)})  ${value.padStart(16)}  median: ${medianValue}`,
        );
      } else {
        parts.push(`  ${def.label.padEnd(28)} n/a`);
      }
    }
  } else if (peerCount > 0) {
    parts.push("");
    parts.push("Peer group medians:");
    const medianParts = METRIC_KEYS.filter((k) => medians[k] !== null).map(
      (k) =>
        `${METRIC_DEFINITIONS[k].label}: ${formatMetricValue(k, medians[k] ?? null)}`,
    );
    parts.push(`  ${medianParts.join(" | ")}`);
  }

  if (returnedPeers.length > 0) {
    parts.push("");
    parts.push(`Peers (${returnedPeers.length} returned):`);
    for (let i = 0; i < returnedPeers.length; i++) {
      const p = returnedPeers[i];
      const location = [p.city, p.stalp].filter(Boolean).join(" ");
      const locationStr = location ? `, ${location}` : "";
      parts.push(
        `${i + 1}. ${p.name}${locationStr} (CERT ${p.cert}) | ` +
          `Asset: ${formatMetricValue("asset", p.metrics.asset)} | ` +
          `ROA: ${formatMetricValue("roa", p.metrics.roa)} | ` +
          `ROE: ${formatMetricValue("roe", p.metrics.roe)}`,
      );
    }
  }

  return parts.join("\n");
}

export function registerPeerGroupTools(server: McpServer): void {
  server.registerTool(
    "fdic_peer_group_analysis",
    {
      title: "Peer Group Analysis",
      description: `Build a peer group for an FDIC-insured institution and rank it against peers on financial and efficiency metrics at a single report date.

Three usage modes:
  - Subject-driven: provide cert and repdte — auto-derives peer criteria from the subject's asset size and charter class
  - Explicit criteria: provide repdte plus asset_min/asset_max, charter_classes, state, or raw_filter
  - Subject with overrides: provide cert plus explicit criteria to override auto-derived defaults

Metrics ranked (fixed order):
  - Total Assets, Total Deposits, ROA, ROE, Net Interest Margin
  - Equity Capital Ratio, Efficiency Ratio, Loan-to-Deposit Ratio
  - Deposits-to-Assets Ratio, Non-Interest Income Share

Rankings use competition rank (1, 2, 2, 4). Rank, denominator, and percentile all use the same comparison set: matched peers plus the subject institution.

Output includes:
  - Subject rankings and percentiles (when cert provided)
  - Peer group medians
  - Peer list with CERTs (pass to fdic_compare_bank_snapshots for trend analysis)
  - Metric definitions with directionality metadata

Override precedence: cert derives defaults, then explicit params override them.`,
      inputSchema: PeerGroupInputSchema,
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
        const validationError = validatePeerGroupParams(params);
        if (validationError) {
          return formatToolError(new Error(validationError));
        }

        const dateError = validateQuarterEndDate(params.repdte, "repdte");
        if (dateError) {
          return formatToolError(new Error(dateError));
        }

        const extraFieldsError = validateExtraFields(params.extra_fields);
        if (extraFieldsError) {
          return formatToolError(extraFieldsError);
        }

        await sendProgressNotification(
          server.server,
          progressToken,
          0.1,
          "Resolving subject and peer criteria",
        );

        const warnings: string[] = [];
        let subjectProfile: Record<string, unknown> | null = null;
        let subjectFinancials: Record<string, unknown> | null = null;

        // --- Phase 1: Resolve subject ---
        if (params.cert) {
          const [profileResponse, financialsResponse] = await Promise.all([
            queryEndpoint(
              ENDPOINTS.INSTITUTIONS,
              {
                filters: `CERT:${params.cert}`,
                fields: "CERT,NAME,CITY,STALP,BKCLASS",
                limit: 1,
              },
              { signal: controller.signal },
            ),
            queryEndpoint(
              ENDPOINTS.FINANCIALS,
              {
                filters: `CERT:${params.cert} AND REPDTE:${params.repdte}`,
                fields: FINANCIAL_FIELDS,
                limit: 1,
              },
              { signal: controller.signal },
            ),
          ]);

          const profileRecords = extractRecords(profileResponse);
          if (profileRecords.length === 0) {
            return formatToolError(
              new Error(
                `No institution found with CERT number ${params.cert}.`,
              ),
            );
          }
          subjectProfile = profileRecords[0];

          const financialRecords = extractRecords(financialsResponse);
          if (financialRecords.length === 0) {
            return formatToolError(
              new Error(
                `No financial data for CERT ${params.cert} at report date ${params.repdte}. ` +
                  `FDIC quarterly data is published ~90 days after each quarter-end (March 31, June 30, September 30, December 31). ` +
                  `Try an earlier quarter-end date, or verify the institution was active at that date.`,
              ),
            );
          }
          subjectFinancials = financialRecords[0];
        }

        // Derive defaults and apply overrides
        const subjectAsset =
          subjectFinancials && typeof subjectFinancials.ASSET === "number"
            ? subjectFinancials.ASSET
            : null;

        const assetMin =
          params.asset_min ??
          (subjectAsset !== null ? subjectAsset * 0.5 : undefined);
        const assetMax =
          params.asset_max ??
          (subjectAsset !== null ? subjectAsset * 2.0 : undefined);
        const charterClasses =
          params.charter_classes ??
          (subjectProfile && typeof subjectProfile.BKCLASS === "string"
            ? [subjectProfile.BKCLASS]
            : undefined);
        const { state, active_only, raw_filter } = params;

        // --- Phase 2: Build peer roster ---
        await sendProgressNotification(
          server.server,
          progressToken,
          0.4,
          "Fetching peer roster",
        );

        const filterParts: string[] = [];
        if (assetMin !== undefined || assetMax !== undefined) {
          const min = assetMin ?? 0;
          const max = assetMax ?? "*";
          filterParts.push(`ASSET:[${min} TO ${max}]`);
        }
        if (charterClasses && charterClasses.length > 0) {
          const classFilter = charterClasses
            .map((cls) => `BKCLASS:${cls}`)
            .join(" OR ");
          filterParts.push(
            charterClasses.length > 1 ? `(${classFilter})` : classFilter,
          );
        }
        if (state) filterParts.push(`STALP:${state}`);
        if (active_only) filterParts.push("ACTIVE:1");
        if (raw_filter) filterParts.push(`(${raw_filter})`);

        const rosterResponse = await queryEndpoint(
          ENDPOINTS.INSTITUTIONS,
          {
            filters: filterParts.join(" AND "),
            fields: "CERT,NAME,CITY,STALP,BKCLASS",
            limit: 10_000,
            offset: 0,
            sort_by: "CERT",
            sort_order: "ASC",
          },
          { signal: controller.signal },
        );

        let rosterRecords = extractRecords(rosterResponse);
        if (rosterResponse.meta.total > rosterRecords.length) {
          warnings.push(
            `Institution roster truncated to ${rosterRecords.length.toLocaleString()} records ` +
              `out of ${rosterResponse.meta.total.toLocaleString()} matched institutions. ` +
              `Narrow the peer group criteria for complete analysis.`,
          );
        }

        // Remove subject from roster
        if (params.cert) {
          rosterRecords = rosterRecords.filter(
            (r) => asNumber(r.CERT) !== params.cert,
          );
        }

        const criteriaUsed = {
          asset_min: assetMin ?? null,
          asset_max: assetMax ?? null,
          charter_classes: charterClasses ?? null,
          state: state ?? null,
          active_only,
          raw_filter: raw_filter ?? null,
        };

        if (rosterRecords.length === 0) {
          const subjectMetrics = subjectFinancials
            ? deriveMetrics(subjectFinancials)
            : null;
          const output: Record<string, unknown> = {};

          if (subjectProfile) {
            output.subject = {
              cert: params.cert,
              name: subjectProfile.NAME,
              city: subjectProfile.CITY,
              stalp: subjectProfile.STALP,
              bkclass: subjectProfile.BKCLASS,
              metrics: subjectMetrics,
              rankings: null,
            };
          }

          output.peer_group = {
            repdte: params.repdte,
            criteria_used: criteriaUsed,
            medians: {},
          };
          output.metric_definitions = METRIC_DEFINITIONS;
          output.peers = [];
          output.peer_count = 0;
          output.returned_count = 0;
          output.has_more = false;
          output.message = "No peers matched the specified criteria.";
          output.warnings = warnings;

          const text = formatPeerGroupText(
            params.repdte,
            subjectProfile,
            subjectMetrics,
            {},
            {},
            [],
            0,
            warnings,
          );

          return {
            content: [{ type: "text", text }],
            structuredContent: output,
          };
        }

        // --- Phase 3: Fetch peer financials ---
        const peerCerts = rosterRecords
          .map((r) => asNumber(r.CERT))
          .filter((c): c is number => c !== null);

        await sendProgressNotification(
          server.server,
          progressToken,
          0.7,
          "Fetching peer financials",
        );

        const certFilters = buildCertFilters(peerCerts);
        const extraFieldsCsv =
          params.extra_fields && params.extra_fields.length > 0
            ? "," + params.extra_fields.join(",")
            : "";

        const financialResponses = await mapWithConcurrency(
          certFilters,
          MAX_CONCURRENCY,
          async (certFilter) =>
            queryEndpoint(
              ENDPOINTS.FINANCIALS,
              {
                filters: `(${certFilter}) AND REPDTE:${params.repdte}`,
                fields: FINANCIAL_FIELDS + extraFieldsCsv,
                limit: 10_000,
                offset: 0,
                sort_by: "CERT",
                sort_order: "ASC",
              },
              { signal: controller.signal },
            ),
        );

        const peerFinancialsByCert = new Map<
          number,
          Record<string, unknown>
        >();
        for (const response of financialResponses) {
          const records = extractRecords(response);
          const warning = buildTruncationWarning(
            `financials batch for REPDTE:${params.repdte}`,
            response.meta.total,
            records.length,
            "Narrow the peer group criteria for complete analysis.",
          );
          if (warning && !warnings.includes(warning)) warnings.push(warning);
          for (const record of records) {
            const cert = asNumber(record.CERT);
            if (cert !== null) peerFinancialsByCert.set(cert, record);
          }
        }

        // Build roster lookup
        const rosterByCert = new Map(
          rosterRecords
            .map((r) => [asNumber(r.CERT), r] as const)
            .filter(
              (e): e is [number, Record<string, unknown>] => e[0] !== null,
            ),
        );

        // Compute metrics for peers that have financials
        const peers: PeerEntry[] = [];
        for (const [cert, financials] of peerFinancialsByCert) {
          const roster = rosterByCert.get(cert);
          const metrics = deriveMetrics(financials);
          const extraFields: Record<string, unknown> = {};
          if (params.extra_fields) {
            for (const field of params.extra_fields) {
              extraFields[field] = financials[field] ?? null;
            }
          }
          peers.push({
            cert,
            name: String(roster?.NAME ?? financials.NAME ?? cert),
            city: roster?.CITY != null ? String(roster.CITY) : null,
            stalp: roster?.STALP != null ? String(roster.STALP) : null,
            bkclass: roster?.BKCLASS != null ? String(roster.BKCLASS) : null,
            metrics,
            extraFields,
          });
        }

        const peerCount = peers.length;

        // --- Phase 4: Rank and assemble ---
        await sendProgressNotification(
          server.server,
          progressToken,
          0.9,
          "Computing peer rankings",
        );

        const subjectMetrics = subjectFinancials
          ? deriveMetrics(subjectFinancials)
          : null;

        const rankings: Record<string, RankResult | null> = {};
        const medians: Record<string, number | null> = {};

        for (const key of METRIC_KEYS) {
          const peerValues = peers
            .map((p) => p.metrics[key])
            .filter((v): v is number => v !== null);

          medians[key] = computeMedian(peerValues);

          if (subjectMetrics && subjectMetrics[key] !== null) {
            rankings[key] = computeCompetitionRank(
              subjectMetrics[key]!,
              peerValues,
              METRIC_DEFINITIONS[key].higher_is_better,
            );
          } else {
            rankings[key] = null;
          }
        }

        // Sort peers by asset descending with a deterministic tie-breaker.
        peers.sort(comparePeerEntriesByAsset);
        const returnedPeers = peers.slice(0, params.limit);
        const returnedCount = returnedPeers.length;
        const hasMore = peerCount > returnedCount;

        // Build output
        const output: Record<string, unknown> = {};

        if (subjectProfile && subjectMetrics) {
          output.subject = {
            cert: params.cert,
            name: subjectProfile.NAME,
            city: subjectProfile.CITY,
            stalp: subjectProfile.STALP,
            bkclass: subjectProfile.BKCLASS,
            metrics: subjectMetrics,
            rankings,
          };
        }

        output.peer_group = {
          repdte: params.repdte,
          criteria_used: criteriaUsed,
          medians,
        };
        output.metric_definitions = METRIC_DEFINITIONS;
        output.peers = returnedPeers.map((p) => ({
          cert: p.cert,
          name: p.name,
          city: p.city,
          stalp: p.stalp,
          metrics: p.metrics,
          ...p.extraFields,
        }));
        output.peer_count = peerCount;
        output.returned_count = returnedCount;
        output.has_more = hasMore;
        output.message = null;
        output.warnings = warnings;

        const text = truncateIfNeeded(
          formatPeerGroupText(
            params.repdte,
            subjectProfile,
            subjectMetrics,
            rankings,
            medians,
            returnedPeers,
            peerCount,
            warnings,
          ),
          CHARACTER_LIMIT,
          "Reduce the number of peers, narrow the peer-group criteria, request fewer fields, or shorten the analysis scope.",
        );

        await sendProgressNotification(
          server.server,
          progressToken,
          1,
          "Analysis complete",
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: output,
        };
      } catch (err) {
        if (controller.signal.aborted) {
          return formatToolError(
            new Error(
              `Peer group analysis timed out after ${Math.floor(ANALYSIS_TIMEOUT_MS / 1000)} seconds. ` +
                `Try narrowing the peer group: add a state filter, tighten the asset_min/asset_max range, or specify charter_classes.`,
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
