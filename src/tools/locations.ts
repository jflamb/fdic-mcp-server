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
  - By state: STALP:TX (two-letter state code)
  - By city: CITY:"Austin"
  - Main offices only: BRNUM:0
  - By county: COUNTY:"Travis"
  - Active branches only: ENDEFYMD:[9999-01-01 TO *]  (sentinel date 9999-12-31 means still open)
  - By metro area (CBSA): CBSA_METRO_NAME:"New York-Newark-Jersey City"

Branch service types (BRSERTYP):
  11 = Full service brick and mortar
  12 = Full service retail
  21 = Limited service administrative
  22 = Limited service military
  23 = Limited service drive-through
  24 = Limited service loan production
  25 = Limited service consumer/trust
  26 = Limited service Internet/mobile
  29 = Limited service other

Key returned fields:
  - CERT: FDIC Certificate Number
  - UNINAME: Institution name
  - NAMEFULL: Full branch name
  - ADDRESS, CITY, STALP (two-letter state code), ZIP: Branch address
  - COUNTY: County name
  - BRNUM: Branch number (0 = main office)
  - BRSERTYP: Branch service type code (see above)
  - LATITUDE, LONGITUDE: Geographic coordinates
  - ESTYMD: Branch established date (YYYY-MM-DD)
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
        const response = await queryEndpoint(ENDPOINTS.LOCATIONS, {
          ...params,
          filters: buildFilterString({
            cert,
            rawFilters: params.filters,
            rawFiltersPosition: "last",
          }),
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
