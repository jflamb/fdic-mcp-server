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
  validateQuarterEndDate,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  CREDIT_FIELDS,
  computeCreditMetrics,
  scoreCreditConcentration,
  type CreditMetrics,
  type CreditSignal,
} from "./shared/creditConcentration.js";

export interface CreditConcentrationSummary {
  institution: {
    cert: number;
    name: string;
    city: string;
    state: string;
    total_assets: number;
    report_date: string;
  };
  metrics: CreditMetrics;
  signals: CreditSignal[];
}

function fmtPct(val: number | null): string {
  return val !== null ? `${val.toFixed(1)}%` : "n/a";
}

function fmtDollarsK(val: number | null): string {
  return val !== null ? `$${Math.round(val).toLocaleString()}K` : "n/a";
}

export function formatCreditSummaryText(summary: CreditConcentrationSummary): string {
  const parts: string[] = [];
  const { institution: inst, metrics: m, signals } = summary;

  parts.push("═══════════════════════════════════════════════════");
  parts.push(`  Credit Concentration Analysis: ${inst.name}`);
  parts.push(`  ${inst.city}, ${inst.state} | CERT ${inst.cert} | Total Assets: ${fmtDollarsK(inst.total_assets)}`);
  parts.push(`  Report Date: ${inst.report_date}`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push("Loan Portfolio Composition");
  parts.push("─────────────────────────");
  parts.push(`  Total Loans:              ${fmtDollarsK(m.total_loans)}`);
  parts.push(`  Loans / Assets:           ${fmtPct(m.loans_to_assets)}`);
  parts.push("");
  parts.push(`  CRE / Total Loans:        ${fmtPct(m.cre_to_total_loans)}`);
  parts.push(`  CRE / Capital:            ${fmtPct(m.cre_to_capital)}`);
  parts.push(`  Construction / Capital:   ${fmtPct(m.construction_to_capital)}`);
  parts.push("");
  parts.push(`  C&I Share:                ${fmtPct(m.ci_share)}`);
  parts.push(`  Consumer Share:           ${fmtPct(m.consumer_share)}`);
  parts.push(`  Residential RE Share:     ${fmtPct(m.residential_re_share)}`);
  parts.push(`  Agricultural Share:       ${fmtPct(m.ag_share)}`);

  if (signals.length > 0) {
    parts.push("");
    parts.push("\u26A0 Concentration Signals");
    parts.push("───────────────────────");
    for (const signal of signals) {
      parts.push(`  \u2022 ${signal.message}`);
    }
  }

  return parts.join("\n");
}

const CreditConcentrationSchema = z.object({
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

export function registerCreditConcentrationTools(server: McpServer): void {
  server.registerTool(
    "fdic_analyze_credit_concentration",
    {
      title: "Analyze Credit Concentration",
      description: `Analyze loan portfolio composition and credit concentration risk for an FDIC-insured institution. Computes CRE concentration relative to capital (per 2006 interagency guidance), loan-type breakdown, and flags concentration risks.

Output includes:
  - Loan portfolio composition (CRE, C&I, consumer, residential, agricultural shares)
  - CRE and construction concentration relative to total capital
  - Loan-to-asset ratio
  - Concentration risk signals based on interagency guidance thresholds
  - Structured JSON for programmatic consumption

NOTE: This is an analytical tool based on public financial data.`,
      inputSchema: CreditConcentrationSchema,
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
              fields: CREDIT_FIELDS,
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

        await sendProgressNotification(server.server, progressToken, 0.5, "Computing credit metrics");

        const metrics = computeCreditMetrics(currentFinancials);
        const signals = scoreCreditConcentration(metrics);

        await sendProgressNotification(server.server, progressToken, 0.9, "Formatting results");

        const summary: CreditConcentrationSummary = {
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
          formatCreditSummaryText(summary),
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
