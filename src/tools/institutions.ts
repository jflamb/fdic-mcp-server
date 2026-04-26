import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINTS, CHARACTER_LIMIT } from "../constants.js";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
  formatLookupResultText,
  formatSearchResultText,
  truncateIfNeeded,
  formatToolError,
} from "../services/fdicClient.js";
import { CommonQuerySchema, CertSchema } from "../schemas/common.js";

export function registerInstitutionTools(server: McpServer): void {
  server.registerTool(
    "fdic_search_institutions",
    {
      title: "Search FDIC Institutions",
      description:
        'Use this when the user needs FDIC-insured institution search results by name, state, CERT, asset size, charter class, or regulatory status. Returns institution profile rows with pagination; use fdic://schemas/institutions for the full field catalog.',
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
        const response = await queryEndpoint(ENDPOINTS.INSTITUTIONS, params);
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, institutions: records };
        const text = truncateIfNeeded(
          formatSearchResultText("institutions", records, pagination, [
            "CERT",
            "NAME",
            "CITY",
            "STALP",
            "ASSET",
            "ACTIVE",
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
    "fdic_get_institution",
    {
      title: "Get Institution by Certificate Number",
      description:
        "Use this when the user knows an exact FDIC Certificate Number and needs one institution profile. To discover a CERT first, call fdic_search_institutions or the ChatGPT-compatible search tool.",
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
        const response = await queryEndpoint(ENDPOINTS.INSTITUTIONS, {
          filters: `CERT:${cert}`,
          fields,
          limit: 1,
        });
        const records = extractRecords(response);
        if (records.length === 0) {
          const output = {
            found: false,
            cert,
            message: `No institution found with CERT number ${cert}.`,
          };
          return {
            content: [{ type: "text", text: output.message }],
            structuredContent: output,
          };
        }
        const output = records[0];
        const text = formatLookupResultText("Institution details", output, [
          "CERT",
          "NAME",
          "CITY",
          "STALP",
          "ASSET",
          "DEP",
          "ACTIVE",
          "REGAGNT",
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
