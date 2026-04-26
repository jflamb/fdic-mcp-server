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

function buildDashboardText(
  institution: Record<string, unknown>,
  repdte: string,
  riskSignals: string[],
  warnings: string[],
): string {
  const lines = [
    `FDIC Bank Deep Dive: ${asString(institution.NAME)} (CERT ${asString(institution.CERT)})`,
    `${asString(institution.CITY)}, ${asString(institution.STALP)} | Report date: ${repdte}`,
    "This dashboard uses public FDIC BankFind data and is not an official CAMELS rating or supervisory conclusion.",
    "",
    `Assets: ${asString(institution.ASSET) || "n/a"} ($thousands)`,
    `Deposits: ${asString(institution.DEP) || "n/a"} ($thousands)`,
    `Offices: ${asString(institution.OFFICES) || "n/a"}`,
  ];

  if (riskSignals.length > 0) {
    lines.push("", "Risk signals:", ...riskSignals.map((signal) => `- ${signal}`));
  }
  if (warnings.length > 0) {
    lines.push("", "Warnings:", ...warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
}

export function registerChatGptBankDeepDiveTool(server: McpServer): void {
  server.registerTool(
    "fdic_show_bank_deep_dive",
    {
      title: "Show Bank Deep Dive Dashboard",
      description:
        "Use this when the user wants a scannable ChatGPT dashboard for one FDIC-insured institution, including identity, public financial metrics, risk signals, and source links.",
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
                buildDashboardText(institution, repdte, riskSignals, warnings),
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
