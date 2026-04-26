import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  queryEndpoint,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { FdicAnalysisOutputSchema } from "../schemas/output.js";
import { ANALYSIS_TIMEOUT_MS } from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  computeMarketShare,
  buildMarketConcentration,
  type MarketParticipant,
  type MarketConcentration,
} from "./shared/marketShare.js";

const SOD_FIELDS =
  "CERT,NAMEFULL,DEPSUMBR,BRNUM,MSABR,STALPBR,YEAR";
const SOD_FETCH_LIMIT = 10000;

export interface MarketShareSummary {
  market: { name: string; year: number };
  concentration: MarketConcentration;
  highlighted_institution?: {
    cert: number;
    name: string;
    rank: number;
    market_share: number;
    total_deposits: number;
    branch_count: number;
  };
  participants: MarketParticipant[];
}

function fmtNum(val: number): string {
  return Math.round(val).toLocaleString("en-US");
}

export function formatMarketShareText(summary: MarketShareSummary): string {
  const parts: string[] = [];
  const { market, concentration } = summary;

  parts.push("═══════════════════════════════════════════════════");
  parts.push("  Deposit Market Share Analysis");
  parts.push(`  ${market.name} | ${market.year} SOD Data`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push("Market Overview");
  parts.push("───────────────");
  parts.push(`  Total Market Deposits:  $${fmtNum(concentration.total_deposits)}K`);
  parts.push(`  Institutions:           ${concentration.institution_count}`);
  parts.push(
    `  HHI:                    ${fmtNum(concentration.hhi)} (${concentration.classification.replace(/_/g, " ")})`,
  );

  if (summary.highlighted_institution) {
    const h = summary.highlighted_institution;
    parts.push("");
    parts.push(
      `  \u2605 ${h.name} (CERT ${h.cert}): Rank #${h.rank}, ${h.market_share.toFixed(1)}% share, $${fmtNum(h.total_deposits)}K`,
    );
  }

  parts.push("");
  parts.push("Top 20 Institutions");
  parts.push("───────────────────");
  parts.push(
    "  Rank  Institution                    Deposits ($K)    Share    Branches",
  );
  parts.push(
    "  ────  ─────────────────────────────  ─────────────   ──────   ────────",
  );

  const top = summary.participants.slice(0, 20);
  for (const p of top) {
    const rank = String(p.rank).padStart(4);
    const name = p.name.length > 29 ? p.name.slice(0, 26) + "..." : p.name;
    const deposits = fmtNum(p.total_deposits).padStart(13);
    const share = `${p.market_share.toFixed(1)}%`.padStart(6);
    const branches = String(p.branch_count).padStart(8);
    parts.push(
      `  ${rank}   ${name.padEnd(29)}  ${deposits}   ${share}   ${branches}`,
    );
  }

  return parts.join("\n");
}

function getDefaultSodYear(): number {
  return new Date().getFullYear() - 1;
}

const MarketShareInputSchema = z.object({
  msa: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "FDIC MSABR numeric code for the Metropolitan Statistical Area (e.g., 19100 for Dallas-Fort Worth-Arlington, 42660 for Seattle-Tacoma-Bellevue). Use fdic_search_sod with MSABR to look up codes.",
    ),
  city: z
    .string()
    .optional()
    .describe('City name (e.g., "Austin"). Requires state.'),
  state: z
    .string()
    .length(2)
    .optional()
    .describe(
      "Two-letter state abbreviation (e.g., TX). Required when using city filter.",
    ),
  year: z
    .number()
    .int()
    .min(1994)
    .optional()
    .describe("SOD report year (1994-present). Defaults to most recent."),
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Highlight a specific institution in the results."),
});

