/**
 * Direct FDIC upstream API connectivity and schema sanity checks.
 *
 * These tests call the FDIC BankFind API via the server's queryEndpoint()
 * function (no MCP overhead) to verify:
 *   - Upstream API is reachable
 *   - Response envelope shape matches what fdicClient.ts expects
 *   - Key fields referenced by tool logic are present in responses
 *
 * Run with: npm run test:live
 *
 * NOTE: Field lists are omitted from most queries here because different FDIC
 * endpoints expose different field catalogs, and the schema validator
 * rejects unknown fields. The tool implementations handle field selection
 * internally. These tests focus on the response envelope contract.
 */

import { describe, expect, it } from "vitest";
import {
  queryEndpoint,
  extractRecords,
  buildPaginationInfo,
} from "../../src/services/fdicClient.js";
import { ENDPOINTS } from "../../src/constants.js";

const TIMEOUT = 20_000;
const BANK_OF_AMERICA_CERT = 3511;

describe("FDIC upstream connectivity", () => {
  it(
    "institutions endpoint returns valid envelope",
    async () => {
      const response = await queryEndpoint(ENDPOINTS.INSTITUTIONS, {
        filters: `CERT:${BANK_OF_AMERICA_CERT}`,
        fields: "CERT,NAME,STALP,ASSET,ACTIVE",
        limit: 1,
      });

      // Validate the envelope shape that fdicClient.ts depends on
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.meta).toBeDefined();
      expect(typeof response.meta.total).toBe("number");

      // extractRecords maps response.data[].data → flat objects
      const records = extractRecords(response);
      expect(records.length).toBe(1);

      const record = records[0] as Record<string, unknown>;
      expect(record.CERT).toBe(BANK_OF_AMERICA_CERT);
      expect(record.NAME).toBeDefined();
      expect(record.STALP).toBeDefined();

      // Pagination helper should produce valid output
      const pagination = buildPaginationInfo(response.meta.total, 0, records.length);
      expect(pagination.total).toBeGreaterThan(0);
      expect(typeof pagination.has_more).toBe("boolean");
    },
    TIMEOUT,
  );

  it(
    "financials endpoint returns quarterly data",
    async () => {
      const response = await queryEndpoint(ENDPOINTS.FINANCIALS, {
        filters: `CERT:${BANK_OF_AMERICA_CERT} AND REPDTE:20231231`,
        limit: 1,
      });

      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const records = extractRecords(response);
      expect(records.length).toBe(1);

      const record = records[0] as Record<string, unknown>;
      expect(record.CERT).toBe(BANK_OF_AMERICA_CERT);
      expect(record.REPDTE).toBe("20231231");
      expect(typeof record.ASSET).toBe("number");
    },
    TIMEOUT,
  );

  it(
    "summary endpoint returns annual aggregate data",
    async () => {
      // Summary is aggregate (not per-institution); filter by year only
      const response = await queryEndpoint(ENDPOINTS.SUMMARY, {
        filters: "YEAR:2023",
        limit: 1,
      });

      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const records = extractRecords(response);
      expect(records.length).toBe(1);

      const record = records[0] as Record<string, unknown>;
      expect(typeof record.ASSET).toBe("number");
      expect(typeof record.DEP).toBe("number");
    },
    TIMEOUT,
  );

  it(
    "demographics endpoint returns office data",
    async () => {
      const response = await queryEndpoint(ENDPOINTS.DEMOGRAPHICS, {
        filters: `CERT:${BANK_OF_AMERICA_CERT} AND REPDTE:20231231`,
        limit: 1,
      });

      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const records = extractRecords(response);
      expect(records.length).toBe(1);

      const record = records[0] as Record<string, unknown>;
      expect(typeof record.OFFTOT).toBe("number");
      expect(record.OFFTOT as number).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    "sod endpoint returns branch deposit data",
    async () => {
      const response = await queryEndpoint(ENDPOINTS.SOD, {
        filters: `CERT:${BANK_OF_AMERICA_CERT} AND YEAR:2023`,
        limit: 1,
      });

      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const records = extractRecords(response);
      expect(records.length).toBeGreaterThanOrEqual(1);

      const record = records[0] as Record<string, unknown>;
      expect(record.CERT).toBe(BANK_OF_AMERICA_CERT);
    },
    TIMEOUT,
  );

  it(
    "failures endpoint returns historical data",
    async () => {
      // Use a broad date filter that reliably returns results (2008 financial crisis)
      const response = await queryEndpoint(ENDPOINTS.FAILURES, {
        filters: "FAILDATE:[2008-01-01 TO 2008-12-31]",
        limit: 1,
      });

      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const records = extractRecords(response);
      // 2008 had many bank failures, should always return at least one
      expect(records.length).toBeGreaterThanOrEqual(1);
    },
    TIMEOUT,
  );
});
