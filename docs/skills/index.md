---
title: Plugin Skills
nav_group: skills
kicker: Skills
summary: Guided analyst workflows that chain multiple MCP tools into structured reports through plugin-aware coding agents.
breadcrumbs:
  - title: Overview
    url: /
---

Skills are guided analyst workflows that run inside plugin-aware coding agents such as Codex and Claude Code. Each skill chains multiple MCP tools into a structured, multi-section report with consistent formatting and built-in caveats.

**Skills are not MCP tools, and they are not Claude-only.** MCP tools work in any MCP client (Codex, Claude Desktop, ChatGPT, Gemini CLI, and others). Skills orchestrate those tools through a host-specific plugin interface, and the exact skill list depends on the plugin you install. If your client does not support these skills, use the [MCP tools directly]({{ '/tool-reference/' | relative_url }}) or see [Choose a Workflow]({{ '/choose-a-workflow/' | relative_url }}) for guidance.

## Available Skills

<div class="card-grid">
  <a class="card" href="{{ '/skills/bank-deep-dive/' | relative_url }}">
    <span class="card__eyebrow">Single Institution</span>
    <h3>Bank Deep Dive</h3>
    <p>Comprehensive ten-section report for one active or inactive institution. Chains nine tools covering health, financials, peers, credit, funding, securities, franchise, and economic context.</p>
  </a>
  <a class="card" href="{{ '/skills/examiner-support/' | relative_url }}">
    <span class="card__eyebrow">Examiner Overlay</span>
    <h3>FDIC Examiner Support</h3>
    <p>Layer qualitative examiner knowledge onto a public CAMELS proxy baseline. Collects structured inputs, computes bounded adjustments, and produces a blended assessment with provenance separation.</p>
  </a>
  <a class="card" href="{{ '/skills/portfolio-surveillance/' | relative_url }}">
    <span class="card__eyebrow">Portfolio</span>
    <h3>Portfolio Surveillance</h3>
    <p>Screen a universe of institutions by state, asset range, or CERT list. Produces a ranked watchlist with Escalate, Monitor, and No Immediate Concern tiers.</p>
  </a>
  <a class="card" href="{{ '/skills/failure-forensics/' | relative_url }}">
    <span class="card__eyebrow">Failed Bank</span>
    <h3>Failure Forensics</h3>
    <p>Reconstruct the pre-failure timeline for a failed institution. Identifies earliest visible warning signals and explains likely drivers of deterioration.</p>
  </a>
</div>

## Skills vs MCP Tools

| | MCP Tools | Plugin Skills |
|---|---|---|
| **Works in** | Any MCP client | Plugin-aware coding agents such as Codex or Claude Code |
| **Invoked by** | Natural-language prompts | Skill activation or slash commands, depending on host |
| **Output** | Single tool response | Multi-section structured report |
| **Scope** | One dataset or analysis at a time | Chains multiple tools with graceful degradation |
| **Stability** | Stable tool contracts | Evolving conversational workflows |
| **Setup** | MCP server connection | Plugin install (MCP server + skills) |

## Installing Skills

Install skills through a plugin-aware coding agent. The Codex and Claude Code plugins both package MCP tools with guided workflows, but they do not expose an identical skill list.

Claude Code plugin install:

```text
/plugin marketplace add jflamb/fdic-mcp-server
/plugin install fdic-mcp-server@fdic-mcp-server
```

Codex local plugin setup:

```bash
npm run plugin:sync
```

See [Plugin Installation]({{ '/plugin-installation/' | relative_url }}) for exact setup steps. Manual MCP server setup without a plugin gives you MCP tools only, not skills.

## Data Basis and Limitations

All skills derive their analysis from public FDIC BankFind data:

- **Quarterly data** (Call Reports): financials, demographics, health assessments. Identified by `REPDTE` in `YYYYMMDD` format (quarter-end dates: `0331`, `0630`, `0930`, `1231`).
- **Annual data** (Summary of Deposits): branch-level deposits as of June 30 each year.
- **Dollar amounts** are in thousands unless otherwise noted.
- **Publication lag**: FDIC data is typically available approximately 90 days after the quarter-end reporting date.

Skills produce analytical assessments based on public data. They are **not** official regulatory CAMELS ratings, confidential supervisory conclusions, or investment advice. Skills cannot observe liquidity runs, off-balance-sheet exposures, market sentiment, or confidential supervisory findings.

Each skill report includes a caveats section that states the data date basis, identifies gaps, and distinguishes observed findings from inferred conclusions.
