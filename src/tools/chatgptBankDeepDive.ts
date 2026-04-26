import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CHARACTER_LIMIT, ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  formatToolError,
  queryEndpoint,
  truncateIfNeeded,
} from "../services/fdicClient.js";
import { BANK_DEEP_DIVE_WIDGET_URI } from "../resources/chatgptAppResources.js";
import { getDefaultReportDate, validateQuarterEndDate } from "./shared/queryUtils.js";
import { getInstitutionUrl } from "./shared/chatgptUrls.js";
import { FdicBankDeepDiveOutputSchema } from "../schemas/output.js";

const BankDeepDiveInputSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .describe("FDIC Certificate Number of the institution to render."),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe(
      "Quarter-end report date in YYYYMMDD format. Defaults to the most recent likely published quarter.",
    ),
});

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function formatRatio(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : undefined;
}

function collectDashboardRiskSignals(
  financials: Record<string, unknown> | undefined,
): string[] {
  if (!financials) {
    return [];
  }

  const signals: string[] = [];
  const tier1Leverage = asNumber(financials.IDT1CER);
  const roa = asNumber(financials.ROA);
  const noncurrentLoans = asNumber(financials.NCLNLSR);
  const brokeredDeposits = asNumber(financials.BRO);

  if (tier1Leverage !== undefined && tier1Leverage < 5) {
    signals.push(
      `Tier 1 leverage ratio is ${tier1Leverage.toFixed(2)}%, below the 5% well-capitalized threshold.`,
    );
  }
  if (roa !== undefined && roa < 0) {
    signals.push(`Return on assets is negative at ${roa.toFixed(2)}%.`);
  }
  if (noncurrentLoans !== undefined && noncurrentLoans > 3) {
    signals.push(
      `Noncurrent loans ratio is elevated at ${noncurrentLoans.toFixed(2)}%.`,
    );
  }
  if (brokeredDeposits !== undefined && brokeredDeposits > 0) {
    signals.push(
      "Brokered deposit fields are present; review funding-profile analysis for reliance context.",
    );
  }

  return signals;
}

/**
 * Formats a dollar amount given in $thousands as a compact human-readable
 * string ("$108.0B", "$93.4M", "$1,234k"). Mirrors the formatting the
 * embedded widget uses so the Markdown rendering and the ChatGPT widget
 * agree on units.
 */
