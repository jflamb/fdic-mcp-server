---
title: "Failure Forensics"
nav_group: skills
kicker: Skill
summary: A Claude Code skill that reconstructs the pre-failure timeline for a failed institution and identifies public-data warning signals.
breadcrumbs:
  - title: Overview
    url: /
  - title: Skills
    url: /skills/
---

The `/fdic-failure-forensics` command reconstructs the pre-failure financial timeline for a single failed FDIC-insured institution, identifies the earliest visible warning signals from public data, and explains likely drivers of deterioration.

This is a **Claude Code skill**, not an MCP tool. It requires Claude Code with the plugin installed. If you are using another MCP client, you can approximate this workflow by combining `fdic_get_institution_failure`, `fdic_search_financials`, `fdic_detect_risk_signals`, and `fdic_analyze_bank_health` in sequence — see [Choose a Workflow]({{ '/choose-a-workflow/' | relative_url }}).

## When to Use It

- You want to study a specific bank failure for training, pattern recognition, or case-study purposes.
- You need to understand what public data showed in the quarters leading up to a failure.
- You want to identify which risk signals appeared earliest and trace the deterioration path.

## When Not to Use It

- **The institution is still active**: Use [Bank Deep Dive]({{ '/skills/bank-deep-dive/' | relative_url }}) instead. Failure Forensics requires a confirmed failure record.
- **Screening a portfolio for current risks**: Use [Portfolio Surveillance]({{ '/skills/portfolio-surveillance/' | relative_url }}) instead.
- **Quick failure lookup**: If you only need the failure date, cost, and resolution type, use `fdic_get_institution_failure` directly.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Institution identity | Yes | Failed bank name or FDIC CERT number |
| Pre-failure report date | No | Defaults to the last quarter-end before the failure date |
| Lookback window | No | Number of quarters to analyze. Default 8. |
| Focus area | No | `funding`, `credit`, `earnings`, or `overall` (default). Determines which domain-specific tools are invoked. |

## Examples

```text
/fdic-failure-forensics Silicon Valley Bank
```

```text
/fdic-failure-forensics 24735
```

```text
/fdic-failure-forensics First Republic Bank, lookback 12 quarters, focus on funding
```

```text
/fdic-failure-forensics Heartland Tri-State Bank, lookback 8 quarters
```

## What Output to Expect

A structured report with core sections that are always present and enrichment sections included when the data warrants them:

| Section | Always Present | Contents |
|---------|:-:|----------|
| 1. Institution Identification | Yes | Name, CERT, location, charter class, regulator |
| 2. Failure Event Summary | Yes | Failure date, resolution type, estimated DIF cost, acquiring institution |
| 3. Pre-Failure Financial Timeline | Yes | Quarter-by-quarter Call Report data over the lookback window |
| 4. Earliest Warning Signals | Yes | Risk signals from the last reported quarter, with first-appearance timing |
| 5. Likely Failure Drivers | Yes | Analytical narrative with every statement tagged as **[Observed]**, **[Inferred]**, or **[Unknown]** |
| 6. Domain Analysis | When relevant | Funding profile or credit concentration, invoked only when deterioration implicates that domain |
| 7. Regional Context | When available | State unemployment, rate environment, economic backdrop during the pre-failure period |
| 8. Caveats / Limits of Public Data | Yes | Data gaps, temporal lag between last report and failure, what public data cannot observe |

### Provenance Tags

The Likely Failure Drivers section tags every analytical statement:

- **[Observed]**: Directly visible in public FDIC data (e.g., declining capital ratios, rising noncurrent loans)
- **[Inferred]**: Reasonable conclusion drawn from observed patterns (e.g., likely funding pressure based on deposit outflows and rising brokered deposits)
- **[Unknown]**: Cannot be determined from public data (e.g., liquidity run timing, off-balance-sheet exposures, confidential supervisory actions)

## Key Caveats

- **Failed institutions only**: The skill requires a confirmed FDIC failure record. It will not run for active institutions.
- **Temporal gap**: There is always a gap between the last quarterly Call Report and the actual failure date. Events in that gap (bank runs, emergency actions) are not captured in the financial timeline.
- **Quarterly data basis**: The financial timeline uses quarterly Call Report data (`REPDTE`). Dollar amounts are in thousands.
- **Publication lag**: Some data may have been published after the failure, but it reflects the institution's reported position at quarter-end.
- **Not a complete post-mortem**: Public data cannot capture liquidity runs, off-balance-sheet exposures, market sentiment, fraud, or confidential supervisory findings. The caveats section makes these limitations explicit.
- **Proxy, not regulatory**: Health and risk assessments are public-data analytical proxies.

## Under the Hood

The skill orchestrates these MCP tools:

| Tool | Purpose |
|------|---------|
| `fdic_search_institutions` | Resolve institution identity and confirm CERT |
| `fdic_get_institution_failure` | Retrieve failure record (date, resolution type, cost, acquirer) |
| `fdic_search_financials` | Build quarter-by-quarter pre-failure financial timeline |
| `fdic_detect_risk_signals` | Surface risk signals visible at the last reported quarter |
| `fdic_analyze_bank_health` | CAMELS-proxy assessment for the last reported quarter |
| `fdic_search_history` | Structural events (mergers, charter changes) in the lookback window |
| `fdic_analyze_funding_profile` | Funding composition when deterioration implicates funding stress |
| `fdic_analyze_credit_concentration` | Credit concentration when deterioration implicates credit risk |
| `fdic_regional_context` | Macro/regional economic backdrop during the pre-failure period |

Hard-dependency tools (institution search, failure record, financials, risk signals) must succeed or the skill stops. Soft-dependency tools (health assessment, structural history, regional context) degrade gracefully. Context tools (funding profile, credit concentration) are invoked only when the deterioration pattern implicates those domains.
