import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINTS, CHARACTER_LIMIT } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { CommonQuerySchema, CertSchema } from "../schemas/common.js";

export function registerFailureTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_failures",
    {
      title: "Search Bank Failures",
      description: `Search for details on failed FDIC-insured financial institutions.

Returns data on bank failures including failure date, resolution type, estimated cost to the FDIC Deposit Insurance Fund, and acquiring institution info.

Common filter examples:
  - By state: STALP:CA
  - By year range: FAILDATE:[2008-01-01 TO 2010-12-31]
  - Recent failures: FAILDATE:[2020-01-01 TO *]
  - By resolution type: RESTYPE:PAYOFF or RESTYPE:MERGER
  - Large failures by cost: COST:[100000 TO *]  (cost in $thousands)
  - By name: NAME:"Washington Mutual"

Key returned fields:
  - CERT: FDIC Certificate Number
  - NAME: Institution name
  - CITY, STALP, STNAME: Location
  - FAILDATE: Date of failure (YYYY-MM-DD)
  - SAVR: Savings rate at failure
  - RESTYPE: Resolution type (PAYOFF, MERGER, PURCHASE & ASSUMPTION, etc.)
  - QBFASSET: Total assets at failure ($thousands)
  - COST: Estimated cost to FDIC DIF ($thousands)

Args:
  - filters (string, optional): ElasticSearch query filter
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by (e.g., FAILDATE, COST)
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Returns JSON with { total, offset, count, has_more, next_offset?, failures[] }`,
      inputSchema: CommonQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.FAILURES, params);
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, failures: records };
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

  server.registerTool(
    "fdic_get_institution_failure",
    {
      title: "Get Failure Details by Certificate Number",
      description: `Retrieve failure details for a specific institution by FDIC Certificate Number.

Use this when you know the CERT of a failed institution to get its specific failure record.

Args:
  - cert (number): FDIC Certificate Number of the failed institution
  - fields (string, optional): Comma-separated list of fields to return

Returns failure details including failure date, resolution method, and cost to FDIC.`,
      inputSchema: CertSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ cert, fields }) => {
      try {
        const response = await queryEndpoint(ENDPOINTS.FAILURES, {
          filters: `CERT:${cert}`,
          fields,
          limit: 1,
        });
        const records = extractRecords(response);
        if (records.length === 0) {
          const output = {
            found: false,
            cert,
            message: `No failure record found for CERT ${cert}. The institution may not have failed, or the CERT may be incorrect.`,
          };
          return {
            content: [{ type: "text", text: output.message }],
            structuredContent: output,
          };
        }
        const output = records[0];
        const text = JSON.stringify(output, null, 2);
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
