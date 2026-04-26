import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ENDPOINTS } from "../constants.js";
import {
  extractRecords,
  formatToolError,
  queryEndpoint,
} from "../services/fdicClient.js";
import {
  getEndpointMetadata,
  listEndpointMetadata,
} from "../services/fdicSchema.js";
import {
  getBranchCitationUrl,
  getFailedBankListUrl,
  getInstitutionUrl,
  getSchemaDocsUrl,
} from "./shared/chatgptUrls.js";
import {
  ChatGptSearchResultSchema,
  ChatGptFetchResultSchema,
} from "../schemas/output.js";

const SearchInputSchema = z.object({
  query: z.string().min(1).describe("Natural-language search query."),
});

const FetchInputSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      "Retrieval item id, such as institution:<CERT>, failure:<CERT>, branch:<UNINUM>, or schema:<endpoint>.",
    ),
});

interface SearchResult {
  id: string;
  title: string;
  url: string;
}

interface FetchResult {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, unknown>;
}

const MAX_SEARCH_RESULTS = 8;

function asString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function jsonText(payload: unknown): string {
  return JSON.stringify(payload);
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function extractCertLikeNumber(query: string): number | undefined {
  const match = query.match(/\b(?:cert(?:ificate)?\s*#?\s*)?(\d{1,7})\b/i);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1], 10);
}

function shouldSearchFailures(query: string): boolean {
  return /\b(fail|failed|failure|closed|resolution|receivership)\b/i.test(
    query,
  );
}

function shouldSearchBranches(query: string): boolean {
  return /\b(branch|branches|office|offices|location|locations|address|city|county|zip|market|msa)\b/i.test(
    query,
  );
}

function shouldSearchSchemas(query: string): boolean {
  return /\b(schema|field|fields|column|columns|endpoint|call report|financials?|sod|summary of deposits|demographics|metadata)\b/i.test(
    query,
  );
}

function getRecordTitle(record: Record<string, unknown>, fallback: string): string {
  return (
    asString(record.NAME) ||
    asString(record.UNINAME) ||
    asString(record.NAMEFULL) ||
    asString(record.OFFNAME) ||
    fallback
  );
}

function formatLocation(record: Record<string, unknown>): string {
  return [record.CITY, record.STALP].map(asString).filter(Boolean).join(", ");
}

function buildBranchId(record: Record<string, unknown>): string | undefined {
  const uninum = asString(record.UNINUM);
  if (uninum) {
    return `branch:${encodeURIComponent(uninum)}`;
  }

  const cert = asString(record.CERT);
  const brnum = asString(record.BRNUM);
  const zip = asString(record.ZIP);
  if (!cert || !brnum) {
    return undefined;
  }

  return `branch:${encodeURIComponent([cert, brnum, zip].join("~"))}`;
}

function institutionSearchResult(record: Record<string, unknown>): SearchResult | undefined {
  const cert = asNumber(record.CERT);
  if (cert === undefined) {
    return undefined;
  }
  const title = getRecordTitle(record, `FDIC institution ${cert}`);
  const location = formatLocation(record);
  return {
    id: `institution:${cert}`,
    title: location ? `${title} (${location})` : title,
    url: getInstitutionUrl(cert),
  };
}

function failureSearchResult(record: Record<string, unknown>): SearchResult | undefined {
  const cert = asNumber(record.CERT);
  if (cert === undefined) {
    return undefined;
  }
  const title = getRecordTitle(record, `Failed bank ${cert}`);
  const failDate = asString(record.FAILDATE);
  return {
    id: `failure:${cert}`,
    title: failDate ? `${title} failed ${failDate}` : `${title} failure record`,
    url: getFailedBankListUrl(),
  };
}

function branchSearchResult(record: Record<string, unknown>): SearchResult | undefined {
  const id = buildBranchId(record);
  if (!id) {
    return undefined;
  }
  const name = getRecordTitle(record, "FDIC branch location");
  const address = [record.ADDRESS, record.CITY, record.STALP, record.ZIP]
    .map(asString)
    .filter(Boolean)
    .join(", ");
  return {
    id,
    title: address ? `${name} - ${address}` : name,
    url: getBranchCitationUrl(),
  };
}

function schemaSearchResults(query: string): SearchResult[] {
  const normalized = normalizeQuery(query).toLowerCase();
  const metadata = listEndpointMetadata();
  return metadata
    .filter((endpoint) => {
      if (normalized.includes(endpoint.endpoint.toLowerCase())) {
        return true;
      }
      if (endpoint.title.toLowerCase().includes(normalized)) {
        return true;
      }
      return Object.keys(endpoint.fields).some((field) =>
        normalized.includes(field.toLowerCase()),
      );
    })
    .slice(0, 2)
    .map((endpoint) => ({
      id: `schema:${endpoint.endpoint}`,
      title: `${endpoint.title} schema`,
      url: getSchemaDocsUrl(endpoint.endpoint),
    }));
}

async function searchInstitutions(query: string): Promise<SearchResult[]> {
  const cert = extractCertLikeNumber(query);
  const filters =
    cert !== undefined
      ? `CERT:${cert}`
      : `NAME:"${escapeFilterValue(query)}"`;
  const response = await queryEndpoint(ENDPOINTS.INSTITUTIONS, {
    filters,
    fields: "CERT,NAME,CITY,STALP,ACTIVE",
    limit: 3,
    sort_by: "ACTIVE",
    sort_order: "DESC",
  });
  return extractRecords(response)
    .map(institutionSearchResult)
    .filter((result): result is SearchResult => result !== undefined);
}

async function searchFailures(query: string): Promise<SearchResult[]> {
  const cert = extractCertLikeNumber(query);
  const filters =
    cert !== undefined
      ? `CERT:${cert}`
      : `NAME:"${escapeFilterValue(query)}"`;
  const response = await queryEndpoint(ENDPOINTS.FAILURES, {
    filters,
    fields: "CERT,NAME,CITY,STALP,FAILDATE,RESTYPE",
    limit: 2,
    sort_by: "FAILDATE",
    sort_order: "DESC",
  });
  return extractRecords(response)
    .map(failureSearchResult)
    .filter((result): result is SearchResult => result !== undefined);
}

async function searchBranches(query: string): Promise<SearchResult[]> {
  const cert = extractCertLikeNumber(query);
  const normalized = normalizeQuery(query);
  const zip = normalized.match(/\b\d{5}\b/)?.[0];
  const filters =
    cert !== undefined
      ? `CERT:${cert}`
      : zip !== undefined
        ? `ZIP:${zip}`
        : `CITY:"${escapeFilterValue(normalized)}"`;

  const response = await queryEndpoint(ENDPOINTS.LOCATIONS, {
    filters,
    fields: "UNINUM,CERT,NAME,OFFNAME,ADDRESS,CITY,STALP,ZIP",
    limit: 3,
    sort_by: "UNINUM",
    sort_order: "ASC",
  });
  return extractRecords(response)
    .map(branchSearchResult)
    .filter((result): result is SearchResult => result !== undefined);
}

async function safeSearch(
  searcher: () => Promise<SearchResult[]>,
): Promise<SearchResult[]> {
  try {
    return await searcher();
  } catch {
    return [];
  }
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const result of results) {
    if (seen.has(result.id)) {
      continue;
    }
    seen.add(result.id);
    deduped.push(result);
  }
  return deduped.slice(0, MAX_SEARCH_RESULTS);
}

function recordText(record: Record<string, unknown>, fields: string[]): string {
  return fields
    .map((field) => [field, asString(record[field])] as const)
    .filter(([, value]) => value !== "")
    .map(([field, value]) => `${field}: ${value}`)
    .join("\n");
}

async function fetchInstitution(cert: number): Promise<FetchResult> {
  const response = await queryEndpoint(ENDPOINTS.INSTITUTIONS, {
    filters: `CERT:${cert}`,
    limit: 1,
  });
  const record = extractRecords(response)[0];
  if (!record) {
    throw new Error(`No institution found for CERT ${cert}.`);
  }
  const title = getRecordTitle(record, `FDIC institution ${cert}`);
  return {
    id: `institution:${cert}`,
    title,
    text: recordText(record, [
      "CERT",
      "NAME",
      "CITY",
      "STALP",
      "STNAME",
      "ACTIVE",
      "ASSET",
      "DEP",
      "OFFICES",
      "BKCLASS",
      "REGAGNT",
      "ESTYMD",
    ]),
    url: getInstitutionUrl(cert),
    metadata: { type: "institution", cert, source: "FDIC BankFind Suite" },
  };
}

async function fetchFailure(cert: number): Promise<FetchResult> {
  const response = await queryEndpoint(ENDPOINTS.FAILURES, {
    filters: `CERT:${cert}`,
    limit: 1,
  });
  const record = extractRecords(response)[0];
  if (!record) {
    throw new Error(`No failure record found for CERT ${cert}.`);
  }
  const title = getRecordTitle(record, `Failed bank ${cert}`);
  return {
    id: `failure:${cert}`,
    title,
    text: recordText(record, [
      "CERT",
      "NAME",
      "CITY",
      "STALP",
      "FAILDATE",
      "RESTYPE",
      "QBFASSET",
      "COST",
    ]),
    url: getFailedBankListUrl(),
    metadata: { type: "failure", cert, source: "FDIC Failed Bank List" },
  };
}

async function fetchBranch(rawId: string): Promise<FetchResult> {
  const decoded = decodeURIComponent(rawId);
  const [cert, brnum, zip] = decoded.split("~");
  const filters =
    cert && brnum
      ? [`CERT:${cert}`, `BRNUM:${brnum}`, zip ? `ZIP:${zip}` : undefined]
          .filter(Boolean)
          .join(" AND ")
      : `UNINUM:${decoded}`;
  const response = await queryEndpoint(ENDPOINTS.LOCATIONS, {
    filters,
    limit: 1,
  });
  const record = extractRecords(response)[0];
  if (!record) {
    throw new Error(`No branch/location found for id ${rawId}.`);
  }
  const title = getRecordTitle(record, `FDIC branch ${rawId}`);
  const id = buildBranchId(record) ?? `branch:${rawId}`;
  return {
    id,
    title,
    text: recordText(record, [
      "UNINUM",
      "CERT",
      "UNINAME",
      "NAMEFULL",
      "ADDRESS",
      "CITY",
      "STALP",
      "ZIP",
      "COUNTY",
      "BRNUM",
      "BRSERTYP",
      "ESTYMD",
      "ENDEFYMD",
    ]),
    url: getBranchCitationUrl(),
    metadata: {
      type: "branch",
      cert: record.CERT,
      uninum: record.UNINUM,
      source: "FDIC BankFind Suite locations",
    },
  };
}

function fetchSchema(endpoint: string): FetchResult {
  const metadata = getEndpointMetadata(endpoint);
  if (!metadata) {
    throw new Error(`No schema metadata found for endpoint ${endpoint}.`);
  }
  const fields = Object.values(metadata.fields)
    .slice(0, 200)
    .map((field) => {
      const title = field.title ? ` - ${field.title}` : "";
      return `${field.name}${title}`;
    })
    .join("\n");
  return {
    id: `schema:${endpoint}`,
    title: `${metadata.title} schema`,
    text: [
      metadata.description ?? metadata.title,
      "",
      `Endpoint: ${metadata.endpoint}`,
      `Source: ${metadata.source.docsBaseUrl}`,
      "",
      "Fields:",
      fields,
    ].join("\n"),
    url: getSchemaDocsUrl(endpoint),
    metadata: {
      type: "schema",
      endpoint,
      field_count: Object.keys(metadata.fields).length,
      source: metadata.source.docsBaseUrl,
    },
  };
}

async function fetchById(id: string): Promise<FetchResult> {
  const [kind, rawValue] = id.split(":", 2);
  if (!kind || !rawValue) {
    throw new Error(
      "Invalid fetch id. Expected institution:<CERT>, failure:<CERT>, branch:<id>, or schema:<endpoint>.",
    );
  }

  if (kind === "institution") {
    const cert = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(cert) || cert <= 0) {
      throw new Error(`Invalid institution CERT in id ${id}.`);
    }
    return fetchInstitution(cert);
  }

  if (kind === "failure") {
    const cert = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(cert) || cert <= 0) {
      throw new Error(`Invalid failure CERT in id ${id}.`);
    }
    return fetchFailure(cert);
  }

  if (kind === "branch") {
    return fetchBranch(rawValue);
  }

  if (kind === "schema") {
    return fetchSchema(rawValue);
  }

  throw new Error(`Unsupported fetch id kind: ${kind}.`);
}

