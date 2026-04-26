export const FDIC_BANKFIND_BASE_URL =
  "https://banks.data.fdic.gov/bankfind-suite";

export const FDIC_FAILED_BANK_LIST_URL =
  "https://www.fdic.gov/bank-failures/failed-bank-list";

export const PROJECT_TOOL_REFERENCE_URL =
  "https://jflamb.github.io/fdic-mcp-server/tool-reference/";

export function getInstitutionUrl(cert: number | string): string {
  return `${FDIC_BANKFIND_BASE_URL}/bankfind/details/${cert}`;
}

export function getFailedBankListUrl(): string {
  return FDIC_FAILED_BANK_LIST_URL;
}

export function getSchemaDocsUrl(endpoint: string): string {
  return `${PROJECT_TOOL_REFERENCE_URL}#${encodeURIComponent(endpoint)}`;
}

export function getBranchCitationUrl(): string {
  return `${PROJECT_TOOL_REFERENCE_URL}#fdic_search_locations`;
}
