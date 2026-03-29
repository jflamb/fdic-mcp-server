---
title: Usage Examples
nav_group: prompting
kicker: Prompting
summary: Copyable prompts for institution search, financial retrieval, snapshot comparison, peer analysis, and more — with expected answer shapes.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---

The examples below are natural-language prompts you can copy into any MCP client, followed by what a good answer should cover. These examples cover the **MCP tools** that work in any client.

For Claude Code skill examples, see the individual skill pages: [Bank Deep Dive]({{ '/skills/bank-deep-dive/' | relative_url }}), [Examiner Support]({{ '/skills/examiner-support/' | relative_url }}), [Portfolio Surveillance]({{ '/skills/portfolio-surveillance/' | relative_url }}), [Failure Forensics]({{ '/skills/failure-forensics/' | relative_url }}).

## Search Institutions

```text
Find active FDIC-insured banks in North Carolina with more than $1 billion in assets.
```

What a good answer should do:

- Focus on active North Carolina institutions above the requested asset threshold.

## Look Up A Known CERT

```text
Get institution details for CERT 3511.
```

What a good answer should do:

- Return the institution record for the requested CERT.

## Review Bank Failures

```text
List the 10 costliest bank failures since January 1, 2000.
```

What a good answer should do:

- Return the largest failure-cost examples since the requested date in descending order.

## Pull Quarterly Financials

```text
Show quarterly financials for CERT 3511 during 2023.
```

What a good answer should do:

- Return quarterly Call Report records for the requested bank over the requested year.
- Financials are quarterly data identified by `REPDTE`. Dollar amounts are in thousands.

## Compare Growth Across Two Dates

```text
Compare North Carolina banks between 20211231 and 20250630 and rank them by asset growth.
```

What a good answer should do:

- Compare the same state-level bank roster across the two dates and rank by asset growth.

## Run A Time-Series Analysis

```text
Analyze North Carolina banks from 20211231 through 20250630 and identify sustained asset-growth streaks.
```

What a good answer should do:

- Look across the full date range and identify banks with repeated or sustained growth, not just a one-date change.

## Build A Peer Group

```text
Build a peer group for CERT 29846 at 20241231 and rank it against peers on ROA and efficiency ratio.
```

What a good answer should do:

- Build a comparable peer set for the requested bank and report where it ranks on the requested metrics.

## Analyze Bank Health

```text
Run a CAMELS-style health assessment for CERT 3511 as of December 31, 2024 with 8 quarters of trend data.
```

What a good answer should do:

- Return composite and component ratings (Capital, Asset Quality, Earnings, Liquidity, Sensitivity) with individual metric scores.
- Include the `public_camels_proxy_v1` assessment with overall band.
- Show PCA-style capital categorization.
- Show trend analysis for key metrics across prior quarters.
- Flag risk signals using standardized codes.
- Note that this is an analytical proxy, not an official regulatory rating.

## Compare Peer Health

```text
Compare CAMELS health scores for all active banks in Wyoming, sorted by composite rating.
```

What a good answer should do:

- Score each institution using CAMELS-style analysis.
- Rank institutions by composite rating.
- Show component breakdowns and flag institutions with concerning scores.

## Detect Risk Signals

```text
Scan active banks in North Carolina with under $500 million in assets for risk signals. Show critical and warning flags only.
```

What a good answer should do:

- Screen the matched institutions for early warning indicators.
- Categorize signals by severity (critical, warning).
- Rank flagged institutions by severity count.

## Analyze Credit Concentration

```text
Analyze the credit concentration for CERT 3511 as of December 31, 2024.
```

What a good answer should do:

- Show loan portfolio composition by type (CRE, C&I, consumer, residential RE, agricultural).
- Compute CRE and construction concentrations relative to capital.
- Flag any concentrations exceeding interagency guidance thresholds (300% CRE-to-capital, 100% construction-to-capital).

## Analyze Funding Profile

```text
Analyze the funding profile for CERT 628 at the latest available quarter.
```

