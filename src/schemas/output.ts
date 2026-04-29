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

const PeerStatsSchema = z.object({
  peer_count: z.number().int(),
  peer_median: z.number(),
  peer_mean: z.number(),
  subject_value: z.number(),
  subject_percentile: z.number(),
  robust_z_score: z.number(),
  is_outlier: z.boolean(),
  outlier_direction: z.enum(["high", "low"]).optional(),
});

const PeerHealthMetricRowSchema = z.object({
  name: z.string(),
  label: z.string(),
  subject: z.number().nullable(),
  peer_median: z.number().nullable(),
  peer_weighted_avg: z.number().nullable(),
  percentile: z.number().nullable(),
  higher_is_better: z.boolean(),
  is_outlier: z.boolean(),
  outlier_direction: z.enum(["high", "low"]).nullable(),
});

const PeerHealthInstitutionSchema = z.object({
  cert: z.number().int(),
  name: z.string(),
  name_source: z.enum(["fdic_institution_profile", "cert_fallback"]),
  city: z.string().nullable(),
  state: z.string().nullable(),
  total_assets: z.number().nullable(),
  proxy_score: z.number(),
  proxy_band: z.string(),
  composite_rating: z.number(),
  composite_label: z.string(),
  component_ratings: z.record(z.number()),
  flags: z.array(z.string()),
});

const PeerHealthProxySummarySchema = z.object({
  model: z.literal("public_camels_proxy_v1"),
  official_status: z.literal("public off-site proxy, not official CAMELS"),
  score: z.number(),
  band: z.string(),
  components: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      score: z.number(),
      legacy_rating: z.number(),
      legacy_label: z.string(),
      flags: z.array(z.string()),
    }),
  ),
  capital_classification: z.object({
    category: z.string(),
    label: z.string(),
    binding_constraint: z.string().nullable(),
    ratios_used: z.record(z.number().nullable()),
  }),
  management_overlay: z.object({
    level: z.string(),
    caps_band: z.boolean(),
    reason_codes: z.array(z.string()),
  }),
  risk_signal_count: z.number().int(),
  risk_signal_severities: z.record(z.number().int()),
  trend_count: z.number().int(),
  data_quality: z.object({
    report_date: z.string(),
    staleness: z.string(),
    gaps_count: z.number().int(),
    gaps: z.array(z.string()),
  }),
});

export const FdicPeerHealthOutputSchema = z.object({
  model: z.literal("public_camels_proxy_v1"),
  official_status: z.literal("public off-site proxy, not official CAMELS"),
  proxy: z.unknown().nullable(),
  proxy_summary: PeerHealthProxySummarySchema.nullable(),
  report_date: z.string(),
  sort_by: z.string(),
  total_institutions: z.number().int(),
  returned_count: z.number().int(),
  subject_cert: z.number().int().nullable(),
  subject_rank: z.number().int().nullable(),
  metrics: z.array(PeerHealthMetricRowSchema),
  institutions: z.array(PeerHealthInstitutionSchema),
  peer_context: z
    .object({
      peer_count: z.number().int(),
      peer_definition: z.string(),
      broadening_steps: z.array(z.string()),
      subject_rank: z.number().int().nullable(),
      subject_percentiles: z.record(PeerStatsSchema),
      weighted_peer_averages: z.record(z.number()),
    })
    .nullable(),
}).passthrough();

/**
 * Permissive output schema for tools whose structuredContent is a complex,
 * heterogeneous analytical payload. We use a passthrough ZodObject (rather
 * than `z.record`) because the MCP SDK's `normalizeObjectSchema` only
 * accepts schemas exposing a `.shape` property. Declaring even a permissive
 * schema lets clients know the tool produces structured data and unblocks
 * future tightening without another contract change.
 */
export const FdicAnalysisOutputSchema = z.object({}).passthrough();
