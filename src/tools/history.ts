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
      description: `Search for structural change events for FDIC-insured financial institutions.

Returns records on mergers, acquisitions, name changes, charter conversions, failures, and other significant structural events.

Common filter examples:
  - History for a specific bank: CERT:3511
  - Mergers: TYPE:merger
  - Failures: TYPE:failure
  - Name changes: CHANGECODE:CO (name change code)
  - By date range: PROCDATE:[2008-01-01 TO 2009-12-31]
  - By state: PSTALP:CA

Key returned fields:
  - CERT: FDIC Certificate Number
  - INSTNAME: Institution name
  - CLASS: Charter class at time of change
  - PCITY, PSTALP: Location (city, state abbreviation)
  - PROCDATE: Processing date of the change
  - EFFDATE: Effective date of the change
  - ENDEFYMD: End effective date
  - PCERT: Predecessor/successor CERT (for mergers)
  - TYPE: Type of structural change
  - CHANGECODE: Code for type of change
  - CHANGECODE_DESC: Description of change code
  - INSDATE: Insurance date

Args:
  - cert (number, optional): Filter by institution CERT number
  - filters (string, optional): ElasticSearch query filters
  - fields (string, optional): Comma-separated field names
  - limit (number): Records to return (default: 20)
  - offset (number): Pagination offset (default: 0)
  - sort_by (string, optional): Field to sort by (e.g., PROCDATE)
  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')

Prefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and event records.`,
      inputSchema: HistoryQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ cert, ...params }) => {
      try {
        let filters = params.filters ?? "";
        if (cert !== undefined) {
          filters = filters
            ? `CERT:${cert} AND (${filters})`
            : `CERT:${cert}`;
        }
        const response = await queryEndpoint(ENDPOINTS.HISTORY, {
          ...params,
          filters: filters || undefined,
        });
        const records = extractRecords(response);
        const pagination = buildPaginationInfo(
          response.meta.total,
          params.offset ?? 0,
          records.length,
        );
        const output = { ...pagination, events: records };
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
