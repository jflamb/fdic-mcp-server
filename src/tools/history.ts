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
import { FdicHistorySearchOutputSchema } from "../schemas/output.js";

const HistoryQuerySchema = CommonQuerySchema.extend({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter by FDIC Certificate Number to get history for a specific institution",
    ),
});

export function registerHistoryTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_history",
    {
      title: "Search Institution History / Structure Changes",
      description:
        "Use this when the user wants structural-change events (mergers, acquisitions, name changes, charter conversions, failures) for FDIC-insured institutions, filtered by CERT, type, change code, date range, or state. See fdic://schemas/history for the full field catalog.",
      inputSchema: HistoryQuerySchema,
      outputSchema: FdicHistorySearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, ...params }) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.HISTORY, {
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
          { ...pagination, events: records },
          "events",
        );
        const text = truncateIfNeeded(
          formatSearchResultText("events", records, pagination, [
            "CERT",
            "INSTNAME",
            "TYPE",
            "PROCDATE",
            "PCITY",
            "PSTALP",
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
