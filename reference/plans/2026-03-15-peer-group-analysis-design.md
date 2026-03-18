# Peer Group Analysis Tool Design

## Overview

A new `fdic_peer_group_analysis` tool that builds a peer group for an FDIC-insured institution and ranks it against peers on key financial and efficiency metrics at a single report date. The tool is stateless — peer group CERTs are returned in the response and can be passed to `fdic_compare_bank_snapshots` for trend analysis.

## Input Schema

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cert` | number, optional | — | Subject institution CERT. Auto-derives peer criteria; ranks this bank against peers. |
| `repdte` | string, required | — | Report date in YYYYMMDD format. |
| `asset_min` | number, optional | 50% of subject's report-date assets | Minimum total assets ($thousands). |
| `asset_max` | number, optional | 200% of subject's report-date assets | Maximum total assets ($thousands). |
| `charter_classes` | string[], optional | [subject's BKCLASS] | Charter class codes to include (e.g., ["N", "SM"]). |
| `state` | string, optional | — | Two-letter state code (e.g., "NC", "TX"). |
| `raw_filter` | string, optional | — | Advanced: raw ElasticSearch query string for peer selection. Appended to other criteria with AND. Not validated beyond what the FDIC API accepts. |
| `active_only` | boolean | true | Limit to institutions where ACTIVE:1 (currently operating, FDIC-insured). |
| `extra_fields` | string[], optional | — | Additional FDIC field names to include as raw values in the response payload. Does not affect peer selection. |
| `limit` | number | 50 | Max peer records returned in the response. All matched peers are used for percentile/rank computation regardless of this limit. |

### Three Usage Modes

**Subject-driven (auto-build):**
```json
{ "cert": 29846, "repdte": "20241231" }
```

**Explicit criteria:**
```json
{ "repdte": "20241231", "asset_min": 5000000, "asset_max": 20000000, "charter_classes": ["N"], "state": "NC" }
```

**Subject with overrides:**
```json
{ "cert": 29846, "repdte": "20241231", "asset_min": 3000000, "state": "NC" }
```

### Override Precedence

When `cert` is provided, the tool looks up the subject institution's profile and report-date financials, then derives defaults for `asset_min`, `asset_max`, and `charter_classes`. Any explicitly provided parameter overrides the derived default. Explicit parameters without `cert` are used as-is with no derivation.

### Validation Rules

- `repdte` is always required.
- At least one peer-group constructor is required: `cert`, `asset_min`, `asset_max`, `charter_classes`, `state`, or `raw_filter`.
- If both `asset_min` and `asset_max` are provided, `asset_min` must be <= `asset_max`.
- If `cert` is provided and no institution is found for that CERT, return an error.
- If `cert` is provided but the subject has no financial data for `repdte`, return an error explaining that auto-derivation requires asset data at the specified report date.
- `state` must be exactly 2 uppercase letters when provided.

## Output Shape

### Structural Rules

- **Subject is excluded from peers.** The subject bank does not appear in the `peers` array and is not counted in ranking denominators. Rankings answer "how does the subject compare against its peers."
- **Medians exclude the subject.** `peer_group.medians` is computed from the peer set only.
- **Null metric handling:** Percentile/rank denominators are metric-specific. If 27 peers exist but only 24 have valid ROE, then `"of": 24` for ROE. Medians are computed from non-null values only. If the subject's value for a metric is null, that metric's ranking entry is `null`.
- **Consistent field placement:** Balance-sheet fields (`asset`, `dep`) and derived ratios all live inside `metrics` for both subject and peers. Identification fields (`cert`, `name`, `city`, `stalp`) are top-level.

### Response Structure

```json
{
  "subject": {
    "cert": 29846,
    "name": "Live Oak Banking Company",
    "city": "Wilmington",
    "stalp": "NC",
    "bkclass": "NM",
    "metrics": {
      "asset": 11200000,
      "dep": 9800000,
      "roa": 1.25,
      "roe": 12.8,
      "netnim": 3.45,
      "equity_ratio": 9.8,
      "efficiency_ratio": 58.2,
      "loan_to_deposit": 0.87,
      "deposits_to_assets": 0.875,
      "noninterest_income_share": 0.12
    },
    "rankings": {
      "asset": { "rank": 2, "of": 27, "percentile": 93 },
      "roa": { "rank": 3, "of": 27, "percentile": 89 },
      "roe": { "rank": 5, "of": 24, "percentile": 79 },
      "netnim": { "rank": 8, "of": 27, "percentile": 70 },
      "equity_ratio": { "rank": 12, "of": 27, "percentile": 56 },
      "efficiency_ratio": { "rank": 6, "of": 27, "percentile": 78 },
      "loan_to_deposit": { "rank": 15, "of": 27, "percentile": 44 },
      "deposits_to_assets": { "rank": 10, "of": 27, "percentile": 63 },
      "noninterest_income_share": { "rank": 4, "of": 25, "percentile": 84 }
    }
  },
  "peer_group": {
    "repdte": "20241231",
    "criteria_used": {
      "asset_min": 5600000,
      "asset_max": 22400000,
      "charter_classes": ["NM"],
      "state": null,
      "active_only": true,
      "raw_filter": null
    },
    "medians": {
      "asset": 9500000,
      "dep": 7800000,
      "roa": 0.95,
      "roe": 9.2,
      "netnim": 3.1,
      "equity_ratio": 10.1,
      "efficiency_ratio": 65.0,
      "loan_to_deposit": 0.82,
      "deposits_to_assets": 0.84,
      "noninterest_income_share": 0.08
    }
  },
  "metric_definitions": {
    "asset": { "higher_is_better": true, "unit": "$thousands", "label": "Total Assets" },
    "dep": { "higher_is_better": true, "unit": "$thousands", "label": "Total Deposits" },
    "roa": { "higher_is_better": true, "unit": "%", "label": "Return on Assets" },
    "roe": { "higher_is_better": true, "unit": "%", "label": "Return on Equity" },
    "netnim": { "higher_is_better": true, "unit": "%", "label": "Net Interest Margin" },
    "equity_ratio": { "higher_is_better": true, "unit": "%", "label": "Equity Capital Ratio" },
    "efficiency_ratio": { "higher_is_better": false, "unit": "%", "label": "Efficiency Ratio" },
    "loan_to_deposit": { "higher_is_better": null, "unit": "ratio", "label": "Loan-to-Deposit Ratio", "ranking_note": "Rank and percentile reflect position by value (1 = highest). Directionality is context-dependent." },
    "deposits_to_assets": { "higher_is_better": null, "unit": "ratio", "label": "Deposits-to-Assets Ratio", "ranking_note": "Rank and percentile reflect position by value (1 = highest). Directionality is context-dependent." },
    "noninterest_income_share": { "higher_is_better": true, "unit": "ratio", "label": "Non-Interest Income Share" }
  },
  "peers": [
    {
      "cert": 12345,
      "name": "Some Peer Bank",
      "city": "Raleigh",
      "stalp": "NC",
      "metrics": {
        "asset": 10500000,
        "dep": 8200000,
        "roa": 1.1,
        "roe": 10.5,
        "netnim": 3.2,
        "equity_ratio": 10.5,
        "efficiency_ratio": 62.0,
        "loan_to_deposit": 0.85,
        "deposits_to_assets": 0.78,
        "noninterest_income_share": 0.09
      }
    }
  ],
  "peer_count": 27,
  "returned_count": 27,
  "has_more": false,
  "message": null,
  "warnings": []
}
```

### Key Notes

- `subject` is present only when `cert` was provided. Omitted in explicit-criteria-only mode.
- `peer_count` is the single source of truth for the analytical universe size (post-financial-filtering). It appears only at the top level.
- `message` is a single human-readable informational string or null.
- `warnings` is a string array for non-fatal issues (e.g., roster truncation).
- `extra_fields` values appear as additional keys inside each peer's top-level object, not inside `metrics`, clearly separated from computed metrics.
- `metric_definitions` is always present, giving downstream consumers the context to interpret rankings correctly.

### Empty Peer Set

Returns `peer_count: 0`, empty `medians` (all null), empty `peers`, no `rankings` on subject, `message` with a factual statement, and `metric_definitions` still included.

## Computation Pipeline

### Phase 1 — Resolve Subject (if `cert` provided)

Two parallel queries:
- `institutions` endpoint: `CERT:{cert}` for profile fields (`NAME`, `CITY`, `STALP`, `BKCLASS`).
- `financials` endpoint: `CERT:{cert} AND REPDTE:{repdte}` for report-date financial data.

If the institution is not found, return an error. If financials are not found for `repdte`, return an error: "No financial data for CERT {cert} at report date {repdte}. Auto-derivation of peer criteria requires asset data at the specified report date."

Derive defaults from the **financials** record's `ASSET`:
- `asset_min` default = `ASSET * 0.5`
- `asset_max` default = `ASSET * 2.0`
- `charter_classes` default = `[BKCLASS]` (from institutions profile)

Explicit parameters override derived values.

### Phase 2 — Build Peer Roster

Query the `institutions` endpoint with assembled criteria:
- `ASSET:[{asset_min} TO {asset_max}]` (when either bound is set)
- `BKCLASS:{class}` joined with OR (when `charter_classes` is set)
- `STALP:{state}` (when `state` is set)
- `ACTIVE:1` (when `active_only` is true)
- Any `raw_filter` appended with AND

Use `limit: 10_000`. If `response.meta.total > records.length`, the roster is truncated — add a warning to the `warnings` array. Remove the subject CERT from results if present.

### Phase 3 — Fetch Peer Financials

Query the `financials` endpoint for `REPDTE:{repdte}` across all peer CERTs using the same batched-chunking pattern as `fdic_compare_bank_snapshots` (chunks of 25 CERTs, max 4 concurrent requests).

Fields requested: `CERT,ASSET,DEP,NETINC,ROA,ROE,NETNIM,EQTOT,LNLSNET,INTINC,EINTEXP,NONII,NONIX` plus any `extra_fields`.

Peers missing financial data for `repdte` are dropped from the analytical universe. Peers with financial data but some null derived metrics remain in the universe — they are excluded only from per-metric ranking denominators where their value is null.

`peer_count` reflects the post-financial-filtering analytical universe.

### Phase 4 — Compute Metrics, Rank, and Assemble

**Derived metrics** (for subject and all peers):
- `equity_ratio` = `EQTOT / ASSET * 100` (null if ASSET is 0 or either value is null)
- `efficiency_ratio` = `NONIX / (net_interest_income + NONII) * 100` where `net_interest_income = INTINC - EINTEXP` (null if denominator is <= 0, or any input is null)
- `loan_to_deposit` = `LNLSNET / DEP` (null if DEP is 0 or either is null)
- `deposits_to_assets` = `DEP / ASSET` (null if ASSET is 0 or either is null)
- `noninterest_income_share` = `NONII / (net_interest_income + NONII)` (null if denominator is <= 0, or any input is null)

**Ranking uses competition rank** (`1, 2, 2, 4`): tied values receive the same rank, and the next rank skips by the number of ties. The subject receives the same competition rank as peers with equal values.

For each metric:
1. Collect non-null values from peers only (subject excluded).
2. For `higher_is_better: true` — sort descending. For `higher_is_better: false` — sort ascending. For `higher_is_better: null` — sort descending.
3. Assign competition ranks to the sorted peer values.
4. Determine where the subject's value would rank using the same competition-rank logic. The subject receives the same rank as peers with equal values.
5. `of` = count of peers with non-null values for this metric.
6. Percentile = `(1 - (rank - 1) / of) * 100`, rounded to nearest integer. Top-ranked bank receives 100th percentile.
7. If subject's metric value is null, its ranking entry for that metric is `null`.

Compute medians from non-null peer values only (subject excluded).

Sort `peers` by `asset` descending. Truncate to `limit`. Set `returned_count` = length of truncated array, `has_more` = `peer_count > returned_count`.

**Timeout:** 90-second `AbortController` budget.

**Caching:** Relies on existing `queryCache` in `fdicClient.ts`.

## Text Output Formatting

Text uses human-readable dates (e.g., "December 31, 2024" instead of "20241231"). Metric order is fixed and identical across subject rankings, medians, and peer rows: asset, dep, roa, roe, netnim, equity_ratio, efficiency_ratio, loan_to_deposit, deposits_to_assets, noninterest_income_share.

### With Subject

```
Peer group analysis for Live Oak Banking Company (CERT 29846) as of December 31, 2024.
27 peers matched (asset range $5,600,000k-$22,400,000k, charter classes: NM, active only).

