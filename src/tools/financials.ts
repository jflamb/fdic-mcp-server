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
      "Filter by report date in YYYYMMDD format (quarterly call report dates). Example: 20231231 for Q4 2023",
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
      description: `Search quarterly financial (Call Report) data for FDIC-insured institutions. Covers over 1,100 financial variables reported quarterly.

Returns balance sheet, income statement, capital, and performance ratio data from FDIC Call Reports.

Common filter examples:
  - Financials for a specific bank: CERT:3511
  - By report date: REPDTE:20231231
  - High-profit banks in Q4 2023: REPDTE:20231231 AND ROA:[1.5 TO *]
  - Large banks most recent: ASSET:[10000000 TO *]
  - Negative net income: NETINC:[* TO 0]

Key returned fields:
  - CERT: FDIC Certificate Number
  - REPDTE: Report date (YYYYMMDD)
  - ASSET: Total assets ($thousands)
  - DEP: Total deposits ($thousands)
  - DEPDOM: Domestic deposits ($thousands)
  - INTINC: Total interest income ($thousands)
  - EINTEXP: Total interest expense ($thousands)
  - NETINC: Net income ($thousands)
  - ROA: Return on assets (%)
  - ROE: Return on equity (%)
  - NETNIM: Net interest margin (%)

Args:
  - cert (number, optional): Filter by institution CERT number
  - repdte (string, optional): Report date in YYYYMMDD format
  - filters (string, optional): Additional ElasticSearch query filters
  - fields (string, optional): Comma-separated field names (the full set has 1,100+ fields)
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'DESC' recommended for most recent first)

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and quarterly financial records.`,
      inputSchema: FinancialQuerySchema,
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
        const output = { ...pagination, financials: records };
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
      description: `Search aggregate financial and structure summary data subtotaled by year for FDIC-insured institutions.

Returns annual snapshots of key financial metrics — useful for tracking an institution's growth over time.

Common filter examples:
  - Annual history for a bank: CERT:3511
  - Specific year: YEAR:2022
  - Year range: YEAR:[2010 TO 2020]
  - Large banks in 2022: YEAR:2022 AND ASSET:[10000000 TO *]
  - Profitable in 2023: YEAR:2023 AND ROE:[10 TO *]

Key returned fields:
  - CERT: FDIC Certificate Number
  - YEAR: Report year
  - ASSET: Total assets ($thousands)
  - DEP: Total deposits ($thousands)
  - NETINC: Net income ($thousands)
  - ROA: Return on assets (%)
  - ROE: Return on equity (%)
  - OFFICES: Number of branch offices
  - REPDTE: Report date

Args:
  - cert (number, optional): Filter by institution CERT number
  - year (number, optional): Filter by specific year (1934-present)
  - filters (string, optional): Additional ElasticSearch query filters
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by (e.g., YEAR, ASSET)
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and annual summary records.`,
      inputSchema: SummaryQuerySchema,
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
        const output = { ...pagination, summary: records };
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
