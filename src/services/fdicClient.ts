import axios, { AxiosError } from "axios";
import {
  DEFAULT_FDIC_MAX_RESPONSE_BYTES,
  FDIC_API_BASE_URL,
  VERSION,
} from "../constants.js";
import { validateEndpointQueryParams } from "./fdicSchema.js";

const apiClient = axios.create({
  baseURL: FDIC_API_BASE_URL,
  timeout: 30_000,
  headers: {
    Accept: "application/json",
    "User-Agent": `fdic-mcp-server/${VERSION}`,
  },
});

interface QueryParams {
  filters?: string;
  fields?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: string;
}

interface QueryOptions {
  signal?: AbortSignal;
}

interface FdicResponse {
  data: Array<{ data: Record<string, unknown> }>;
  meta: { total: number };
}

interface CacheEntry {
  expiresAt: number;
  value: Promise<FdicResponse>;
}

const QUERY_CACHE_TTL_MS = 60_000;
const QUERY_CACHE_MAX_ENTRIES = 500;
const queryCache = new Map<string, CacheEntry>();

function pruneExpiredQueryCache(now: number): void {
  for (const [key, entry] of queryCache.entries()) {
    if (entry.expiresAt <= now) {
      queryCache.delete(key);
    }
  }
}

function evictOverflowQueryCache(): void {
  while (queryCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    queryCache.delete(oldestKey);
  }
}

function getCacheKey(endpoint: string, params: QueryParams): string {
  return JSON.stringify([
    endpoint,
    params.filters ?? null,
    params.fields ?? null,
    params.limit ?? null,
    params.offset ?? null,
    params.sort_by ?? null,
    params.sort_order ?? null,
  ]);
}

export function clearQueryCache(): void {
  queryCache.clear();
}

export function getQueryCacheSize(): number {
  return queryCache.size;
}

