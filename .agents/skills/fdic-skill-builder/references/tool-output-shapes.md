# Tool Output Shapes — Analysis & Comparison Tools

Verified `structuredContent` paths for all analytical tools used in deep-dive style skills.

**Legend:**
- `[live]` — path confirmed from a live tool response
- `[source-derived]` — path derived from TypeScript interfaces; not yet confirmed live

> Before adding a new path here, capture a live response. If the tool is currently broken, derive from source and mark `[source-derived]`. Update to `[live]` once confirmed.

---

## `fdic_analyze_bank_health`

Wraps `public_camels_proxy_v1`. Top-level shape:

```
structuredContent.model                     "public_camels_proxy_v1"           [live]
structuredContent.official_status           "public off-site proxy, not official CAMELS"  [live]
structuredContent.proxy                     ProxyAssessment object             [live]
structuredContent.institution.cert          number                             [live]
structuredContent.institution.name          string                             [live]
structuredContent.institution.city          string                             [live]
structuredContent.institution.state         string                             [live]
structuredContent.institution.charter_class string                             [live]
structuredContent.institution.total_assets  number (thousands $)               [live]
structuredContent.institution.report_date   string (YYYYMMDD)                  [live]
structuredContent.institution.data_staleness string                            [live]
structuredContent.composite.rating          number                             [live]
structuredContent.composite.label           string                             [live]
structuredContent.components                ComponentScore[]                   [live]
structuredContent.components[i].component   string (e.g. "C", "A", "M", ...)  [live]
structuredContent.components[i].rating      number                             [live]
structuredContent.components[i].metrics     Metric[]                           [live]
structuredContent.components[i].flags       string[]                           [live]
structuredContent.trends                    TrendAnalysis[]                    [live]
structuredContent.risk_signals              string[]                           [live]
structuredContent.proxy_band                string (e.g. "satisfactory")       [live]
structuredContent.proxy_score               number (1.0–4.0)                   [live]
structuredContent.capital_category          string (e.g. "well_capitalized")   [live]
```

---

## `fdic_ubpr_analysis`

Top-level shape matches `UbprAnalysisSummary`:

```
structuredContent.institution.cert              number                        [source-derived]
structuredContent.institution.name              string                        [source-derived]
structuredContent.institution.city              string                        [source-derived]
structuredContent.institution.state             string                        [source-derived]
structuredContent.institution.total_assets      number (thousands $)          [source-derived]
structuredContent.institution.report_date       string (YYYYMMDD)             [source-derived]
structuredContent.institution.prior_report_date string (YYYYMMDD)             [source-derived]
structuredContent.ratios.summary.roa            number | null                 [source-derived]
structuredContent.ratios.summary.roe            number | null                 [source-derived]
structuredContent.ratios.summary.nim            number | null                 [source-derived]
structuredContent.ratios.summary.efficiency_ratio number | null               [source-derived]
structuredContent.ratios.summary.pretax_roa     number | null                 [source-derived]
structuredContent.ratios.loan_mix.re_share      number | null (pct)           [source-derived]
structuredContent.ratios.loan_mix.ci_share      number | null (pct)           [source-derived]
structuredContent.ratios.loan_mix.consumer_share number | null (pct)          [source-derived]
structuredContent.ratios.loan_mix.ag_share      number | null (pct)           [source-derived]
structuredContent.ratios.capital.tier1_leverage number | null                 [source-derived]
structuredContent.ratios.capital.tier1_rbc      number | null                 [source-derived]
structuredContent.ratios.capital.equity_ratio   number | null (pct)           [source-derived]
structuredContent.ratios.liquidity.loan_to_deposit     number | null (pct)    [source-derived]
structuredContent.ratios.liquidity.core_deposit_ratio  number | null (pct)    [source-derived]
structuredContent.ratios.liquidity.brokered_ratio      number | null          [source-derived]
structuredContent.ratios.liquidity.cash_ratio          number | null          [source-derived]
structuredContent.growth.asset_growth           number | null (pct)           [source-derived]
structuredContent.growth.loan_growth            number | null (pct)           [source-derived]
structuredContent.growth.deposit_growth         number | null (pct)           [source-derived]
structuredContent.disclaimer                    string                        [source-derived]
```

