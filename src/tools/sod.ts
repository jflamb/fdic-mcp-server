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

const SodQuerySchema = CommonQuerySchema.extend({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by FDIC Certificate Number"),
  year: z
    .number()
    .int()
    .min(1994)
    .optional()
    .describe(
      "Filter by specific year (1994-present). SOD data is annual.",
    ),
});

export function registerSodTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_sod",
    {
      title: "Search Summary of Deposits (SOD)",
      description: `Search annual Summary of Deposits (SOD) data for individual bank branches.

The SOD report provides annual deposit data at the branch level, showing deposit balances for each office of every FDIC-insured institution as of June 30 each year.

Common filter examples:
  - All branches for a bank: CERT:3511
  - SOD for specific year: YEAR:2022
  - Branches in a state: STALPBR:CA
  - Branches in a city: CITYBR:"Austin"
  - High-deposit branches: DEPSUMBR:[1000000 TO *]
  - By metro area (MSA code): MSABR:19100

Key returned fields:
  - YEAR: Report year (as of June 30)
  - CERT: FDIC Certificate Number
  - BRNUM: Branch number (0 = main office)
  - NAMEFULL: Branch or institution name
  - ADDRESBR, CITYBR, STALPBR, ZIPBR: Branch address
  - DEPSUMBR: Total deposits at branch ($thousands)
  - MSABR: Metropolitan Statistical Area code (numeric; 0 = non-MSA)
  - LATITUDE, LONGITUDE: Coordinates

Args:
  - cert (number, optional): Filter by institution CERT number
  - year (number, optional): SOD report year (1994-present)
  - filters (string, optional): Additional ElasticSearch query filters
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by (e.g., DEPSUMBR, YEAR)
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and deposit records.`,
      inputSchema: SodQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, year, ...params }) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.SOD, {
          ...params,
          filters: buildFilterString({
            cert,
            dateField: "YEAR",
            dateValue: year,
            rawFilters: params.filters,
          }),
        });
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, deposits: records };
        const text = truncateIfNeeded(
          formatSearchResultText("deposit records", records, pagination, [
            "CERT",
            "YEAR",
            "UNINAME",
            "NAMEFULL",
            "CITYBR",
            "DEPSUMBR",
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
