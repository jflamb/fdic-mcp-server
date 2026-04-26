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
  getReportDateOneYearPrior,
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  UBPR_FIELDS,
  computeUbprRatios,
  computeGrowthRates,
  type UbprRatioGroup,
  type UbprGrowth,
} from "./shared/ubprRatios.js";

export interface UbprAnalysisSummary {
  institution: {
    cert: number;
    name: string;
    city: string;
    state: string;
    total_assets: number;
    report_date: string;
    prior_report_date: string;
  };
  ratios: UbprRatioGroup;
  growth: UbprGrowth;
  disclaimer: string;
}

function fmtPct(val: number | null): string {
  return val !== null ? `${val.toFixed(2)}%` : "n/a";
}

function fmtDollarsK(val: number | null): string {
  return val !== null ? `$${Math.round(val).toLocaleString()}K` : "n/a";
}

export function formatUbprSummaryText(summary: UbprAnalysisSummary): string {
  const parts: string[] = [];
  const { institution: inst, ratios, growth } = summary;

  parts.push("═══════════════════════════════════════════════════");
  parts.push(`  UBPR-Equivalent Ratio Analysis: ${inst.name}`);
  parts.push(`  ${inst.city}, ${inst.state} | CERT ${inst.cert} | Total Assets: ${fmtDollarsK(inst.total_assets)}`);
  parts.push(`  Report Date: ${inst.report_date} (vs. year-ago: ${inst.prior_report_date})`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push("Summary Ratios");
  parts.push("──────────────");
  parts.push(`  Return on Assets (ROA):     ${fmtPct(ratios.summary.roa)}`);
  parts.push(`  Return on Equity (ROE):     ${fmtPct(ratios.summary.roe)}`);
  parts.push(`  Net Interest Margin:        ${fmtPct(ratios.summary.nim)}`);
  parts.push(`  Efficiency Ratio:           ${fmtPct(ratios.summary.efficiency_ratio)}`);
  parts.push(`  Pretax ROA:                 ${fmtPct(ratios.summary.pretax_roa)}`);
  parts.push("");
  parts.push("Loan Mix");
  parts.push("────────");
  parts.push(`  Real Estate:   ${fmtPct(ratios.loan_mix.re_share)}`);
  parts.push(`  Commercial:    ${fmtPct(ratios.loan_mix.ci_share)}`);
  parts.push(`  Consumer:      ${fmtPct(ratios.loan_mix.consumer_share)}`);
  parts.push(`  Agricultural:  ${fmtPct(ratios.loan_mix.ag_share)}`);
  parts.push("");
  parts.push("Capital Adequacy");
  parts.push("────────────────");
  parts.push(`  Tier 1 Leverage:      ${fmtPct(ratios.capital.tier1_leverage)}`);
  parts.push(`  Tier 1 Risk-Based:    ${fmtPct(ratios.capital.tier1_rbc)}`);
  parts.push(`  Equity / Assets:      ${fmtPct(ratios.capital.equity_ratio)}`);
  parts.push("");
  parts.push("Liquidity");
  parts.push("─────────");
  parts.push(`  Loans / Deposits:     ${fmtPct(ratios.liquidity.loan_to_deposit)}`);
  parts.push(`  Core Deposits / Deposits: ${fmtPct(ratios.liquidity.core_deposit_ratio)}`);
  parts.push(`  Brokered Deposits:    ${fmtPct(ratios.liquidity.brokered_ratio)}`);
  parts.push(`  Cash / Assets:        ${fmtPct(ratios.liquidity.cash_ratio)}`);
  parts.push("");
  parts.push("Year-over-Year Growth");
  parts.push("─────────────────────");
  parts.push(`  Asset Growth:         ${fmtPct(growth.asset_growth)}`);
  parts.push(`  Loan Growth:          ${fmtPct(growth.loan_growth)}`);
  parts.push(`  Deposit Growth:       ${fmtPct(growth.deposit_growth)}`);
  parts.push("");
  parts.push("Note: Ratios computed from FDIC Call Report data. These are");
  parts.push("UBPR-equivalent calculations, not official FFIEC UBPR output.");

  return parts.join("\n");
}

const UbprAnalysisSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .describe("FDIC Certificate Number"),
  repdte: z
    .string()
    .length(8)
    .optional()
    .describe("Report date (YYYYMMDD). Defaults to most recent quarter."),
});

export function registerUbprAnalysisTools(server: McpServer): void {
  server.registerTool(
    "fdic_ubpr_analysis",
    {
      title: "UBPR-Equivalent Ratio Analysis",
      description: `Compute UBPR-equivalent ratio analysis for an FDIC-insured institution. Includes summary ratios (ROA, ROE, NIM, efficiency), loan mix, capital adequacy, liquidity metrics, and year-over-year growth rates. Ratios are computed from Call Report data and are UBPR-equivalent, not official FFIEC UBPR output.

Output includes:
  - Summary ratios: ROA, ROE, NIM, efficiency ratio, pretax ROA
  - Loan mix: real estate, commercial, consumer, agricultural shares
  - Capital adequacy: Tier 1 leverage, Tier 1 risk-based, equity ratio
  - Liquidity: loan-to-deposit, core deposit ratio, brokered deposits, cash ratio
  - Year-over-year growth: assets, loans, deposits
  - Structured JSON for programmatic consumption

NOTE: This is an analytical tool based on public financial data.`,
      inputSchema: UbprAnalysisSchema,
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

        const priorRepdte = getReportDateOneYearPrior(params.repdte);

        await sendProgressNotification(server.server, progressToken, 0.1, "Fetching institution profile");

        const [profileResponse, currentResponse, priorResponse] = await Promise.all([
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
              fields: UBPR_FIELDS,
              limit: 1,
            },
            { signal: controller.signal },
          ),
          queryEndpoint(
            ENDPOINTS.FINANCIALS,
            {
              filters: `CERT:${params.cert} AND REPDTE:${priorRepdte}`,
              fields: UBPR_FIELDS,
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

        const currentRecords = extractRecords(currentResponse);
        if (currentRecords.length === 0) {
          return formatToolError(
            new Error(
              `No financial data for CERT ${params.cert} at report date ${params.repdte}. ` +
              `Try an earlier quarter-end date (0331, 0630, 0930, 1231).`,
            ),
          );
        }
        const currentFinancials = currentRecords[0];

        await sendProgressNotification(server.server, progressToken, 0.5, "Computing UBPR-equivalent ratios");

        const ratios = computeUbprRatios(currentFinancials);

        const priorRecords = extractRecords(priorResponse);
        const priorFinancials = priorRecords.length > 0 ? priorRecords[0] : {};
        const growth = computeGrowthRates(currentFinancials, priorFinancials);

        await sendProgressNotification(server.server, progressToken, 0.9, "Formatting results");

        const summary: UbprAnalysisSummary = {
          institution: {
            cert: params.cert,
            name: String(profile.NAME ?? ""),
            city: String(profile.CITY ?? ""),
            state: String(profile.STALP ?? ""),
            total_assets: typeof currentFinancials.ASSET === "number" ? currentFinancials.ASSET : 0,
            report_date: params.repdte,
            prior_report_date: priorRepdte,
          },
          ratios,
          growth,
          disclaimer: "Ratios computed from FDIC Call Report data. UBPR-equivalent, not official FFIEC output.",
        };

        const text = truncateIfNeeded(
          formatUbprSummaryText(summary),
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
