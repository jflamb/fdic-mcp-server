---
title: Prompting
nav_group: prompting
kicker: Use It Well
summary: Write effective prompts for FDIC data queries, and find guided analyst workflows for common tasks.
breadcrumbs:
  - title: Overview
    url: /
---

This section covers how to get the most from the FDIC BankFind MCP tools — prompt patterns, copyable examples, tool selection, and guided Claude Code skills.

<div class="card-grid">
  <a class="card" href="{{ '/choose-a-workflow/' | relative_url }}">
    <span class="card__eyebrow">Start Here</span>
    <h3>Choose a Workflow</h3>
    <p>Decide whether you need an MCP tool or a Claude Code skill based on what you're analyzing and which client you're using.</p>
  </a>
  <a class="card" href="{{ '/prompting-guide/' | relative_url }}">
    <span class="card__eyebrow">Patterns</span>
    <h3>Prompting Guide</h3>
    <p>Prompt patterns for dates, metrics, comparisons, and multi-tool analysis chains.</p>
  </a>
  <a class="card" href="{{ '/usage-examples/' | relative_url }}">
    <span class="card__eyebrow">Examples</span>
    <h3>Usage Examples</h3>
    <p>Copyable prompts and expected answer shapes for search, comparisons, health analysis, and more.</p>
  </a>
  <a class="card" href="{{ '/tool-reference/' | relative_url }}">
    <span class="card__eyebrow">Reference</span>
    <h3>Tool Reference</h3>
    <p>Quick reference for all 20+ MCP tools — what each does and when to use it.</p>
  </a>
  <a class="card" href="{{ '/skills/' | relative_url }}">
    <span class="card__eyebrow">Claude Code</span>
    <h3>Skills</h3>
    <p>Guided analyst workflows that chain multiple tools into structured reports. Bank Deep Dive, Examiner Support, Portfolio Surveillance, and Failure Forensics. Claude Code only.</p>
  </a>
</div>

## MCP Tools vs Claude Code Skills

| | MCP Tools | Claude Code Skills |
|---|---|---|
| **Works in** | Any MCP client | Claude Code only |
| **Invoked by** | Natural-language prompts | Slash commands |
| **Scope** | One dataset or analysis at a time | Multi-tool structured reports |
| **Stability** | Stable tool contracts | Evolving conversational workflows |

MCP tools are the foundation. Skills build on top of them. If you're not sure which to use, start with [Choose a Workflow]({{ '/choose-a-workflow/' | relative_url }}).

<section class="doc-callout doc-callout--hero">
  <p class="doc-callout__eyebrow">Try It</p>
  <h2>Test prompts from the docs</h2>
  <p>
    Use the floating chat button in the lower-right corner or press <code>?</code> to open the hosted demo assistant without leaving this page.
  </p>
  <p>
    <button type="button" class="chatbot-inline-open" data-chatbot-open>Open The Chat Launcher</button>
  </p>
</section>
