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
    if (entry.expiresAt > now) {
      break;
    }
    queryCache.delete(key);
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
  return response.data.map((item, index) => {
    if (!isRecord(item) || !isRecord(item.data)) {
      throw new Error(
        `Unexpected FDIC API response shape: expected data[${index}] to contain an object 'data' property.`,
      );
    }
    return item.data;
  });
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

export function formatToolError(err: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}