> Note: `fdic_ubpr_analysis` was non-functional at time of writing (invalid `LNOTH` field in `UBPR_FIELDS`). Fixed in commit `b3a0b3e`. Re-capture live responses after confirming fix.

---

## `fdic_peer_group_analysis`

```
structuredContent.subject.cert              number                            [live]
structuredContent.subject.name              string                            [live]
structuredContent.subject.city              string                            [live]
structuredContent.subject.stalp             string                            [live]
structuredContent.subject.bkclass           string                            [live]
structuredContent.subject.metrics           object (keyed by metric name)     [live]
structuredContent.subject.rankings          object | null                     [live]
structuredContent.peer_group.repdte         string (YYYYMMDD)                 [live]
structuredContent.peer_group.criteria_used  object                            [live]
structuredContent.peer_group.medians        object (keyed by metric name)     [live]
structuredContent.peers                     array                             [live]
structuredContent.peers[i].cert             number                            [live]
structuredContent.peers[i].name             string                            [live]
structuredContent.peers[i].metrics          object                            [live]
structuredContent.peer_count                number                            [live]
structuredContent.returned_count            number                            [live]
structuredContent.has_more                  boolean                           [live]
structuredContent.warnings                  string[]                          [live]
```

---

## `fdic_compare_peer_health`

```
structuredContent.model                     "public_camels_proxy_v1"          [live]
structuredContent.official_status           string                            [live]
structuredContent.proxy                     ProxyAssessment (subject)         [live]
structuredContent.report_date               string (YYYYMMDD)                 [live]
structuredContent.subject_cert              number | null                     [live]
structuredContent.subject_rank              RankResult | null                 [live]
structuredContent.total_institutions        number                            [live]
structuredContent.returned_count            number                            [live]
structuredContent.institutions              array (peer + subject entries)    [live]
structuredContent.peer_context              object                            [live]
```

---

## `fdic_analyze_credit_concentration`

Top-level shape matches `CreditConcentrationSummary`:

```
structuredContent.institution.cert          number                            [live]
structuredContent.institution.name          string                            [live]
structuredContent.institution.city          string                            [live]
structuredContent.institution.state         string                            [live]
structuredContent.institution.total_assets  number (thousands $)              [live]
structuredContent.institution.report_date   string (YYYYMMDD)                 [live]
structuredContent.metrics                   CreditMetrics object              [live]
structuredContent.signals                   CreditSignal[]                    [live]
structuredContent.signals[i].type           string                            [live]
structuredContent.signals[i].message        string                            [live]
```

---

## `fdic_analyze_funding_profile`

Top-level shape matches `FundingProfileSummary`:

```
structuredContent.institution.cert          number                            [live]
structuredContent.institution.name          string                            [live]
structuredContent.institution.city          string                            [live]
structuredContent.institution.state         string                            [live]
structuredContent.institution.total_assets  number (thousands $)              [live]
structuredContent.institution.report_date   string (YYYYMMDD)                 [live]
structuredContent.metrics                   FundingMetrics object             [live]
structuredContent.signals                   FundingSignal[]                   [live]
```

---

## `fdic_analyze_securities_portfolio`

Top-level shape matches `SecuritiesPortfolioSummary`:

```
structuredContent.institution.cert          number                            [live]
structuredContent.institution.name          string                            [live]
structuredContent.institution.city          string                            [live]
structuredContent.institution.state         string                            [live]
structuredContent.institution.total_assets  number (thousands $)              [live]
structuredContent.institution.report_date   string (YYYYMMDD)                 [live]
structuredContent.metrics                   SecuritiesMetrics object          [live]
structuredContent.signals                   SecuritiesSignal[]                [live]
```

