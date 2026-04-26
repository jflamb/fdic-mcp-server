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
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  fetchFredSeries,
  stateFredSeries,
  type FredObservation,
} from "../services/fredClient.js";
import {
  assessMacroContext,
  type MacroContext,
} from "./shared/regionalContext.js";

export interface RegionalContextSummary {
  state: string;
  institution?: { cert: number; name: string };
  date_range: { start: string; end: string };
  context: MacroContext;
  fred_available: boolean;
}

/**
 * Convert FDIC YYYYMMDD to FRED YYYY-MM-DD format.
 */
function fdicToFredDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * Compute a date 2 years before the given YYYYMMDD date, returned in YYYY-MM-DD.
 */
function twoYearsBefore(yyyymmdd: string): string {
  const year = Number.parseInt(yyyymmdd.slice(0, 4), 10);
  return `${year - 2}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function fmtVal(val: number | null, suffix = "%"): string {
  return val !== null ? `${val.toFixed(2)}${suffix}` : "n/a";
}

function trendLabel(trend: string): string {
  return trend === "rising" ? "rising" : trend === "falling" ? "falling" : "stable";
}

function comparisonLabel(comp: string): string {
  return comp === "above" ? "above national" : comp === "below" ? "below national" : "at parity with national";
}

function envLabel(env: string): string {
  return env;
}

export function formatRegionalContextText(summary: RegionalContextSummary): string {
  const parts: string[] = [];

  if (!summary.fred_available) {
    parts.push(`Regional Economic Context: ${summary.state}`);
    parts.push("");
    parts.push(
      "\u26A0 FRED API data unavailable. Set FRED_API_KEY environment variable",
    );
    parts.push("for reliable access to economic indicators.");
    parts.push("");
    parts.push("Without economic context, consider manually reviewing:");
    parts.push("  \u2022 State unemployment trends");
    parts.push("  \u2022 Federal funds rate environment");
    parts.push("  \u2022 Regional housing and employment conditions");
    return parts.join("\n");
  }

  const ctx = summary.context;

  parts.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  parts.push(`  Regional Economic Context: ${summary.state}`);
  if (summary.institution) {
    parts.push(`  ${summary.institution.name}`);
  }
  parts.push(`  Data Period: ${summary.date_range.start} to ${summary.date_range.end}`);
  parts.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  parts.push("");
  parts.push("Economic Indicators");
  parts.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  parts.push(`  State Unemployment:     ${fmtVal(ctx.latest_state_unemployment)} (${trendLabel(ctx.unemployment_trend)})`);
  parts.push(`  National Unemployment:  ${fmtVal(ctx.latest_national_unemployment)} (state is ${comparisonLabel(ctx.state_vs_national_unemployment)})`);
  parts.push(`  Federal Funds Rate:     ${fmtVal(ctx.latest_fed_funds)} (${envLabel(ctx.rate_environment)})`);
  parts.push("");
  parts.push("Assessment");
  parts.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  parts.push(ctx.narrative);
  parts.push("");
  parts.push("Note: Economic data from FRED (Federal Reserve Economic Data).");

  return parts.join("\n");
}

const RegionalContextSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "FDIC Certificate Number \u2014 auto-detects state from institution record.",
    ),
  state: z
    .string()
    .length(2)
    .optional()
    .describe(
      "Two-letter state abbreviation (e.g., TX). Alternative to cert-based lookup.",
    ),
  repdte: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe(
      "Reference report date (YYYYMMDD). FRED data fetched for 2 years before this date.",
    ),
});

export function registerRegionalContextTools(server: McpServer): void {
  server.registerTool(
    "fdic_regional_context",
    {
      title: "Regional Economic Context",
      description: `Overlay macro/regional economic data on a bank's geographic context. Uses FRED (Federal Reserve Economic Data) for state unemployment, national unemployment, and federal funds rate. Provides trend analysis and narrative context for bank performance assessment. Gracefully degrades if FRED API is unavailable.

Output includes:
  - State and national unemployment rates with trend analysis
  - Federal funds rate and rate environment classification
  - Narrative assessment of macro conditions for bank performance
  - Structured JSON for programmatic consumption

NOTE: Requires FRED_API_KEY environment variable for reliable data access. Degrades gracefully without it.`,
      inputSchema: RegionalContextSchema,
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
        // Validate: at least one of cert or state required
        if (!rawParams.cert && !rawParams.state) {
          return formatToolError(
            new Error(
              "At least one of 'cert' or 'state' is required. Provide a CERT number to auto-detect the state, or a two-letter state abbreviation directly.",
            ),
          );
        }

        const repdte = rawParams.repdte ?? getDefaultReportDate();

        await sendProgressNotification(
          server.server,
          progressToken,
          0.1,
          "Resolving state",
        );

        // Determine state and optional institution info
        let state: string;
        let institution: { cert: number; name: string } | undefined;

        if (rawParams.cert) {
          const profileResponse = await queryEndpoint(
            ENDPOINTS.INSTITUTIONS,
            {
              filters: `CERT:${rawParams.cert}`,
              fields: "CERT,NAME,STALP",
              limit: 1,
            },
            { signal: controller.signal },
          );
          const records = extractRecords(profileResponse);
          if (records.length === 0) {
            return formatToolError(
              new Error(
                `No institution found with CERT number ${rawParams.cert}.`,
              ),
            );
          }
          const profile = records[0];
          state = String(profile.STALP ?? "").toUpperCase();
          institution = {
            cert: rawParams.cert,
            name: String(profile.NAME ?? ""),
          };
          if (!state || state.length !== 2) {
            return formatToolError(
              new Error(
                `Could not determine state for CERT ${rawParams.cert}. Try providing the 'state' parameter directly.`,
              ),
            );
          }
        } else {
          state = rawParams.state!.toUpperCase();
        }

        // Date range: 2 years back from repdte
        const endDate = fdicToFredDate(repdte);
        const startDate = twoYearsBefore(repdte);

        await sendProgressNotification(
          server.server,
          progressToken,
          0.3,
          "Fetching FRED economic data",
        );

        // Fetch FRED series in parallel with graceful degradation
        const series = stateFredSeries(state);
        const [stateUnempResult, natUnempResult, fedFundsResult] =
          await Promise.allSettled([
            fetchFredSeries(series.unemployment, startDate, endDate),
            fetchFredSeries("UNRATE", startDate, endDate),
            fetchFredSeries("FEDFUNDS", startDate, endDate),
          ]);

        const stateUnemp: FredObservation[] =
          stateUnempResult.status === "fulfilled"
            ? stateUnempResult.value
            : [];
        const natUnemp: FredObservation[] =
          natUnempResult.status === "fulfilled" ? natUnempResult.value : [];
        const fedFunds: FredObservation[] =
          fedFundsResult.status === "fulfilled" ? fedFundsResult.value : [];

        // Check if all FRED fetches failed
        const allFailed =
          stateUnempResult.status === "rejected" &&
          natUnempResult.status === "rejected" &&
          fedFundsResult.status === "rejected";

        if (allFailed) {
          const summary: RegionalContextSummary = {
            state,
            institution,
            date_range: { start: startDate, end: endDate },
            context: {
              unemployment_trend: "stable",
              state_vs_national_unemployment: "at_parity",
              rate_environment: "moderate",
              latest_state_unemployment: null,
              latest_national_unemployment: null,
              latest_fed_funds: null,
              narrative:
                "Economic data is unavailable. Consider manually reviewing state unemployment trends, federal funds rate environment, and regional housing and employment conditions.",
            },
            fred_available: false,
          };

          const text = formatRegionalContextText(summary);
          return {
            content: [{ type: "text", text }],
            structuredContent: summary as unknown as Record<string, unknown>,
          };
        }

        await sendProgressNotification(
          server.server,
          progressToken,
          0.7,
          "Computing macro context",
        );

        const context = assessMacroContext({
          state_unemployment: stateUnemp,
          national_unemployment: natUnemp,
          fed_funds: fedFunds,
        });

        const summary: RegionalContextSummary = {
          state,
          institution,
          date_range: { start: startDate, end: endDate },
          context,
          fred_available: true,
        };

        const text = truncateIfNeeded(
          formatRegionalContextText(summary),
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
