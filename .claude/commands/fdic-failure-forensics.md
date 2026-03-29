---
name: fdic-failure-forensics
description: >
  Retrospective failure-forensics workflow for a single FDIC-insured institution.
  Reconstructs the pre-failure financial timeline from public FDIC data, identifies
  the earliest visible warning signals, and explains likely drivers of deterioration.
  Use when the user asks to analyze a bank failure, reconstruct what happened before
  a bank failed, review a failed institution for training or pattern recognition,
  or perform a post-mortem on a specific FDIC failure event.
# NOTE: The MCP tool ID prefix (UUID) is session-specific and must be
# verified at runtime. The tools below follow the pattern:
# mcp__<server-uuid>__<tool_name>
allowed_tools: [
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_search_institutions",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_get_institution_failure",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_search_financials",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_detect_risk_signals",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_bank_health",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_search_history",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_funding_profile",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_analyze_credit_concentration",
  "mcp__5eab1597-730a-4070-ac1b-563968b18d28__fdic_regional_context"
]
---

Follow the skill instructions in `.agents/skills/fdic-failure-forensics/SKILL.md` exactly.

$ARGUMENTS
