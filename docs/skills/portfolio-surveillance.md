---
title: "Portfolio Surveillance"
nav_group: skills
kicker: Skill
summary: A Claude Code skill that screens a universe of FDIC-insured institutions and produces a ranked watchlist with escalation tiers.
breadcrumbs:
  - title: Overview
    url: /
  - title: Skills
    url: /skills/
---

The `/fdic-portfolio-surveillance` command screens a defined universe of institutions, ranks them by emerging risk and relative health, and produces a decision-ready watchlist grouped into escalation tiers.

This is a **Claude Code skill**, not an MCP tool. It requires Claude Code with the plugin installed. If you are using another MCP client, you can approximate this workflow by combining `fdic_detect_risk_signals`, `fdic_compare_peer_health`, and `fdic_compare_bank_snapshots` in sequence — see [Choose a Workflow]({{ '/choose-a-workflow/' | relative_url }}).

## When to Use It

- You want to screen a group of banks (state, asset tier, or specific CERTs) for emerging concerns.
- You need a prioritized watchlist with explicit reasons for each escalation.
- You want follow-through analysis on the most concerning institutions without running separate deep-dive prompts.

## When Not to Use It

- **Analyzing a single institution**: Use [Bank Deep Dive]({{ '/skills/bank-deep-dive/' | relative_url }}) instead.
- **Reconstructing a failure**: Use [Failure Forensics]({{ '/skills/failure-forensics/' | relative_url }}) instead.
- **Quick risk scan without triage**: Use `fdic_detect_risk_signals` directly for a flat list of flagged institutions.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Universe definition | Yes | State code (e.g., `WY`), asset range (e.g., `$100M to $1B`), or explicit CERT list |
| Report date (`repdte`) | No | Quarter-end date in `YYYYMMDD` format. Defaults to latest available quarter. |
| Comparison start date | No | Defaults to one year prior to report date. |
| Ranking emphasis | No | `capital`, `earnings`, `funding`, `growth`, or `overall` (default) |
| Limit | No | Max institutions in the ranked output. Default 25. |

## Examples

```text
/fdic-portfolio-surveillance WY
```

```text
/fdic-portfolio-surveillance banks with assets between $100M and $1B
```

```text
/fdic-portfolio-surveillance CERTs 2232, 19184, 12591, 2208, 5442
```

```text
/fdic-portfolio-surveillance NC, emphasis on funding stress, limit 10
```

## What Output to Expect

A fixed-section report:

| Section | Contents |
|---------|----------|
| 1. Universe Definition | Scope, institution count, date parameters |
| 2. Screening Summary | Signal distribution, health score range, trend overview |
| 3. Ranked Watchlist | Three tiers with driver text for each institution |
| 4. Escalated Institution Follow-Through | Detailed health and domain analysis for top 3 escalated banks |
| 5. Caveats / Date Basis | Data staleness, peer set limitations, date basis transparency |

### Watchlist Tiers

| Tier | Criteria |
|------|----------|
| **Escalate** | Critical risk signals, weak health scores, persistent adverse trends |
| **Monitor** | Warning-level signals without critical issues, deteriorating but not yet critical |
| **No Immediate Concern** | Strong health, no signals, stable or improving trends |

Each placement includes explicit reason codes — never opaque scores.

## Key Caveats

- **Quarterly data basis**: Screening uses quarterly Call Report data. The report states the effective `REPDTE` and comparison window.
- **Dollar amounts**: FDIC financials are in thousands of dollars.
- **Publication lag**: Data is typically available ~90 days after quarter-end. The skill warns if the report date is more than 120 days old.
- **Peer set size**: If the universe produces fewer than 10 institutions, peer health comparisons are noted as limited.
- **Mixed date bases**: If the skill supplements quarterly data with annual SOD data, the date basis difference is stated explicitly.
- **Screening scope**: The skill focuses on screening and triage. It does not produce full narrative reports for every institution in the universe — only the top escalated banks receive detailed follow-through.
- **Proxy, not regulatory**: All health and risk assessments are public-data analytical proxies, not official supervisory ratings.

## Under the Hood

The skill orchestrates these MCP tools:

| Tool | Purpose |
|------|---------|
| `fdic_search_institutions` | Build the screening universe |
| `fdic_detect_risk_signals` | Surface critical and warning-level signals per institution |
| `fdic_compare_peer_health` | Rank institutions by proxy composite and component scores |
| `fdic_compare_bank_snapshots` | Confirm trends via two-point financial comparison |
| `fdic_analyze_bank_health` | Detailed assessment for escalated institutions |
| `fdic_analyze_funding_profile` | Funding composition for escalated institutions with funding signals |
| `fdic_analyze_credit_concentration` | Credit concentration for escalated institutions with credit signals |
| `fdic_ubpr_analysis` | UBPR-equivalent ratios for escalated institutions |
| `fdic_regional_context` | Macro/regional economic backdrop |

Hard-dependency tools (institution search, risk signals, peer health, snapshots) must succeed or the skill stops. Soft-dependency tools (regional context) degrade gracefully. Context tools (funding, credit, UBPR) are invoked only for escalated institutions when signals implicate those domains.
