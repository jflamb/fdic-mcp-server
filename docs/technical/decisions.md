---
title: Key Decisions
nav_group: technical
kicker: Technical Docs
summary: The main design decisions that shape tool contracts, centralized FDIC access, and the published documentation strategy.
breadcrumbs:
  - title: Overview
    url: /
  - title: Technical Docs
    url: /technical/
---

## Decision 1: Use MCP Tool Contracts With Dual Output Shapes

Rationale:

- MCP hosts benefit from concise summaries for humans and structured payloads for follow-on automation.
- Preserving both `content` and `structuredContent` keeps the server useful across clients with different capabilities.

## Decision 2: Keep FDIC API Access Centralized

Rationale:

- `src/services/fdicClient.ts` owns request construction, pagination, and normalization.
- This reduces duplicated FDIC-specific behavior across tools and makes error handling more consistent.

## Decision 3: Include Server-Side Analysis Helpers

Rationale:

- Complex prompts often require many FDIC calls and intermediate joins.
- `fdic_compare_bank_snapshots` and `fdic_peer_group_analysis` reduce client orchestration overhead and improve prompt reliability.

## Decision 4: Preserve FDIC Time Bases Explicitly

Rationale:

- Quarterly financial data and annual SOD data answer different questions.
- Clear documentation and explicit parameter naming reduce analysis mistakes caused by mixing incompatible time bases.

## Decision 5: Publish End-User And Maintainer Docs Together

Rationale:

- Users need setup, prompting, and examples.
- Maintainers need architecture and decision records.
- A single `docs/` site keeps those materials versioned with the codebase and available through GitHub Pages.
