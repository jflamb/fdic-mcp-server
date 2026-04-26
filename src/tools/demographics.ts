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
import { FdicDemographicsSearchOutputSchema } from "../schemas/output.js";

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
      "Filter by Report Date (REPDTE) in YYYYMMDD format (quarter-end: 0331, 0630, 0930, 1231).",
    ),
});

export function registerDemographicsTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_demographics",
    {
      title: "Search Institution Demographics Data",
      description:
        "Use this when the user wants quarterly demographic and market-structure attributes (office counts, metro classification, county/territory codes, geographic reference data) for FDIC-insured institutions. Filter by CERT and/or REPDTE. See fdic://schemas/demographics for the full field catalog.",
      inputSchema: DemographicsQuerySchema,
      outputSchema: FdicDemographicsSearchOutputSchema,
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
        const output = capStructuredContent(
          { ...pagination, demographics: records },
          "demographics",
        );
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
