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
  SECURITIES_FIELDS,
  computeSecuritiesMetrics,
  scoreSecuritiesRisks,
  type SecuritiesMetrics,
  type SecuritiesSignal,
} from "./shared/securitiesPortfolio.js";

export interface SecuritiesPortfolioSummary {
  institution: {
    cert: number;
    name: string;
    city: string;
    state: string;
    total_assets: number;
    report_date: string;
  };
  metrics: SecuritiesMetrics;
  signals: SecuritiesSignal[];
}

function fmtPct(val: number | null): string {
  return val !== null ? `${val.toFixed(1)}%` : "n/a";
}

function fmtDollarsK(val: number | null): string {
  return val !== null ? `$${Math.round(val).toLocaleString()}K` : "n/a";
}

export function formatSecuritiesSummaryText(summary: SecuritiesPortfolioSummary): string {
  const parts: string[] = [];
  const { institution: inst, metrics: m, signals } = summary;

  parts.push("═══════════════════════════════════════════════════");
  parts.push(`  Securities Portfolio Analysis: ${inst.name}`);
  parts.push(`  ${inst.city}, ${inst.state} | CERT ${inst.cert} | Total Assets: ${fmtDollarsK(inst.total_assets)}`);
  parts.push(`  Report Date: ${inst.report_date}`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push("Portfolio Overview");
  parts.push("──────────────────");
  parts.push(`  Securities / Assets:      ${fmtPct(m.securities_to_assets)}`);
  parts.push(`  Securities / Capital:     ${fmtPct(m.securities_to_capital)}`);
  parts.push("");
  parts.push("Composition");
  parts.push("───────────");
  parts.push(`  MBS Concentration:        ${fmtPct(m.mbs_share)}`);
  parts.push(`  AFS Share:                ${fmtPct(m.afs_share)}`);
  parts.push(`  HTM Share:                ${fmtPct(m.htm_share)}`);

  if (signals.length > 0) {
    parts.push("");
    parts.push("\u26A0 Securities Risk Signals");
    parts.push("─────────────────────────");
    for (const signal of signals) {
      parts.push(`  \u2022 ${signal.message}`);
    }
  }

  return parts.join("\n");
}

const SecuritiesPortfolioSchema = z.object({
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

export function registerSecuritiesPortfolioTools(server: McpServer): void {
  server.registerTool(
    "fdic_analyze_securities_portfolio",
    {
      title: "Analyze Securities Portfolio",
      description: `Analyze securities portfolio size, composition, and concentration risk for an FDIC-insured institution.

Output includes:
  - Securities relative to total assets and capital
  - MBS concentration within the securities portfolio
  - AFS/HTM breakdown (when available)
  - Risk signals for portfolio concentration and interest rate exposure
  - Structured JSON for programmatic consumption

NOTE: This is an analytical tool based on public financial data. AFS/HTM breakdown is not currently available from the FDIC API.`,
      inputSchema: SecuritiesPortfolioSchema,
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
              fields: SECURITIES_FIELDS,
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

        await sendProgressNotification(server.server, progressToken, 0.5, "Computing securities metrics");

        const metrics = computeSecuritiesMetrics(currentFinancials);
        const signals = scoreSecuritiesRisks(metrics);

        await sendProgressNotification(server.server, progressToken, 0.9, "Formatting results");

        const summary: SecuritiesPortfolioSummary = {
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
          formatSecuritiesSummaryText(summary),
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