async function runSearch(query: string): Promise<{ results: SearchResult[] }> {
  const normalized = normalizeQuery(query);
  const shouldIncludeFailures = shouldSearchFailures(normalized);
  const shouldIncludeBranches = shouldSearchBranches(normalized);
  const shouldIncludeSchemas = shouldSearchSchemas(normalized);

  const [institutions, failures, branches] = await Promise.all([
    safeSearch(() => searchInstitutions(normalized)),
    shouldIncludeFailures
      ? safeSearch(() => searchFailures(normalized))
      : Promise.resolve([]),
    shouldIncludeBranches
      ? safeSearch(() => searchBranches(normalized))
      : Promise.resolve([]),
  ]);

  const fallbackFailures =
    failures.length === 0 && institutions.length === 0
      ? await safeSearch(() => searchFailures(normalized))
      : [];
  const fallbackBranches =
    branches.length === 0 && institutions.length === 0
      ? await safeSearch(() => searchBranches(normalized))
      : [];
  const schemas = shouldIncludeSchemas ? schemaSearchResults(normalized) : [];

  const results = dedupeResults([
    ...institutions,
    ...failures,
    ...branches,
    ...fallbackFailures,
    ...fallbackBranches,
    ...schemas,
  ]);

  return { results };
}

const SEARCH_DESCRIPTION =
  "Use this when the model needs citation-friendly FDIC BankFind search results for institutions, failed banks, branches, or schema documentation. Returns up to 8 results with id, title, and source URL.";
