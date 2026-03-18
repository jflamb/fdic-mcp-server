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
  - Name changes: CHANGECODE:CO
  - By date range: PROCDATE:[2008-01-01 TO 2009-12-31]
  - By state: PSTALP:CA (two-letter state code)

Event types (TYPE):
  merger = institution was merged into another
  failure = institution failed
  assistance = received FDIC assistance transaction
  insurance = insurance-related event (new coverage, termination)

Common change codes (CHANGECODE):
  CO = name change
  CR = charter conversion
  DC = deposit assumption change
  MA = merger/acquisition (absorbed by another institution)
  NI = new institution insured
  TC = trust company conversion

Key returned fields:
  - CERT: FDIC Certificate Number
  - INSTNAME: Institution name
  - CLASS: Charter class at time of change
  - PCITY, PSTALP: Location (city, two-letter state code)
  - PROCDATE: Processing date of the change (YYYY-MM-DD)
  - EFFDATE: Effective date of the change (YYYY-MM-DD)
  - ENDEFYMD: End effective date
  - PCERT: Predecessor/successor CERT (for mergers)
  - TYPE: Type of structural change (see above)
  - CHANGECODE: Code for type of change (see above)
  - CHANGECODE_DESC: Human-readable description of the change code
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