function formatDollarsInThousands(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString()}k`;
}

interface DashboardStructured {
  institution: {
    cert: number;
    name: string;
    city: string;
    state: string;
    active: boolean;
    asset_thousands?: number;
    deposit_thousands?: number;
    offices?: number;
    charter_class: string;
    regulator: string;
    established: string;
    report_date: string;
  };
  assessment: { proxy_band: string; caveat: string };
  metrics: Record<string, string | undefined>;
  risk_signals: string[];
  warnings: string[];
  sources: Array<{ title: string; url: string }>;
}

/**
 * Builds a Markdown rendering of the deep-dive dashboard from the same
 * structuredContent the ChatGPT widget consumes. Claude (and any other MCP
 * client without an HTML widget renderer) shows this Markdown directly;
 * ChatGPT overrides it with the `_meta.openai/outputTemplate` widget.
 */
function buildDashboardMarkdown(data: DashboardStructured): string {
  const { institution: inst, assessment, metrics } = data;
  const status = inst.active ? "Active" : "Inactive or unknown";

  const lines: string[] = [];
  lines.push(`## FDIC Bank Deep Dive: ${inst.name}`);
  lines.push("");
  lines.push(
    `**CERT** ${inst.cert} · ${inst.city}, ${inst.state} · ${status} · **Report date** ${inst.report_date}`,
  );
  lines.push("");
  lines.push(`> ${assessment.caveat}`);
  lines.push("");

  lines.push("### Headline metrics");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Assets | ${formatDollarsInThousands(inst.asset_thousands)} |`);
  lines.push(
    `| Deposits | ${formatDollarsInThousands(inst.deposit_thousands)} |`,
  );
  lines.push(`| Offices | ${inst.offices ?? "n/a"} |`);
  lines.push(`| Proxy band | ${assessment.proxy_band} |`);
  lines.push(`| ROA | ${metrics.roa ?? "n/a"} |`);
  lines.push(`| ROE | ${metrics.roe ?? "n/a"} |`);
  lines.push(`| Tier 1 leverage | ${metrics.tier1_leverage ?? "n/a"} |`);
  lines.push(`| Noncurrent loans | ${metrics.noncurrent_loans ?? "n/a"} |`);
  lines.push(`| Loan-to-deposit | ${metrics.loan_to_deposit ?? "n/a"} |`);
  lines.push(
    `| Net interest margin | ${metrics.net_interest_margin ?? "n/a"} |`,
  );
  lines.push(`| Efficiency ratio | ${metrics.efficiency_ratio ?? "n/a"} |`);
  lines.push("");

  lines.push("### Risk signals");
  lines.push("");
  if (data.risk_signals.length === 0) {
    lines.push("_No risk signals returned for this dashboard._");
  } else {
    for (const signal of data.risk_signals) {
      lines.push(`- ${signal}`);
    }
  }
  lines.push("");

  if (data.warnings.length > 0) {
    lines.push("### Warnings");
    lines.push("");
    for (const warning of data.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  lines.push("### Sources");
  lines.push("");
  for (const source of data.sources) {
    lines.push(`- [${source.title}](${source.url})`);
  }

  return lines.join("\n");
}

export function registerChatGptBankDeepDiveTool(server: McpServer): void {
  server.registerTool(
    "fdic_show_bank_deep_dive",
    {
      title: "Show Bank Deep Dive Dashboard",
      description:
        "Use this when the user wants a scannable single-institution dashboard with identity, public financial metrics, risk signals, and source links. ChatGPT renders an interactive widget; Claude and other MCP clients render the same data as a Markdown table.",
      inputSchema: BankDeepDiveInputSchema,
      outputSchema: FdicBankDeepDiveOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: BANK_DEEP_DIVE_WIDGET_URI },
        "openai/outputTemplate": BANK_DEEP_DIVE_WIDGET_URI,
        "openai/toolInvocation/invoking": "Building bank dashboard...",
        "openai/toolInvocation/invoked": "Bank dashboard ready",
      },
    },
    async (rawParams) => {
      const repdte = rawParams.repdte ?? getDefaultReportDate();
      const dateError = validateQuarterEndDate(repdte, "repdte");
      if (dateError) {
        return formatToolError(new Error(dateError));
      }

      try {
        const [institutionResponse, financialsResponse] = await Promise.all([
          queryEndpoint(ENDPOINTS.INSTITUTIONS, {
            filters: `CERT:${rawParams.cert}`,
            fields:
              "CERT,NAME,CITY,STALP,STNAME,ACTIVE,ASSET,DEP,OFFICES,BKCLASS,REGAGNT,ESTYMD",
            limit: 1,
          }),
          queryEndpoint(ENDPOINTS.FINANCIALS, {
            filters: `CERT:${rawParams.cert} AND REPDTE:${repdte}`,
            fields:
              "CERT,REPDTE,ASSET,DEP,ROA,ROE,IDT1CER,NCLNLSR,LNLSDEPR,NIMY,EEFFR",
            limit: 1,
          }),
        ]);

        const institution = extractRecords(institutionResponse)[0];
        if (!institution) {
          return formatToolError(
            new Error(`No institution found with CERT number ${rawParams.cert}.`),
          );
        }

        const financials = extractRecords(financialsResponse)[0];
        const warnings = financials
          ? []
          : [
              `No financial record found for CERT ${rawParams.cert} at ${repdte}. Try an earlier quarter-end date.`,
            ];
        const riskSignals = collectDashboardRiskSignals(financials);

        const structuredContent = {
          institution: {
            cert: rawParams.cert,
            name: asString(institution.NAME),
            city: asString(institution.CITY),
            state: asString(institution.STALP),
            active: institution.ACTIVE === 1 || institution.ACTIVE === "1",
            asset_thousands:
              asNumber(financials?.ASSET) ?? asNumber(institution.ASSET),
            deposit_thousands:
              asNumber(financials?.DEP) ?? asNumber(institution.DEP),
            offices: asNumber(institution.OFFICES),
            charter_class: asString(institution.BKCLASS),
            regulator: asString(institution.REGAGNT),
            established: asString(institution.ESTYMD),
            report_date: repdte,
          },
          assessment: {
            official_rating: false,
            proxy_band: riskSignals.length > 0 ? "review" : "no major public flags",
            caveat:
              "Public off-site analytical dashboard; not an official CAMELS rating or confidential supervisory conclusion.",
          },
          metrics: {
            roa: formatRatio(financials?.ROA),
            roe: formatRatio(financials?.ROE),
            tier1_leverage: formatRatio(financials?.IDT1CER),
            noncurrent_loans: formatRatio(financials?.NCLNLSR),
            loan_to_deposit: formatRatio(financials?.LNLSDEPR),
            net_interest_margin: formatRatio(financials?.NIMY),
            efficiency_ratio: formatRatio(financials?.EEFFR),
          },
          risk_signals: riskSignals,
          warnings,
          sources: [
            {
              title: "FDIC BankFind institution profile",
              url: getInstitutionUrl(rawParams.cert),
            },
          ],
        };

        return {
          content: [
            {
              type: "text",
              text: truncateIfNeeded(
                buildDashboardMarkdown(structuredContent),
                CHARACTER_LIMIT,
              ),
            },
          ],
          structuredContent,
          _meta: {
            widget: {
              resourceUri: BANK_DEEP_DIVE_WIDGET_URI,
            },
            raw: {
              institution,
              financials: financials ?? null,
            },
          },
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
