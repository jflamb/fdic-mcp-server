declare const __APP_VERSION__: string;

export const VERSION =
  typeof __APP_VERSION__ !== "undefined"
    ? __APP_VERSION__
    : (process.env.npm_package_version ?? "0.0.0-dev");

export const FDIC_API_BASE_URL = "https://banks.data.fdic.gov/api";

export const CHARACTER_LIMIT = 50_000;
export const DEFAULT_FDIC_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

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