export function registerMarketShareAnalysisTools(server: McpServer): void {
  server.registerTool(
    "fdic_market_share_analysis",
    {
      title: "Deposit Market Share Analysis",
      description: `Analyze deposit market share and concentration for an MSA or city market using FDIC Summary of Deposits (SOD) data.

Computes market share for all institutions in a geographic market, ranks them by deposits, and calculates the Herfindahl-Hirschman Index (HHI) for market concentration analysis per DOJ/FTC merger guidelines.

Two entry modes:
  - MSA market: provide msa as the numeric MSABR code (e.g., msa: 19100 for Dallas-Fort Worth-Arlington, msa: 42660 for Seattle-Tacoma-Bellevue). Use fdic_search_sod to look up MSABR codes.
  - City market: provide city (branch city name, e.g., "Austin") and state (two-letter code, e.g., "TX").

Output includes:
  - Market overview with total deposits, institution count, and HHI classification
  - Optional highlighted institution showing rank and share (provide cert)
  - Top institutions ranked by deposit market share
  - Structured JSON for programmatic consumption

Requires at least one of: msa (numeric MSABR code), or city + state.`,
      inputSchema: MarketShareInputSchema,
      outputSchema: FdicAnalysisOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (rawParams, extra) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
      const progressToken = extra._meta?.progressToken;

      try {
        // Validate inputs
        if (!rawParams.msa && !rawParams.city) {
          return formatToolError(
            new Error(
              "At least one of 'msa' (numeric MSABR code) or 'city' (with 'state') must be provided.",
            ),
          );
        }
        if (rawParams.city && !rawParams.state) {
          return formatToolError(
            new Error(
              "'state' is required when using 'city' filter.",
            ),
          );
        }

        const year = rawParams.year ?? getDefaultSodYear();

        // Build SOD filter
        let filterStr: string;
        let marketName: string;

        if (rawParams.msa) {
          filterStr = `MSABR:${rawParams.msa} AND YEAR:${year}`;
          marketName = `MSA ${rawParams.msa}`;
        } else {
          filterStr = `CITYBR:"${rawParams.city}" AND STALPBR:${rawParams.state} AND YEAR:${year}`;
          marketName = `${rawParams.city}, ${rawParams.state}`;
        }

        await sendProgressNotification(
          server.server,
          progressToken,
          0.1,
          "Fetching SOD records for market",
        );

        // Fetch all SOD records for the market
        const response = await queryEndpoint(
          ENDPOINTS.SOD,
          {
            filters: filterStr,
            fields: SOD_FIELDS,
            limit: SOD_FETCH_LIMIT,
            sort_by: "DEPSUMBR",
            sort_order: "DESC",
          },
          { signal: controller.signal },
        );

        const records = extractRecords(response);
        if (records.length === 0) {
          return formatToolError(
            new Error(
              `No SOD records found for ${marketName} in ${year}. Verify the market name and year.`,
            ),
          );
        }

        await sendProgressNotification(
          server.server,
          progressToken,
          0.5,
          "Computing market shares",
        );

        // Convert to BranchRecord array
        const branches = records.map((r) => ({
          cert: Number(r.CERT),
          name: String(r.NAMEFULL ?? ""),
          deposits: typeof r.DEPSUMBR === "number" ? r.DEPSUMBR : 0,
        }));

        // Compute market share and concentration
        const participants = computeMarketShare(branches);
        const concentration = buildMarketConcentration(participants);

        await sendProgressNotification(
          server.server,
          progressToken,
          0.8,
          "Formatting results",
        );

        // Build highlighted institution if cert provided
        let highlighted: MarketShareSummary["highlighted_institution"];
        if (rawParams.cert) {
          const found = participants.find((p) => p.cert === rawParams.cert);
          if (found) {
            highlighted = {
              cert: found.cert,
              name: found.name,
              rank: found.rank,
              market_share: found.market_share,
              total_deposits: found.total_deposits,
              branch_count: found.branch_count,
            };
          }
        }

        const summary: MarketShareSummary = {
          market: { name: marketName, year },
          concentration,
          highlighted_institution: highlighted,
          participants: participants.slice(0, 50),
        };

        const text = truncateIfNeeded(formatMarketShareText(summary), CHARACTER_LIMIT);

        return {
          content: [{ type: "text", text }],
          structuredContent: summary as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return formatToolError(err);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
