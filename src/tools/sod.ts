import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINTS, CHARACTER_LIMIT } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { CommonQuerySchema } from "../schemas/common.js";

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
  - By metro area: MSANAMEBR:"Dallas-Fort Worth-Arlington"

Key returned fields:
  - YEAR: Report year (as of June 30)
  - CERT: FDIC Certificate Number
  - BRNUM: Branch number (0 = main office)
  - UNINAME: Institution name
  - NAMEFULL: Full branch name
  - ADDRESBR, CITYBR, STALPBR, ZIPBR: Branch address
  - CNTYBR: County
  - DEPSUMBR: Total deposits at branch ($thousands)
  - MSABR: Metropolitan Statistical Area code
  - MSANAMEBR: MSA name
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

Returns JSON with { total, offset, count, has_more, next_offset?, deposits[] }`,
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
        const filterParts: string[] = [];
        if (params.filters) filterParts.push(`(${params.filters})`);
        if (cert !== undefined) filterParts.push(`CERT:${cert}`);
        if (year !== undefined) filterParts.push(`YEAR:${year}`);
        const response = await queryEndpoint(ENDPOINTS.SOD, {
          ...params,
          filters:
            filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
        });
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, deposits: records };
        const text = truncateIfNeeded(
          JSON.stringify(output, null, 2),
          CHARACTER_LIMIT,
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