---

## `fdic_franchise_footprint`

Top-level shape matches `FranchiseFootprintSummary`:

```
structuredContent.institution.cert          number                            [live]
structuredContent.institution.name          string                            [live]
structuredContent.institution.year          number (SOD year, YYYY)           [live]
structuredContent.summary.total_branches    number                            [live]
structuredContent.summary.total_deposits    number (thousands $)              [live]
structuredContent.summary.market_count      number                            [live]
structuredContent.markets                   MarketBreakdown[]                 [live]
structuredContent.markets[i].market_name    string (e.g. "MSA 35620" or "Non-MSA / Rural")  [live]
structuredContent.markets[i].branch_count   number                            [live]
structuredContent.markets[i].total_deposits number (thousands $)              [live]
structuredContent.markets[i].pct_of_total   number (pct)                      [live]
```

> SOD data is grouped by MSA numeric code, not MSA name. `market_name` values are `"MSA <code>"` or `"Non-MSA / Rural"`.

---

## `fdic_regional_context`

Top-level shape matches `RegionalContextSummary`:

```
structuredContent.state                     string                            [live]
structuredContent.institution.cert          number (if institution provided)  [live]
structuredContent.institution.name          string (if institution provided)  [live]
structuredContent.date_range.start          string (YYYY-MM-DD)               [live]
structuredContent.date_range.end            string (YYYY-MM-DD)               [live]
structuredContent.context                   MacroContext object               [live]
structuredContent.fred_available            boolean                           [live]
```

---

## `fdic_holding_company_profile`

Top-level shape matches `HoldingCompanyProfileResult`:

```
structuredContent.holding_company.name              string                   [source-derived]
structuredContent.holding_company.subsidiary_count  number                   [source-derived]
structuredContent.holding_company.states            string[]                 [source-derived]
structuredContent.aggregate.total_assets            number (thousands $)     [source-derived]
structuredContent.aggregate.total_deposits          number (thousands $)     [source-derived]
structuredContent.aggregate.subsidiary_count        number                   [source-derived]
structuredContent.aggregate.states                  string[]                 [source-derived]
structuredContent.aggregate.weighted_roa            number | null            [source-derived]
structuredContent.aggregate.weighted_equity_ratio   number | null            [source-derived]
structuredContent.subsidiaries                      array                    [source-derived]
structuredContent.subsidiaries[i].cert              number                   [source-derived]
structuredContent.subsidiaries[i].name              string                   [source-derived]
structuredContent.subsidiaries[i].state             string                   [source-derived]
structuredContent.subsidiaries[i].total_assets      number (thousands $)     [source-derived]
structuredContent.subsidiaries[i].total_deposits    number (thousands $)     [source-derived]
structuredContent.subsidiaries[i].roa               number | null            [source-derived]
structuredContent.subsidiaries[i].equity_ratio      number | null            [source-derived]
structuredContent.subsidiaries[i].active            boolean                  [source-derived]
```

> Note: `fdic_holding_company_profile` was non-functional at time of writing (`NAMHCR` → `NAMEHCR` field typo). Fixed in commit `b3a0b3e`. Re-capture live responses after confirming fix.

---

## Fields That Do Not Exist (Do Not Use)

These fields were found in server source code and caused live failures. They are invalid for their endpoints:

| Field | Endpoint | Status |
|---|---|---|
| `LNOTH` | financials | Does not exist. Removed from `UBPR_FIELDS` (PR #199, commit `b3a0b3e`). |
| `NAMHCR` | institutions | Typo. Correct field is `NAMEHCR`. Fixed in commit `b3a0b3e`. |
| `UNINAME` | summary-of-deposits | Does not exist. Removed in PR #202. |
| `MSANAMEBR` | summary-of-deposits | Does not exist. Removed in PR #202. |
| `CNTYBR` | summary-of-deposits | Does not exist. Removed in PR #202. |
