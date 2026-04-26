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
import {
  ANALYSIS_TIMEOUT_MS,
  getDefaultReportDate,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  FUNDING_FIELDS,
  computeFundingMetrics,
  scoreFundingRisks,
  type FundingMetrics,
  type FundingSignal,
} from "./shared/fundingProfile.js";

export interface FundingProfileSummary {
  institution: {
    cert: number;
    name: string;
    city: string;
    state: string;
    total_assets: number;
    report_date: string;
  };
  metrics: FundingMetrics;
  signals: FundingSignal[];
}

function fmtPct(val: number | null): string {
  return val !== null ? `${val.toFixed(1)}%` : "n/a";
}

function fmtDollarsK(val: number | null): string {
  return val !== null ? `$${Math.round(val).toLocaleString()}K` : "n/a";
}

export function formatFundingSummaryText(summary: FundingProfileSummary): string {
  const parts: string[] = [];
  const { institution: inst, metrics: m, signals } = summary;

  parts.push("═══════════════════════════════════════════════════");
  parts.push(`  Funding Profile Analysis: ${inst.name}`);
  parts.push(`  ${inst.city}, ${inst.state} | CERT ${inst.cert} | Total Assets: ${fmtDollarsK(inst.total_assets)}`);
  parts.push(`  Report Date: ${inst.report_date}`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push("Deposit Composition");
  parts.push("───────────────────");
  parts.push(`  Deposits / Assets:        ${fmtPct(m.deposits_to_assets)}`);
  parts.push(`  Core Deposit Ratio:       ${fmtPct(m.core_deposit_ratio)}`);
  parts.push(`  Brokered Deposit Ratio:   ${fmtPct(m.brokered_deposit_ratio)}`);
  parts.push(`  Foreign Deposit Share:    ${fmtPct(m.foreign_deposit_share)}`);
  parts.push("");
  parts.push("Wholesale Funding & Liquidity");
  parts.push("─────────────────────────────");
  parts.push(`  Wholesale Funding Ratio:  ${fmtPct(m.wholesale_funding_ratio)}`);
  parts.push(`  FHLB / Assets:            ${fmtPct(m.fhlb_to_assets)}`);
  parts.push(`  Cash Ratio:               ${fmtPct(m.cash_ratio)}`);

  if (signals.length > 0) {
    parts.push("");
    parts.push("\u26A0 Funding Risk Signals");
    parts.push("──────────────────────");
    for (const signal of signals) {
      parts.push(`  \u2022 ${signal.message}`);
    }
  }

  return parts.join("\n");
}

const FundingProfileSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .describe("FDIC Certificate Number"),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("Report date (YYYYMMDD). Defaults to most recent quarter."),
});

export function registerFundingProfileTools(server: McpServer): void {
  server.registerTool(
    "fdic_analyze_funding_profile",
    {
      title: "Analyze Funding Profile",
      description: `Analyze deposit composition, wholesale funding reliance, and funding risk for an FDIC-insured institution.

Output includes:
  - Deposit composition (core, brokered, foreign deposit shares)
  - Wholesale funding reliance and FHLB advances relative to assets
  - Cash ratio for near-term liquidity
  - Funding risk signals based on supervisory thresholds
  - Structured JSON for programmatic consumption

NOTE: This is an analytical tool based on public financial data.`,
      inputSchema: FundingProfileSchema,
      outputSchema: FdicAnalysisOutputSchema,
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
              fields: "CERT,NAME,CITY,STALP,ASSET",
              limit: 1,
            },
            { signal: controller.signal },
          ),
          queryEndpoint(
            ENDPOINTS.FINANCIALS,
            {
              filters: `CERT:${params.cert} AND REPDTE:${params.repdte}`,
              fields: FUNDING_FIELDS,
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

        await sendProgressNotification(server.server, progressToken, 0.5, "Computing funding metrics");

        const metrics = computeFundingMetrics(currentFinancials);
        const signals = scoreFundingRisks(metrics);

        await sendProgressNotification(server.server, progressToken, 0.9, "Formatting results");

        const summary: FundingProfileSummary = {
          institution: {
            cert: params.cert,
            name: String(profile.NAME ?? ""),
            city: String(profile.CITY ?? ""),
            state: String(profile.STALP ?? ""),
            total_assets: typeof currentFinancials.ASSET === "number" ? currentFinancials.ASSET : 0,
            report_date: params.repdte,
          },
          metrics,
          signals,
        };

        const text = truncateIfNeeded(
          formatFundingSummaryText(summary),
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
