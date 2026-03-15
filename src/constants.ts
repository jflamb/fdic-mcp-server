export const VERSION = "1.0.0";

export const FDIC_API_BASE_URL = "https://banks.data.fdic.gov/api";

export const CHARACTER_LIMIT = 50_000;

export const ENDPOINTS = {
  INSTITUTIONS: "institutions",
  FAILURES: "failures",
  LOCATIONS: "locations",
  HISTORY: "history",
  SUMMARY: "summary",
  FINANCIALS: "financials",
  SOD: "sod",
  DEMOGRAPHICS: "demographics",
} as const;