Subject rankings:
  Total Assets:              rank 2 of 27  (93rd percentile)  $11,200,000k  median: $9,500,000k
  Return on Assets:          rank 3 of 27  (89th percentile)  1.2500%       median: 0.9500%
  Return on Equity:          rank 5 of 24  (79th percentile)  12.8000%      median: 9.2000%
  Net Interest Margin:       rank 8 of 27  (70th percentile)  3.4500%       median: 3.1000%
  Equity Capital Ratio:      rank 12 of 27 (56th percentile)  9.8000%       median: 10.1000%
  Efficiency Ratio:          rank 6 of 27  (78th percentile)  58.2000%      median: 65.0000%
  Loan-to-Deposit Ratio:     rank 15 of 27 (44th percentile)  0.8700        median: 0.8200
  Deposits-to-Assets Ratio:  rank 10 of 27 (63rd percentile)  0.8750        median: 0.8400
  Non-Interest Income Share: rank 4 of 25  (84th percentile)  0.1200        median: 0.0800

Peers (27 returned):
1. Some Peer Bank, Raleigh NC (CERT 12345) | Asset: $10,500,000k | ROA: 1.1000% | ROE: 10.5000%
2. Another Bank, Charlotte NC (CERT 67890) | Asset: $9,800,000k | ROA: 0.9500% | ROE: 8.7000%
```

### Without Subject (explicit-criteria mode)

```
Peer group analysis as of December 31, 2024.
27 institutions matched (asset range $5,000,000k-$20,000,000k, charter classes: N, state: NC, active only).