const FETCH_DESCRIPTION =
  "Use this when the model needs the full citation text for a result returned by search. Pass the search result id (e.g. 'institution:3511', 'failure:1234', 'branch:<UNINUM>', 'schema:institutions').";

function registerSearchTool(server: McpServer, name: string): void {
  server.registerTool(
    name,
    {
      title: "Search FDIC BankFind",
      description: SEARCH_DESCRIPTION,
      inputSchema: SearchInputSchema,
      outputSchema: ChatGptSearchResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      const payload = await runSearch(query);
      return {
        content: [{ type: "text", text: jsonText(payload) }],
        structuredContent: payload,
      };
    },
  );
}

function registerFetchTool(server: McpServer, name: string): void {
  server.registerTool(
    name,
    {
      title: "Fetch FDIC BankFind Result",
      description: FETCH_DESCRIPTION,
      inputSchema: FetchInputSchema,
      outputSchema: ChatGptFetchResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        const result = await fetchById(id);
        return {
          content: [{ type: "text", text: jsonText(result) }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}

export interface RegisterRetrievalToolsOptions {
  /**
   * Whether to register the canonical (un-prefixed) `search` and `fetch` tool
   * names that ChatGPT's compatibility check expects. Default true.
   */
  includeCanonicalNames?: boolean;
  /**
   * Whether to register the namespaced `fdic_search` and `fdic_fetch` aliases
   * for general MCP clients (Claude, etc.) where un-prefixed names risk
   * collision with other connectors. Default true.
   */
  includeNamespacedAliases?: boolean;
}

export function registerChatGptRetrievalTools(
  server: McpServer,
  options: RegisterRetrievalToolsOptions = {},
): void {
  const includeCanonical = options.includeCanonicalNames ?? true;
  const includeAliases = options.includeNamespacedAliases ?? true;

  if (includeCanonical) {
    registerSearchTool(server, "search");
    registerFetchTool(server, "fetch");
  }
  if (includeAliases) {
    registerSearchTool(server, "fdic_search");
    registerFetchTool(server, "fdic_fetch");
  }
}
