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
  buildCertFilters,
  mapWithConcurrency,
  MAX_CONCURRENCY,
} from "./shared/queryUtils.js";
import { sendProgressNotification } from "./shared/progress.js";
import {
  groupByHoldingCompany,
  aggregateSubsidiaryMetrics,
  buildSubsidiaryRecord,
  type SubsidiaryRecord,
  type AggregateMetrics,
} from "./shared/holdingCompany.js";

const INSTITUTION_FIELDS =
  "CERT,NAME,STALP,CITY,ASSET,DEP,NAMEHCR,HCTMULT,ACTIVE,SPECGRP,CHRTAGNT";

const FINANCIAL_FIELDS = "CERT,ROA,EQV";

export interface HoldingCompanyProfileResult {
  holding_company: {
    name: string;
    subsidiary_count: number;
    states: string[];
  };
  aggregate: AggregateMetrics;
  subsidiaries: Array<{
    cert: number;
    name: string;
    state: string;
    total_assets: number;
    total_deposits: number;
    roa: number | null;
    equity_ratio: number | null;
    active: boolean;
  }>;
}

function fmtPct(val: number | null): string {
  return val !== null ? `${val.toFixed(2)}%` : "n/a";
}

function fmtDollarsK(val: number): string {
  return `$${Math.round(val).toLocaleString()}K`;
}

export function formatHoldingCompanyProfileText(
  result: HoldingCompanyProfileResult,
): string {
  const parts: string[] = [];
  const { holding_company: hc, aggregate: agg, subsidiaries: subs } = result;

  parts.push("═══════════════════════════════════════════════════");
  parts.push(`  Holding Company Profile: ${hc.name}`);
  parts.push(`  Subsidiaries: ${hc.subsidiary_count} | States: ${hc.states.join(", ")}`);
  parts.push("═══════════════════════════════════════════════════");
  parts.push("");
  parts.push("Consolidated Summary");
  parts.push("────────────────────");
  parts.push(`  Total Assets:            ${fmtDollarsK(agg.total_assets)}`);
  parts.push(`  Total Deposits:          ${fmtDollarsK(agg.total_deposits)}`);
  parts.push(`  Weighted ROA:            ${fmtPct(agg.weighted_roa)}`);
  parts.push(`  Weighted Equity Ratio:   ${fmtPct(agg.weighted_equity_ratio)}`);
  parts.push("");
  parts.push("Subsidiaries");
  parts.push("────────────");
  parts.push(
    "  CERT   Name                           State   Assets ($K)    ROA     Equity",
  );
  parts.push(
    "  ─────  ─────────────────────────────  ─────   ───────────   ─────   ──────",
  );

  // Sort subsidiaries by total_assets descending for display
  const sorted = [...subs].sort((a, b) => b.total_assets - a.total_assets);
  for (const sub of sorted) {
    const cert = String(sub.cert).padEnd(5);
    const name = sub.name.slice(0, 29).padEnd(29);
    const state = sub.state.padEnd(5);
    const assets = Math.round(sub.total_assets).toLocaleString().padStart(11);
    const roa = sub.roa !== null ? `${sub.roa.toFixed(2)}%`.padStart(6) : "  n/a ";
    const equity =
      sub.equity_ratio !== null ? `${sub.equity_ratio.toFixed(1)}%`.padStart(6) : "  n/a ";
    parts.push(`  ${cert}  ${name}  ${state}   ${assets}   ${roa}   ${equity}`);
  }

  return parts.join("\n");
}

const HoldingCompanyProfileSchema = z.object({
  hc_name: z
    .string()
    .optional()
    .describe(
      'Holding company name (e.g., "JPMORGAN CHASE & CO"). Uses NAMHCR field.',
    ),
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "CERT of any subsidiary — looks up its holding company, then profiles the entire HC.",
    ),
});

