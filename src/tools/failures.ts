import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINTS, CHARACTER_LIMIT } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
  capStructuredContent,
  formatLookupResultText,
  formatSearchResultText,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { CommonQuerySchema, CertSchema } from "../schemas/common.js";
import {
  FdicFailuresSearchOutputSchema,
  FdicFailureLookupOutputSchema,
} from "../schemas/output.js";

export function registerFailureTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_failures",
    {
      title: "Search Bank Failures",
      description:
        "Use this when the user wants details on failed FDIC-insured institutions filtered by name, state, date range, resolution type, or cost. Returns failure records with pagination; see fdic://schemas/failures for the full field catalog.",
      inputSchema: CommonQuerySchema,
      outputSchema: FdicFailuresSearchOutputSchema,
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
        const output = capStructuredContent(
          { ...pagination, failures: records },
          "failures",
        );
        const text = truncateIfNeeded(
          formatSearchResultText("failures", records, pagination, [
            "CERT",
            "NAME",
            "CITY",
            "STALP",
            "FAILDATE",
            "COST",
            "RESTYPE",
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
    "fdic_get_institution_failure",
    {
      title: "Get Failure Details by Certificate Number",
      description:
        "Use this when the user knows the CERT of a failed institution and needs its specific failure record. Returns failure details (date, resolution type, cost, acquirer); responds with `found: false` if the institution did not fail.",
      inputSchema: CertSchema,
      outputSchema: FdicFailureLookupOutputSchema,
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
            found: false as const,
            cert,
            message: `No failure record found for CERT ${cert}. The institution may not have failed, or the CERT may be incorrect.`,
          };
          return {
            content: [{ type: "text", text: output.message }],
            structuredContent: output,
          };
        }
        const output = records[0];
        const text = formatLookupResultText("Failure details", output, [
          "CERT",
          "NAME",
          "FAILDATE",
          "RESTYPE",
          "COST",
          "QBFASSET",
          "CITY",
          "STALP",
        ]);
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