export function resolveFdicMaxResponseBytes(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_FDIC_MAX_RESPONSE_BYTES;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid FDIC_MAX_RESPONSE_BYTES value: ${rawValue}. Expected a positive integer.`,
    );
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateFdicResponseShape(
  endpoint: string,
  payload: unknown,
): FdicResponse {
  if (!isRecord(payload)) {
    throw new Error(
      `Unexpected FDIC API response shape for endpoint ${endpoint}: expected an object payload.`,
    );
  }

  const { data, meta } = payload;

  if (!Array.isArray(data)) {
    throw new Error(
      `Unexpected FDIC API response shape for endpoint ${endpoint}: expected 'data' to be an array.`,
    );
  }

  if (!isRecord(meta) || typeof meta.total !== "number") {
    throw new Error(
      `Unexpected FDIC API response shape for endpoint ${endpoint}: expected 'meta.total' to be a number.`,
    );
  }

  return {
    data: data.map((item, index) => {
      if (!isRecord(item) || !isRecord(item.data)) {
        throw new Error(
          `Unexpected FDIC API response shape for endpoint ${endpoint}: expected data[${index}] to contain an object 'data' property.`,
        );
      }

      return { data: item.data };
    }),
    meta: { total: meta.total },
  };
}

export async function queryEndpoint(
  endpoint: string,
  params: QueryParams,
  options: QueryOptions = {},
): Promise<FdicResponse> {
  validateEndpointQueryParams(endpoint, params);

  if (options.signal?.aborted) {
    throw new Error("FDIC API request was canceled before it started.");
  }

  const shouldUseCache = !options.signal;
  const now = Date.now();
  pruneExpiredQueryCache(now);

  const cacheKey = getCacheKey(endpoint, params);
  const cached = shouldUseCache ? queryCache.get(cacheKey) : undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const requestPromise = (async () => {
    try {
      const queryParams: Record<string, unknown> = {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        output: "json",
      };
      if (params.filters) queryParams.filters = params.filters;
      if (params.fields) queryParams.fields = params.fields;
      if (params.sort_by) queryParams.sort_by = params.sort_by;
      if (params.sort_order) queryParams.sort_order = params.sort_order;

      const response = await apiClient.get(`/${endpoint}`, {
        params: queryParams,
        signal: options.signal,
        maxContentLength: resolveFdicMaxResponseBytes(
          process.env.FDIC_MAX_RESPONSE_BYTES,
        ),
      });
      return validateFdicResponseShape(endpoint, response.data);
    } catch (err) {
      if (
        options.signal?.aborted ||
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "ERR_CANCELED") ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        throw new Error("FDIC API request was canceled.");
      }

      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const detail =
          (err.response?.data as { message?: string })?.message ?? err.message;
        if (err.message.includes("maxContentLength size of")) {
          throw new Error(
            "FDIC API response exceeded the configured response-size limit before parsing. Narrow your filters, request fewer fields, or lower the result size and try again.",
          );
        }
        if (status === 400) {
          throw new Error(
            `Bad request to FDIC API: ${detail}. Check your filter syntax (use ElasticSearch query string syntax, e.g. STNAME:"California" AND ACTIVE:1).`,
          );
        } else if (status === 429) {
          throw new Error(
            "FDIC API rate limit exceeded. Please wait a moment and try again.",
          );
        } else if (status === 500) {
          throw new Error(
            "FDIC API server error. The service may be temporarily unavailable. Try again later.",
          );
        } else {
          throw new Error(`FDIC API error (HTTP ${status}): ${detail}`);
        }
      }
      throw new Error(`Unexpected error calling FDIC API: ${String(err)}`);
    }
  })();

  if (shouldUseCache) {
    queryCache.set(cacheKey, {
      expiresAt: now + QUERY_CACHE_TTL_MS,
      value: requestPromise,
    });
    evictOverflowQueryCache();
  }

  try {
    return await requestPromise;
  } catch (error) {
    if (shouldUseCache) {
      queryCache.delete(cacheKey);
    }
    throw error;
  }
}

export function extractRecords(
  response: FdicResponse,
): Array<Record<string, unknown>> {
  return response.data.map((item) => item.data);
}

export function buildPaginationInfo(
  total: number,
  offset: number,
  count: number,
) {
  const has_more = total > offset + count;
  return {
    total,
    offset,
    count,
    has_more,
    ...(has_more ? { next_offset: offset + count } : {}),
  };
}

export function buildTruncationWarning(
  label: string,
  total: number,
  count: number,
  guidance: string,
): string | undefined {
  if (total <= count) return undefined;
  return (
    `${label} truncated to ${count.toLocaleString()} records out of ` +
    `${total.toLocaleString()} matched rows. ${guidance}`
  );
}

export function truncateIfNeeded(
  text: string,
  charLimit: number,
  guidance = "Request fewer fields, narrow your filters, or paginate with limit/offset.",
): string {
  if (text.length <= charLimit) return text;
  return (
    text.slice(0, charLimit) +
    `\n\n[Response truncated at ${charLimit} characters. ${guidance}]`
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(4);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

function summarizeRecord(
  record: Record<string, unknown>,
  preferredKeys: string[],
  maxFields = 4,
): string {
  const orderedKeys = [
    ...preferredKeys.filter((key) => key in record),
    ...Object.keys(record).filter(
      (key) => key !== "ID" && !preferredKeys.includes(key),
    ),
  ];

  return orderedKeys
    .slice(0, maxFields)
    .map((key) => `${key}: ${formatValue(record[key])}`)
    .join(" | ");
}

export function formatSearchResultText(
  label: string,
  records: Array<Record<string, unknown>>,
  pagination: {
    total: number;
    offset: number;
    count: number;
    has_more: boolean;
    next_offset?: number;
  },
  preferredKeys: string[],
): string {
  const header = `Found ${pagination.total} ${label} (showing ${pagination.count}, offset ${pagination.offset}).`;

  if (records.length === 0) {
    return header;
  }

  const rows = records
    .map((record, index) => `${index + 1}. ${summarizeRecord(record, preferredKeys)}`)
    .join("\n");

  const footer = pagination.has_more
    ? `\nMore results available. Use offset ${pagination.next_offset} to continue.`
    : "";

  return `${header}\n${rows}${footer}`;
}

export function formatLookupResultText(
  label: string,
  record: Record<string, unknown>,
  preferredKeys: string[],
): string {
  return `${label}\n${summarizeRecord(record, preferredKeys, 8)}`;
}

export type FdicErrorCode =
  | "FDIC_BAD_FILTER"
  | "FDIC_RATE_LIMIT"
  | "FDIC_UPSTREAM_ERROR"
  | "FDIC_RESPONSE_TOO_LARGE"
  | "FDIC_CANCELED"
  | "FDIC_NOT_FOUND"
  | "FDIC_BAD_DATE"
  | "FDIC_INVALID_INPUT"
  | "FDIC_UNKNOWN";

interface ToolErrorPayload extends Record<string, unknown> {
  code: FdicErrorCode;
  message: string;
  retryable: boolean;
  hint?: string;
}

const ERROR_CODE_FROM_MESSAGE: Array<{
  pattern: RegExp;
  code: FdicErrorCode;
  retryable: boolean;
}> = [
  { pattern: /Bad request to FDIC API/, code: "FDIC_BAD_FILTER", retryable: false },
  { pattern: /rate limit/i, code: "FDIC_RATE_LIMIT", retryable: true },
  { pattern: /server error/i, code: "FDIC_UPSTREAM_ERROR", retryable: true },
  {
    pattern: /response-size limit|maxContentLength/,
    code: "FDIC_RESPONSE_TOO_LARGE",
    retryable: false,
  },
  { pattern: /canceled/i, code: "FDIC_CANCELED", retryable: true },
  { pattern: /No (institution|failure|financial)/i, code: "FDIC_NOT_FOUND", retryable: false },
  { pattern: /quarter-end date/i, code: "FDIC_BAD_DATE", retryable: false },
];

function inferErrorCode(message: string): { code: FdicErrorCode; retryable: boolean } {
  for (const entry of ERROR_CODE_FROM_MESSAGE) {
    if (entry.pattern.test(message)) {
      return { code: entry.code, retryable: entry.retryable };
    }
  }
  return { code: "FDIC_UNKNOWN", retryable: false };
}

export function formatToolError(
  err: unknown,
  override?: {
    code?: FdicErrorCode;
    message?: string;
    retryable?: boolean;
    hint?: string;
  },
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError: true;
} {
  const message = err instanceof Error ? err.message : String(err);
  const inferred = inferErrorCode(message);
  const payload: ToolErrorPayload = {
    code: override?.code ?? inferred.code,
    message: override?.message ?? message,
    retryable: override?.retryable ?? inferred.retryable,
    hint: override?.hint,
  };
  return {
    content: [{ type: "text", text: `Error: ${payload.message}` }],
    structuredContent: payload,
    isError: true,
  };
}

export const DEFAULT_STRUCTURED_BYTE_LIMIT = 200_000;

/**
 * Caps the size of an array of records inside a structured-content payload.
 * Returns the original output if it is already under the byte limit, otherwise
 * a copy with the records array truncated, the pagination metadata
 * re-derived from the sliced count (so callers following `next_offset` cannot
 * skip records the byte cap dropped), and a `truncated: true` flag set. The
 * original upstream pagination is preserved under `upstream` for clients that
 * need to reason about FDIC's own page boundary.
 */
export function capStructuredContent<T extends Record<string, unknown>>(
  output: T,
  recordKey: keyof T & string,
  byteLimit = DEFAULT_STRUCTURED_BYTE_LIMIT,
): T {
  const records = output[recordKey];
  if (!Array.isArray(records)) {
    return output;
  }
  const initialBytes = Buffer.byteLength(JSON.stringify(output), "utf8");
  if (initialBytes <= byteLimit) {
    return output;
  }

  let lo = 0;
  let hi = records.length;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = buildTruncatedPayload(output, recordKey, records, mid);
    const bytes = Buffer.byteLength(JSON.stringify(candidate), "utf8");
    if (bytes <= byteLimit) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return buildTruncatedPayload(output, recordKey, records, best) as T;
}

function buildTruncatedPayload(
  output: Record<string, unknown>,
  recordKey: string,
  records: unknown[],
  slicedLength: number,
): Record<string, unknown> {
  const sliced = records.slice(0, slicedLength);
  const result: Record<string, unknown> = {
    ...output,
    [recordKey]: sliced,
    truncated: true,
  };

  const offset = typeof output.offset === "number" ? output.offset : undefined;
  const upstreamCount =
    typeof output.count === "number" ? output.count : undefined;
  const upstreamNextOffset =
    typeof output.next_offset === "number" ? output.next_offset : undefined;

  if (offset !== undefined) {
    result.count = slicedLength;
    result.next_offset = offset + slicedLength;
    result.has_more = true;
  }

  if (upstreamCount !== undefined || upstreamNextOffset !== undefined) {
    result.upstream = {
      ...(upstreamCount !== undefined ? { count: upstreamCount } : {}),
      ...(upstreamNextOffset !== undefined
        ? { next_offset: upstreamNextOffset }
        : {}),
    };
  }

  return result;
}