export function registerHoldingCompanyProfileTools(server: McpServer): void {
  server.registerTool(
    "fdic_holding_company_profile",
    {
      title: "Holding Company Profile",
      description: `Profile a bank holding company by grouping its FDIC-insured subsidiaries and aggregating financial metrics. Look up by holding company name or by any subsidiary's CERT number.

Output includes:
  - Consolidated summary with total assets, deposits, and asset-weighted ROA/equity ratio
  - List of all FDIC-insured subsidiaries with individual metrics
  - Structured JSON for programmatic consumption

NOTE: This is an analytical tool based on public financial data.`,
      inputSchema: HoldingCompanyProfileSchema,
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
        if (!rawParams.hc_name && !rawParams.cert) {
          return formatToolError(
            new Error(
              "At least one of hc_name or cert is required. Provide a holding company name or a subsidiary CERT number.",
            ),
          );
        }

        let hcName: string;

        // Step 1: Resolve holding company name
        if (rawParams.cert && !rawParams.hc_name) {
          await sendProgressNotification(
            server.server,
            progressToken,
            0.1,
            "Looking up subsidiary to find holding company",
          );

          const certResponse = await queryEndpoint(
            ENDPOINTS.INSTITUTIONS,
            {
              filters: `CERT:${rawParams.cert}`,
              fields: "CERT,NAMEHCR",
              limit: 1,
            },
            { signal: controller.signal },
          );

          const certRecords = extractRecords(certResponse);
          if (certRecords.length === 0) {
            return formatToolError(
              new Error(`No institution found with CERT number ${rawParams.cert}.`),
            );
          }

          const namhcr = certRecords[0].NAMEHCR;
          if (!namhcr || String(namhcr).trim() === "") {
            return formatToolError(
              new Error(
                `Institution with CERT ${rawParams.cert} is not part of a holding company (NAMEHCR is empty).`,
              ),
            );
          }
          hcName = String(namhcr);
        } else {
          hcName = rawParams.hc_name as string;
        }

        // Step 2: Fetch all institutions under this holding company
        await sendProgressNotification(
          server.server,
          progressToken,
          0.2,
          `Fetching subsidiaries for ${hcName}`,
        );

        const instResponse = await queryEndpoint(
          ENDPOINTS.INSTITUTIONS,
          {
            filters: `NAMEHCR:"${hcName}"`,
            fields: INSTITUTION_FIELDS,
            limit: 500,
            sort_by: "ASSET",
            sort_order: "DESC",
          },
          { signal: controller.signal },
        );

        const instRecords = extractRecords(instResponse);
        if (instRecords.length === 0) {
          return formatToolError(
            new Error(
              `No institutions found for holding company "${hcName}". Check the name spelling (use NAMEHCR value from FDIC data).`,
            ),
          );
        }

        // Step 3: Fetch financials for active subsidiaries
        await sendProgressNotification(
          server.server,
          progressToken,
          0.4,
          "Fetching financial data for subsidiaries",
        );

        const activeCerts = instRecords
          .filter((r) => r.ACTIVE === 1 || r.ACTIVE === true)
          .map((r) => r.CERT as number);

        const repdte = getDefaultReportDate();
        const financialsMap = new Map<number, Record<string, unknown>>();

        if (activeCerts.length > 0) {
          const certFilterChunks = buildCertFilters(activeCerts);

          const chunkResults = await mapWithConcurrency(
            certFilterChunks,
            MAX_CONCURRENCY,
            async (certFilter) => {
              const response = await queryEndpoint(
                ENDPOINTS.FINANCIALS,
                {
                  filters: `(${certFilter}) AND REPDTE:${repdte}`,
                  fields: FINANCIAL_FIELDS,
                  limit: activeCerts.length,
                },
                { signal: controller.signal },
              );
              return extractRecords(response);
            },
          );

          for (const records of chunkResults) {
            for (const rec of records) {
              if (typeof rec.CERT === "number") {
                financialsMap.set(rec.CERT, rec);
              }
            }
          }
        }

        // Step 4: Build subsidiary records
        await sendProgressNotification(
          server.server,
          progressToken,
          0.7,
          "Aggregating metrics",
        );

        const subsidiaries: SubsidiaryRecord[] = instRecords.map((inst) => {
          const cert = typeof inst.CERT === "number" ? inst.CERT : 0;
          return buildSubsidiaryRecord(inst, financialsMap.get(cert));
        });

        // Step 5: Aggregate
        const groups = groupByHoldingCompany(subsidiaries);
        const targetGroup = groups.find((g) => g.hc_name === hcName);
        const targetSubs = targetGroup ? targetGroup.subsidiaries : subsidiaries;
        const aggregate = aggregateSubsidiaryMetrics(targetSubs);

        await sendProgressNotification(
          server.server,
          progressToken,
          0.9,
          "Formatting results",
        );

        const profileResult: HoldingCompanyProfileResult = {
          holding_company: {
            name: hcName,
            subsidiary_count: aggregate.subsidiary_count,
            states: aggregate.states,
          },
          aggregate,
          subsidiaries: targetSubs.map((s) => ({
            cert: s.cert,
            name: s.name,
            state: s.state,
            total_assets: s.total_assets,
            total_deposits: s.total_deposits,
            roa: s.roa,
            equity_ratio: s.equity_ratio,
            active: s.active,
          })),
        };

        const text = truncateIfNeeded(
          formatHoldingCompanyProfileText(profileResult),
          CHARACTER_LIMIT,
        );

        return {
          content: [{ type: "text", text }],
          structuredContent: profileResult as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return formatToolError(err);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
