import axios, { AxiosError } from "axios";
import { FDIC_API_BASE_URL, VERSION } from "../constants.js";

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

interface FdicResponse {
  data: Array<{ data: Record<string, unknown> }>;
  meta: { total: number };
}

export async function queryEndpoint(
  endpoint: string,
  params: QueryParams,
): Promise<FdicResponse> {
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
    });
    return response.data;
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const detail =
        (err.response?.data as { message?: string })?.message ?? err.message;
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

export function truncateIfNeeded(text: string, charLimit: number): string {
  if (text.length <= charLimit) return text;
  return (
    text.slice(0, charLimit) +
    `\n\n[Response truncated at ${charLimit} characters. Use limit/offset parameters to paginate or narrow your query with filters.]`
  );
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
