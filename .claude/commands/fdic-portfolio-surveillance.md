---
name: fdic-portfolio-surveillance
description: >
  Comprehensive portfolio-level FDIC surveillance workflow. Screens a defined
  universe of institutions (state, asset range, or CERT list), ranks them by
  emerging risk and relative health, and produces a decision-ready watchlist
  grouped into Escalate, Monitor, and No Immediate Concern tiers. Use when
  the user asks to "screen banks," "build a watchlist," "triage a portfolio,"
  "rank institutions by risk," or needs surveillance across a cohort.
# NOTE: The MCP tool ID prefix (UUID) is session-specific and must be
# verified at runtime. The tools below follow the pattern:
# mcp__<server-uuid>__<tool_name>
allowed_tools: [
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_search_institutions",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_detect_risk_signals",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_compare_peer_health",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_compare_bank_snapshots",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_bank_health",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_funding_profile",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_credit_concentration",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_ubpr_analysis",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_regional_context"
]
---

Follow the skill instructions in `.agents/skills/fdic-portfolio-surveillance/SKILL.md` exactly.

$ARGUMENTS
