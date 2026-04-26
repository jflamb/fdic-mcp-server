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
import { FdicSodSearchOutputSchema } from "../schemas/output.js";

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
      description:
        "Use this when the user wants annual branch-level deposit data (SOD, as of June 30 each year) — branch deposits, MSAs, geographic distribution. Filter by CERT and/or year. See fdic://schemas/sod for the full field catalog.",
      inputSchema: SodQuerySchema,
      outputSchema: FdicSodSearchOutputSchema,
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
        const output = capStructuredContent(
          { ...pagination, deposits: records },
          "deposits",
        );
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
