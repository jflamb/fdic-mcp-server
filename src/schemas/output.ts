import { z } from "zod";

const FdicRecord = z.record(z.unknown());

const Pagination = {
  total: z.number().int(),
  offset: z.number().int(),
  count: z.number().int(),
  has_more: z.boolean(),
  next_offset: z.number().int().optional(),
} as const;

function paginatedSearchSchema<K extends string>(recordKey: K) {
  return z.object({
    ...Pagination,
    [recordKey]: z.array(FdicRecord),
    truncated: z.boolean().optional(),
  });
}

export const FdicInstitutionsSearchOutputSchema = paginatedSearchSchema(
  "institutions",
);

export const FdicFailuresSearchOutputSchema = paginatedSearchSchema("failures");

export const FdicLocationsSearchOutputSchema = paginatedSearchSchema("locations");

export const FdicHistorySearchOutputSchema = paginatedSearchSchema("events");

export const FdicFinancialsSearchOutputSchema = paginatedSearchSchema(
  "financials",
);

export const FdicSummarySearchOutputSchema = paginatedSearchSchema("summary");

export const FdicSodSearchOutputSchema = paginatedSearchSchema("deposits");

export const FdicDemographicsSearchOutputSchema = paginatedSearchSchema(
  "demographics",
);

/**
 * Lookup tools return either an FDIC record (success) or a {found:false,
 * cert, message} payload when no record matches. The schema is a passthrough
 * ZodObject so the SDK's `normalizeObjectSchema` accepts it (it looks for
 * `.shape`); tightening would require coordinating a structuredContent
 * contract change.
 */
export const FdicInstitutionLookupOutputSchema = z.object({}).passthrough();

export const FdicFailureLookupOutputSchema = z.object({}).passthrough();

export const ChatGptSearchResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
    }),
  ),
});

export const ChatGptFetchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const Source = z.object({ title: z.string(), url: z.string() });

export const FdicBankDeepDiveOutputSchema = z.object({
  institution: z.object({
    cert: z.number().int(),
    name: z.string(),
    city: z.string(),
    state: z.string(),
    active: z.boolean(),
    asset_thousands: z.number().optional(),
    deposit_thousands: z.number().optional(),
    offices: z.number().optional(),
    charter_class: z.string(),
    regulator: z.string(),
    established: z.string(),
    report_date: z.string(),
  }),
  assessment: z.object({
    official_rating: z.boolean(),
    proxy_band: z.string(),
    caveat: z.string(),
  }),
  metrics: z.object({
    roa: z.string().optional(),
    roe: z.string().optional(),
    tier1_leverage: z.string().optional(),
    noncurrent_loans: z.string().optional(),
    loan_to_deposit: z.string().optional(),
    net_interest_margin: z.string().optional(),
    efficiency_ratio: z.string().optional(),
  }),
  risk_signals: z.array(z.string()),
  warnings: z.array(z.string()),
  sources: z.array(Source),
});

/**
 * Permissive output schema for tools whose structuredContent is a complex,
 * heterogeneous analytical payload. We use a passthrough ZodObject (rather
 * than `z.record`) because the MCP SDK's `normalizeObjectSchema` only
 * accepts schemas exposing a `.shape` property. Declaring even a permissive
 * schema lets clients know the tool produces structured data and unblocks
 * future tightening without another contract change.
 */
export const FdicAnalysisOutputSchema = z.object({}).passthrough();
