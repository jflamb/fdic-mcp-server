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
import {
  FdicFinancialsSearchOutputSchema,
  FdicSummarySearchOutputSchema,
} from "../schemas/output.js";

const FinancialQuerySchema = CommonQuerySchema.extend({
  sort_order: z
    .enum(["ASC", "DESC"])
    .default("DESC")
    .describe(
      "Sort direction: DESC (descending, default for most recent first) or ASC (ascending)",
    ),
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter by FDIC Certificate Number to get financials for a specific institution",
    ),
  repdte: z
    .string()
    .optional()
    .describe(
      "Filter by Report Date (REPDTE) in YYYYMMDD format (quarter-end: 0331, 0630, 0930, 1231). If omitted, returns all available dates (sorted most recent first).",
    ),
});

const SummaryQuerySchema = CommonQuerySchema.extend({
  cert: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by FDIC Certificate Number"),
  year: z
    .number()
    .int()
    .min(1934)
    .optional()
    .describe("Filter by specific year (e.g., 2022)"),
});

export function registerFinancialTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_financials",
    {
      title: "Search Institution Financial Data",
      description:
        "Use this when the user wants quarterly Call Report data (balance sheet, income, capital, performance ratios) for FDIC-insured institutions. Filter by CERT and/or REPDTE plus optional ElasticSearch filters. See fdic://schemas/financials for the full 1,100+ field catalog.",
      inputSchema: FinancialQuerySchema,
      outputSchema: FdicFinancialsSearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, repdte, ...params }) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.FINANCIALS, {
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
          { ...pagination, financials: records },
          "financials",
        );
        const text = truncateIfNeeded(
          formatSearchResultText("financial records", records, pagination, [
            "CERT",
            "NAME",
            "REPDTE",
            "ASSET",
            "DEP",
            "NETINC",
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

  server.registerTool(
    "fdic_search_summary",
    {
      title: "Search Annual Financial Summary Data",
      description:
        "Use this when the user wants annual financial-summary snapshots (assets, deposits, ROA, ROE, offices) for FDIC-insured institutions, filtered by CERT and/or year. See fdic://schemas/summary for the full field catalog.",
      inputSchema: SummaryQuerySchema,
      outputSchema: FdicSummarySearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, year, ...params }) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.SUMMARY, {
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
          { ...pagination, summary: records },
          "summary",
        );
        const text = truncateIfNeeded(
          formatSearchResultText("annual summary records", records, pagination, [
            "CERT",
            "YEAR",
            "ASSET",
            "DEP",
            "NETINC",
            "ROA",
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
