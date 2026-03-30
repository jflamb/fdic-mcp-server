# FDIC Analysis MCP Tools — Usage Guide

## What This Bundle Provides

The `fdic-analysis-mcp` tool bundle exposes FDIC analytical and comparison tools built on top of the core data layer:

| Tool | Purpose |
|---|---|
| `fdic_analyze_bank_health` | CAMELS-proxy health assessment for a single institution |
| `fdic_compare_peer_health` | Side-by-side peer health comparison across a cohort |
| `fdic_detect_risk_signals` | Surface critical and warning-level risk signals |
| `fdic_compare_bank_snapshots` | Two-point financial comparison for trend analysis |
| `fdic_peer_group_analysis` | Peer group benchmarking |
| `fdic_analyze_credit_concentration` | Loan portfolio composition and CRE concentration |
| `fdic_analyze_funding_profile` | Deposit composition and wholesale funding analysis |
| `fdic_analyze_securities_portfolio` | Securities portfolio composition and rate risk |
| `fdic_ubpr_analysis` | UBPR-equivalent ratio analysis |
| `fdic_market_share_analysis` | Market share by MSA or state |
| `fdic_franchise_footprint` | Branch network footprint |
| `fdic_holding_company_profile` | Holding company structure and affiliates |
| `fdic_regional_context` | Macro/regional economic backdrop via FRED |

## Authentication

None required. All analysis is derived from public FDIC data.

## Transport

`stdio` — runs as a local MCP server process.

## Proxy Disclaimer

Health scores and component ratings from these tools are derived from the `public_camels_proxy_v1` analytical engine. They are not official CAMELS ratings and do not reflect confidential supervisory findings.

See `extensions/shared/policies/source-attribution.md` for full attribution requirements.
