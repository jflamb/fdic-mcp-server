import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINTS, CHARACTER_LIMIT } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
  capStructuredContent,
  formatSearchResultText,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { CommonQuerySchema } from "../schemas/common.js";
import { buildFilterString } from "./shared/queryUtils.js";
import { FdicLocationsSearchOutputSchema } from "../schemas/output.js";

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
      description:
        "Use this when the user wants branch/office locations for FDIC-insured institutions, filtered by CERT, state, city, county, metro area, or branch type. Returns address, coordinates, branch number, and service-type rows; see fdic://schemas/locations for the full field catalog.",
      inputSchema: LocationQuerySchema,
      outputSchema: FdicLocationsSearchOutputSchema,
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
        const output = capStructuredContent(
          { ...pagination, locations: records },
          "locations",
        );
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
