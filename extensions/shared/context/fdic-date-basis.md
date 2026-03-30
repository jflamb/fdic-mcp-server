# FDIC Date Basis Rules

FDIC data uses different date conventions depending on the dataset. Extensions must respect these differences and state the date basis explicitly when mixing sources.

| Data Source | Date Field | Format | Cadence | Derivation |
|---|---|---|---|---|
| Financials / UBPR | `REPDTE` | `YYYYMMDD` | Quarterly (0331, 0630, 0930, 1231) | Pass `repdte` param or omit for latest |
| SOD (branch/deposit) | `YEAR` | `YYYY` | Annual (as of June 30) | Most recent year where June 30 <= analysis date |
| Institution profile | n/a | n/a | Current only | `fdic_get_institution` is not date-scoped |
| Demographics | `REPDTE` | `YYYYMMDD` | Quarterly | Same as financials |
| Failures | `FAILDATE` | `YYYY-MM-DD` | Event-based | Not periodic |

## Rules

1. **Inactive institution `repdte` derivation:** The institution record contains a `REPDTE` field in `MM/DD/YYYY` format. Convert to `YYYYMMDD` before passing to financial tools. Do not use today's date.

2. **Absolute date statements:** Output that mixes data from different date bases must state the basis date for each section. Never write "as of the latest period" without specifying which period.

3. **Quarter-end alignment:** Valid quarter-end dates are March 31, June 30, September 30, and December 31. Any `repdte` value must align to one of these dates.

4. **Staleness warning:** If the effective report date is more than 120 days before the analysis date, the output must include an explicit staleness caveat.
