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
      description: `Search for FDIC-insured financial institutions (banks and savings institutions) using flexible filters.

Returns institution profile data including name, location, charter class, asset size, deposit totals, profitability metrics, and regulatory status.

Common filter examples:
  - By state: STNAME:"California"
  - Active banks only: ACTIVE:1
  - Large banks: ASSET:[10000000 TO *]  (assets in $thousands)
  - By bank class: BKCLASS:N (national bank), BKCLASS:SM (state member bank), BKCLASS:NM (state non-member)
  - By name: NAME:"Wells Fargo"
  - Commercial banks: CB:1
  - Savings institutions: MUTUAL:1
  - Recently established: ESTYMD:[2010-01-01 TO *]

Key returned fields:
  - CERT: FDIC Certificate Number (unique ID)
  - NAME: Institution name
  - CITY, STALP, STNAME: Location
  - ASSET: Total assets ($thousands)
  - DEP: Total deposits ($thousands)
  - BKCLASS: Charter class code
  - ACTIVE: 1 if currently active, 0 if inactive
  - ROA, ROE: Profitability ratios
  - OFFICES: Number of branch offices
  - ESTYMD: Establishment date
  - REGAGNT: Primary federal regulator

Args:
  - filters (string, optional): ElasticSearch query filter
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return, 1-10000 (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and institution records.`,
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
      description: `Retrieve detailed information for a specific FDIC-insured institution using its FDIC Certificate Number (CERT).

Use this when you know the exact CERT number for an institution. To find a CERT number, use fdic_search_institutions first.

Args:
  - cert (number): FDIC Certificate Number (e.g., 3511 for Bank of America)
  - fields (string, optional): Comma-separated list of fields to return

Returns a detailed institution profile suitable for concise summaries, with structured fields available for exact values when needed.`,
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
