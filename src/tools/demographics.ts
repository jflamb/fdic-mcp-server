import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINTS, CHARACTER_LIMIT } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
  formatSearchResultText,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { CommonQuerySchema } from "../schemas/common.js";
import { buildFilterString } from "./shared/queryUtils.js";

const DemographicsQuerySchema = CommonQuerySchema.extend({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by FDIC Certificate Number"),
  repdte: z
    .string()
    .optional()
    .describe(
      "Filter by Report Date (REPDTE) in YYYYMMDD format. FDIC data is published quarterly on: March 31, June 30, September 30, and December 31. Example: 20251231 for Q4 2025. If omitted, returns all available dates.",
    ),
});

export function registerDemographicsTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_demographics",
    {
      title: "Search Institution Demographics Data",
      description: `Search BankFind demographics data for FDIC-insured institutions.

Returns quarterly demographic and market-structure attributes such as office counts, territory assignments, metro classification, county/country codes, and selected geographic reference data.

Common filter examples:
  - Demographics for a specific bank: CERT:3511
  - By report date: REPDTE:20251231
  - Institutions in metro areas: METRO:1
  - Institutions with out-of-state offices: OFFSTATE:[1 TO *]
  - Minority status date present: MNRTYDTE:[19000101 TO 99991231]

Key returned fields:
  - CERT: FDIC Certificate Number
  - REPDTE: Report Date — the last day of the quarterly reporting period (YYYYMMDD)
  - QTRNO: Quarter number
  - OFFTOT: Total offices
  - OFFSTATE: Offices in other states
  - OFFNDOM: Offices in non-domestic territories
  - OFFOTH: Other offices
  - OFFSOD: Offices included in Summary of Deposits
  - METRO, MICRO: Metro/micro area flags
  - CBSANAME, CSA: Core-based statistical area data
  - FDICTERR, RISKTERR: FDIC and risk territory assignments
  - SIMS_LAT, SIMS_LONG: Geographic coordinates

Args:
  - cert (number, optional): Filter by institution CERT number
  - repdte (string, optional): Report Date in YYYYMMDD format (quarter-end dates: 0331, 0630, 0930, 1231)
  - filters (string, optional): Additional ElasticSearch query filters
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and demographic records.`,
      inputSchema: DemographicsQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, repdte, ...params }) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.DEMOGRAPHICS, {
          ...params,
          filters: buildFilterString({
            cert,
            dateField: "REPDTE",
            dateValue: repdte,
            rawFilters: params.filters,
          }),
        });
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, demographics: records };
        const text = truncateIfNeeded(
          formatSearchResultText("demographic records", records, pagination, [
            "CERT",
            "REPDTE",
            "OFFTOT",
            "OFFSTATE",
            "METRO",
            "CBSANAME",
          ]),
          CHARACTER_LIMIT,
          "Request fewer fields, narrow your filters, or paginate with limit/offset.",
        );
        return {
          content: [{ type: "text", text }],
          structuredContent: output,
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
