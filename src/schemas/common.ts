import { z } from "zod";

export const CommonQuerySchema = z.object({
  filters: z
    .string()
    .optional()
    .describe(
      'ElasticSearch query string filter. Examples: STNAME:"California", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:"Chase"',
    ),
  fields: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of fields to return. Leave empty to return all fields. Example: NAME,CERT,ASSET,DEP,STALP",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(20)
    .describe("Maximum number of records to return (1-10000, default: 20)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of records to skip for pagination (default: 0)"),
  sort_by: z
    .string()
    .optional()
    .describe(
      "Field name to sort results by. Example: ASSET, NAME, FAILDATE",
    ),
  sort_order: z
    .enum(["ASC", "DESC"])
    .default("ASC")
    .describe("Sort direction: ASC (ascending) or DESC (descending)"),
});

export const CertSchema = z.object({
  cert: z
    .number()
    .int()
    .positive()
    .describe(
      "FDIC Certificate Number — the unique identifier for an institution",
    ),
  fields: z
    .string()
    .optional()
    .describe("Comma-separated list of fields to return"),
});
