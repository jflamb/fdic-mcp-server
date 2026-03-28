import { ENDPOINTS } from "../../constants.js";
import { queryEndpoint, extractRecords } from "../../services/fdicClient.js";

/**
 * A structural-change event from the FDIC history endpoint, mapped to the
 * shape expected by the trend engine and risk-signal engine.
 */
export interface HistoryEvent {
  repdte: string;
  event_type: string;
  description: string;
}

/**
 * Fetch recent structural-change events (mergers, name changes, charter
 * conversions, failures) for a single institution.
 *
 * Returns an empty array on error so callers degrade gracefully — history
 * enrichment is additive, never a hard dependency.
 */
export async function fetchHistoryEvents(
  cert: number,
  options?: { signal?: AbortSignal; lookbackYears?: number; repdte?: string },
): Promise<HistoryEvent[]> {
  const lookbackYears = options?.lookbackYears ?? 3;

  let anchor: Date;
  if (options?.repdte && options.repdte.length === 8) {
    const y = Number.parseInt(options.repdte.slice(0, 4), 10);
    const m = Number.parseInt(options.repdte.slice(4, 6), 10) - 1;
    const d = Number.parseInt(options.repdte.slice(6, 8), 10);
    anchor = new Date(Date.UTC(y, m, d));
  } else {
    anchor = new Date();
  }

  const cutoff = new Date(anchor);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - lookbackYears);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const response = await queryEndpoint(
      ENDPOINTS.HISTORY,
      {
        filters: `CERT:${cert} AND PROCDATE:[${cutoffStr} TO *]`,
        fields: "CERT,PROCDATE,TYPE,CHANGECODE,CHANGECODE_DESC",
        sort_by: "PROCDATE",
        sort_order: "DESC",
        limit: 20,
      },
      { signal: options?.signal },
    );

    const records = extractRecords(response);
    return records.map(mapRecordToHistoryEvent);
  } catch {
    // History enrichment is best-effort; return empty on failure
    return [];
  }
}

function mapRecordToHistoryEvent(
  record: Record<string, unknown>,
): HistoryEvent {
  const procdate = String(record.PROCDATE ?? "");
  // PROCDATE is YYYY-MM-DD; convert to YYYYMMDD for consistency with repdte
  const repdte = procdate.replace(/-/g, "");

  const type = String(record.TYPE ?? record.CHANGECODE ?? "unknown");
  const desc = String(
    record.CHANGECODE_DESC ?? record.TYPE ?? "structural change",
  );

  return { repdte, event_type: type, description: desc };
}
