---
title: "Bank Deep Dive"
nav_group: skills
kicker: Skill
summary: A Claude Code skill that chains nine MCP tools into a comprehensive ten-section report for a single FDIC-insured institution.
breadcrumbs:
  - title: Overview
    url: /
  - title: Skills
    url: /skills/
---

The `/fdic-bank-deep-dive` command produces a comprehensive single-institution report by chaining nine MCP tools into ten structured sections. It works for both active and inactive (failed or merged) institutions.

This is a **Claude Code skill**, not an MCP tool. It requires Claude Code with the plugin installed. If you are using another MCP client, you can achieve similar results by prompting the individual MCP tools directly — see [Choose a Workflow]({{ '/choose-a-workflow/' | relative_url }}).

## When to Use It

- You want a full-picture assessment of one institution without constructing a multi-step prompt.
- You need a structured report covering health, financials, peers, credit, funding, securities, franchise, and economic context.
- You are analyzing an inactive institution and want the skill to automatically scope to the last reported quarter.

## When Not to Use It

- **Screening multiple banks**: Use [Portfolio Surveillance]({{ '/skills/portfolio-surveillance/' | relative_url }}) instead.
- **Reconstructing a failure timeline**: Use [Failure Forensics]({{ '/skills/failure-forensics/' | relative_url }}) instead.
- **Adding examiner knowledge**: Run the deep dive first, then use [Examiner Support]({{ '/skills/examiner-support/' | relative_url }}) to overlay qualitative inputs.
- **Quick single-tool lookup**: If you only need one piece of data (financials, health score, peer rank), prompt the relevant [MCP tool]({{ '/tool-reference/' | relative_url }}) directly.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Institution identity | Yes | Bank name or FDIC CERT number |
| Report date (`repdte`) | No | Quarter-end date in `YYYYMMDD` format. Defaults to the latest available quarter. For inactive institutions, defaults to the last reported quarter. |

## Examples

```text
/fdic-bank-deep-dive Coastal Community Bank
```

```text
/fdic-bank-deep-dive 34403
```

```text
/fdic-bank-deep-dive Signature Bank 20221231
```

## What Output to Expect

A ten-section narrative report:

| Section | Contents |
|---------|----------|
| 1. Institution Profile | Name, CERT, location, charter class, regulator, holding company, active status |
| 2. Health Assessment | CAMELS-proxy composite and component scores, overall band, PCA capital classification, management overlay, risk signals |
| 3. Financial Performance | Key ratios (ROA, ROE, NIM, efficiency), income and expense trends, quarter-over-quarter changes |
| 4. Peer Benchmarking | Rank against auto-derived peers on assets, ROA, efficiency, loan-to-deposit, and other metrics with percentiles |
| 5. Credit & Concentration | Loan portfolio composition, CRE and construction concentrations relative to capital, interagency guidance flags |
| 6. Funding & Liquidity | Core vs. brokered deposits, wholesale funding reliance, FHLB advances, cash ratio, funding risk signals |
| 7. Securities Portfolio | Securities-to-assets ratio, MBS concentration, securities-to-capital, interest rate exposure signals |
| 8. Geographic Franchise | Branch count and deposit distribution across MSAs from Summary of Deposits data |
| 9. Economic Context | State and national unemployment, federal funds rate, rate environment classification |
| 10. Summary | Key findings, strengths, concerns, and recommended follow-up areas |

If data for a section is unavailable, the skill narrates the gap rather than omitting the section.

At the end, the skill offers to save the report to a file.

## Key Caveats

- **Quarterly data basis**: Most sections use quarterly Call Report data identified by `REPDTE`. The franchise section uses annual Summary of Deposits data (as of June 30). The report states the date basis for each section.
- **Dollar amounts**: FDIC financials are in thousands of dollars unless otherwise noted.
- **Publication lag**: FDIC data becomes available approximately 90 days after the quarter-end date. The skill warns if the effective report date is more than 120 days old.
- **Inactive institutions**: The skill automatically detects inactive status and scopes the analysis to the institution's last reported quarter. SOD data may not be available for institutions that ceased reporting before the most recent June 30.
- **Proxy, not regulatory**: Health assessments are public-data analytical proxies, not official CAMELS ratings. Management (M) is inferred from patterns, not from examination findings. Sensitivity (S) uses proxy metrics (NIM trend, securities concentration).
- **Peer group size**: If fewer than 10 peers match the auto-derived criteria, the skill widens the asset band and notes the expanded peer set.

## Under the Hood

The skill orchestrates these MCP tools:

| Tool | Purpose |
|------|---------|
| `fdic_search_institutions` / `fdic_get_institution` | Resolve identity, confirm CERT, detect active status |
| `fdic_analyze_bank_health` | CAMELS-proxy health assessment with trend analysis |
| `fdic_ubpr_analysis` | UBPR-equivalent ratio report for financial performance |
| `fdic_peer_group_analysis` | Peer benchmarking with percentile rankings |
| `fdic_analyze_credit_concentration` | Loan portfolio and CRE concentration risk |
| `fdic_analyze_funding_profile` | Deposit composition and funding risk |
| `fdic_analyze_securities_portfolio` | Securities holdings and concentration |
| `fdic_franchise_footprint` | Branch network and deposit distribution by market |
| `fdic_regional_context` | Macro/regional economic backdrop |

Tools are categorized by dependency tier. Hard-dependency tools (institution lookup, health assessment) must succeed or the skill stops. Soft-dependency tools (peer benchmarking, regional context) degrade gracefully — the section notes the gap. Context tools (franchise, securities) are silently omitted if unavailable.