What a good answer should do:

- Show deposit composition: core, brokered, and foreign deposits.
- Compute wholesale funding reliance and FHLB advances as a percentage of assets.
- Flag funding risks: high brokered deposits, low core deposits, high wholesale funding.

## Run UBPR-Equivalent Analysis

```text
Run a UBPR-equivalent ratio analysis for CERT 29846 as of December 31, 2024.
```

What a good answer should do:

- Show summary ratios (ROA, ROE, NIM, efficiency, pretax ROA).
- Show loan mix, capital adequacy, and liquidity metrics.
- Include year-over-year growth rates for assets, loans, and deposits.
- Note that ratios are UBPR-equivalent, not official FFIEC UBPR output.

## Analyze Deposit Market Share

`fdic_market_share_analysis` requires either a numeric MSABR code (`msa`) or a city name and state (`city` + `state`). To find an MSABR code, use `fdic_search_sod` and filter by institution or state to retrieve the `MSABR` field.

Prompt (MSA by code):

```text
Show the deposit market share for MSABR 19100 (Dallas-Fort Worth-Arlington).
```

Prompt (city market):

```text
Show the deposit market share for banks in Austin, TX.
```

What a good answer should do:

- List the top institutions by deposit share in the specified market.
- Show total market deposits and HHI with concentration classification.

## Map Franchise Footprint

```text
Map the franchise footprint for CERT 628.
```

What a good answer should do:

- Show all markets where the institution has branches, grouped by MSA, with deposit totals and branch counts per market.
- Sort by deposit size descending.
- Summarize total branches and deposits across all markets.

## Profile Holding Company

```text
Profile the holding company for CERT 3511.
```

What a good answer should do:

- Identify the holding company and list all FDIC-insured subsidiaries.
- Show aggregated metrics: total assets, deposits, asset-weighted ROA and equity ratio.

## Regional Economic Context

```text
What is the regional economic context for banks in California?
```

What a good answer should do:

- Show state unemployment rate and trend.
- Compare to the national rate.
- Classify the interest rate environment.
- Summarize how economic conditions may affect bank performance.

## Multi-Tool Analysis Prompts

These prompts chain multiple tools for deeper analysis. They work best when the model can make several tool calls in sequence.

### Snapshot with profitability follow-through

```text
Compare active North Carolina banks between December 31, 2021 and June 30, 2025. Rank by deposit growth percentage, return the top 10, and call out which also improved ROA and reduced office counts.
```

### Health deep-dive with peer context

```text
Run a health assessment for CERT 3511 as of December 31, 2024 using 8 quarters of trend history. Then compare its health scores against peer banks in the same state and asset range.
```

### Risk screening with follow-through

```text
Scan all active banks in Wyoming for risk signals. For any bank with critical signals, also run a full health assessment and explain what is driving the concern.
```

### Failure analysis (manual multi-tool approach)

```text
Which bank failures since 2008 had the highest estimated losses? For the top 3, show their quarterly financials from the year before they failed and identify which risk signals were present.
```

For a more structured failure analysis workflow, use the [Failure Forensics]({{ '/skills/failure-forensics/' | relative_url }}) skill in Claude Code.

## Prompting Tips

- **Be explicit about dates**: State the quarter-end date (e.g., `December 31, 2024` or `20241231`) rather than "latest" when precision matters.
- **Name your ranking metric**: "Find the best banks" is too vague. Say "rank by ROA" or "sort by deposit growth."
- **Scope your universe**: "Compare all banks" may exceed API limits. Add a state, asset range, or CERT list.
- **Don't mix cadences unintentionally**: Quarterly financials and annual SOD data have different date bases. Be explicit if you need both.
- **Ask follow-up questions**: After a comparison, ask "Which of those also improved profitability?" or "Run a health assessment for the lowest-ranked bank."

For more on prompt structure and date rules, see the [Prompting Guide]({{ '/prompting-guide/' | relative_url }}).
