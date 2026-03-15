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

const LocationQuerySchema = CommonQuerySchema.extend({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter by FDIC Certificate Number to get all branches of a specific institution",
    ),
});

export function registerLocationTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_locations",
    {
      title: "Search Institution Locations / Branches",
      description: `Search for branch locations of FDIC-insured financial institutions.

Returns branch/office data including address, city, state, coordinates, branch type, and establishment date.

Common filter examples:
  - All branches of a bank: CERT:3511
  - By state: STALP:TX
  - By city: CITY:"Austin"
  - Main offices only: BRNUM:0
  - By county: COUNTY:"Travis"
  - Active branches: ENDEFYMD:[9999-01-01 TO *]
  - By CBSA (metro area): CBSA_METRO_NAME:"New York-Newark-Jersey City"

Key returned fields:
  - CERT: FDIC Certificate Number
  - UNINAME: Institution name
  - NAMEFULL: Full branch name
  - ADDRESS, CITY, STALP, ZIP: Branch address
  - COUNTY: County name
  - BRNUM: Branch number (0 = main office)
  - BRSERTYP: Branch service type
  - LATITUDE, LONGITUDE: Geographic coordinates
  - ESTYMD: Branch established date
  - ENDEFYMD: Branch end date (9999-12-31 if still active)

Args:
  - cert (number, optional): Filter by institution CERT number
  - filters (string, optional): Additional ElasticSearch query filters
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and branch location records.`,
      inputSchema: LocationQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, ...params }) => {
      try {
        let filters = params.filters ?? "";
        if (cert !== undefined) {
          filters = filters
            ? `CERT:${cert} AND (${filters})`
            : `CERT:${cert}`;
        }
        const response = await queryEndpoint(ENDPOINTS.LOCATIONS, {
          ...params,
          filters: filters || undefined,
        });
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, locations: records };
        const text = truncateIfNeeded(
          formatSearchResultText("locations", records, pagination, [
            "CERT",
            "UNINAME",
            "NAMEFULL",
            "CITY",
            "STALP",
            "BRNUM",
          ]),
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