Peer group medians:
  Total Assets: $9,500,000k | ROA: 0.9500% | ROE: 9.2000% | Efficiency: 65.0000% | ...

Peers (27 returned):
1. ...
```

### Empty Peer Set

```
Peer group analysis for Live Oak Banking Company (CERT 29846) as of December 31, 2024.
0 peers matched (asset range $5,600,000k-$22,400,000k, charter classes: NM, active only).
```

### Formatting Rules

- Text is truncated at the existing CHARACTER_LIMIT (50,000 chars) with the standard truncation suffix.
- Peer list in text shows up to `limit` peers, sorted by asset descending.
- Each peer row shows identification plus 3-4 key metrics (asset, ROA, ROE). When the peer group spans multiple states or charter classes, `stalp` and/or `bkclass` are included in peer rows.
- Warnings are prepended with "Warning: " prefix.
- Null metrics display as "n/a".
- Contextual metrics (loan_to_deposit, deposits_to_assets) are presented neutrally — no language implying "better" or "worse."

## Composability with Existing Tools

The peer CERTs in the `peers` array can be extracted and passed to `fdic_compare_bank_snapshots` for trend analysis:

1. Call `fdic_peer_group_analysis` with `cert: 29846, repdte: "20241231"` → get peer CERTs.
2. Call `fdic_compare_bank_snapshots` with `certs: [extracted peer CERTs], start_repdte: "20211231", end_repdte: "20241231"` → get growth/profitability trends across the peer group.

This keeps the peer group tool focused on single-date positioning and avoids duplicating time-series logic.
