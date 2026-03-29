import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  queryEndpoint,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { ANALYSIS_TIMEOUT_MS } from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";

const SOD_BRANCH_FIELDS =
  "CERT,NAMEFULL,DEPSUMBR,BRNUM,MSABR,STALPBR,YEAR";
const SOD_FETCH_LIMIT = 10000;
const NON_MSA_LABEL = "Non-MSA / Rural";

export interface MarketBreakdown {
  market_name: string;
  branch_count: number;
  total_deposits: number;
  pct_of_total: number;
}

export interface FranchiseFootprintSummary {
  institution: { cert: number; name: string; year: number };
  summary: {
    total_branches: number;
    total_deposits: number;
    market_count: number;
  };
  markets: MarketBreakdown[];
}

function fmtNum(val: number): string {
  return Math.round(val).toLocaleString("en-US");
}

export function formatFranchiseFootprintText(
  summary: FranchiseFootprintSummary,
): string {
  const parts: string[] = [];
  const { institution: inst } = summary;

  parts.push("═══════════════════════════════════════════════════");
  parts.push(`  Franchise Footprint: ${inst.name}`);
  parts.push(`  CERT ${inst.cert} | ${inst.year} SOD Data`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push(`  Total Branches: ${summary.summary.total_branches}`);
  parts.push(`  Total Deposits: $${fmtNum(summary.summary.total_deposits)}K`);
  parts.push(`  Markets:        ${summary.summary.market_count}`);
  parts.push("");
  parts.push("Market Breakdown");
  parts.push("────────────────");
  parts.push(
    "  Market                           Branches  Deposits ($K)   % of Total",
  );
  parts.push(
    "  ───────────────────────────────  ────────  ─────────────   ──────────",
  );

  for (const m of summary.markets) {
    const name =
      m.market_name.length > 31
        ? m.market_name.slice(0, 28) + "..."
        : m.market_name;
    const branches = String(m.branch_count).padStart(8);
    const deposits = fmtNum(m.total_deposits).padStart(13);
    const pct = `${m.pct_of_total.toFixed(1)}%`.padStart(10);
    parts.push(`  ${name.padEnd(31)}  ${branches}  ${deposits}   ${pct}`);
  }

  return parts.join("\n");
}

function getDefaultSodYear(): number {
  return new Date().getFullYear() - 1;
}

const FranchiseFootprintInputSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .describe("FDIC Certificate Number"),
  year: z
    .number()
    .int()
    .min(1994)
    .optional()
    .describe("SOD report year. Defaults to most recent."),
});

export function registerFranchiseFootprintTools(server: McpServer): void {
  server.registerTool(
    "fdic_franchise_footprint",
    {
      title: "Institution Franchise Footprint",
      description: `Analyze the geographic franchise footprint of an FDIC-insured institution using Summary of Deposits (SOD) data.

Shows how an institution's branches and deposits are distributed across metropolitan statistical areas (MSAs), providing a market-by-market breakdown of branch count, deposit totals, and percentage of the institution's total deposits.

Output includes:
  - Total branch count, deposits, and market count
  - Market-by-market breakdown sorted by deposits
  - Structured JSON for programmatic consumption

Branches outside MSAs are grouped under "Non-MSA / Rural".`,
      inputSchema: FranchiseFootprintInputSchema,
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
        const year = rawParams.year ?? getDefaultSodYear();

        await sendProgressNotification(
          server.server,
          progressToken,
          0.1,
          "Fetching institution profile",
        );

        // Fetch institution name
        const [profileResponse, sodResponse] = await Promise.all([
          queryEndpoint(
            ENDPOINTS.INSTITUTIONS,
            {
              filters: `CERT:${rawParams.cert}`,
              fields: "CERT,NAME",
              limit: 1,
            },
            { signal: controller.signal },
          ),
          queryEndpoint(
            ENDPOINTS.SOD,
            {
              filters: `CERT:${rawParams.cert} AND YEAR:${year}`,
              fields: SOD_BRANCH_FIELDS,
              limit: SOD_FETCH_LIMIT,
              sort_by: "DEPSUMBR",
              sort_order: "DESC",
            },
            { signal: controller.signal },
          ),
        ]);

        const profileRecords = extractRecords(profileResponse);
        if (profileRecords.length === 0) {
          return formatToolError(
            new Error(`No institution found with CERT number ${rawParams.cert}.`),
          );
        }
        const instName = String(profileRecords[0].NAME ?? "");

        const branchRecords = extractRecords(sodResponse);
        if (branchRecords.length === 0) {
          return formatToolError(
            new Error(
              `No SOD branch records found for CERT ${rawParams.cert} in ${year}. The institution may not have reported SOD data for this year.`,
            ),
          );
        }

        await sendProgressNotification(
          server.server,
          progressToken,
          0.5,
          "Grouping branches by market",
        );

        // Group branches by MSA
        const byMarket = new Map<
          string,
          { branches: number; deposits: number }
        >();

        for (const rec of branchRecords) {
          const msaName =
            typeof rec.MSABR === "number" && rec.MSABR !== 0
              ? `MSA ${rec.MSABR}`
              : NON_MSA_LABEL;
          const deposits =
            typeof rec.DEPSUMBR === "number" ? rec.DEPSUMBR : 0;

          const existing = byMarket.get(msaName);
          if (existing) {
            existing.branches += 1;
            existing.deposits += deposits;
          } else {
            byMarket.set(msaName, { branches: 1, deposits });
          }
        }

        const totalDeposits = Array.from(byMarket.values()).reduce(
          (s, m) => s + m.deposits,
          0,
        );

        const markets: MarketBreakdown[] = Array.from(
          byMarket.entries(),
        ).map(([name, data]) => ({
          market_name: name,
          branch_count: data.branches,
          total_deposits: data.deposits,
          pct_of_total:
            totalDeposits > 0 ? (data.deposits / totalDeposits) * 100 : 0,
        }));

        // Sort by deposits descending
        markets.sort((a, b) => b.total_deposits - a.total_deposits);

        await sendProgressNotification(
          server.server,
          progressToken,
          0.8,
          "Formatting results",
        );

        const summary: FranchiseFootprintSummary = {
          institution: { cert: rawParams.cert, name: instName, year },
          summary: {
            total_branches: branchRecords.length,
            total_deposits: totalDeposits,
            market_count: byMarket.size,
          },
          markets,
        };

        const text = truncateIfNeeded(
          formatFranchiseFootprintText(summary),
          CHARACTER_LIMIT,
        );

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
