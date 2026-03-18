# Key Decisions

Repository reference for the design choices that shape tool contracts, centralized FDIC access, and the documentation split between the public site and repo docs.

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

## Decision 5: Split Public User Docs From Repo Reference Docs

Rationale:

- Users need setup, prompting, examples, and troubleshooting without maintainer-focused distractions.
- Maintainers still need versioned architecture notes, decision records, deployment context, and plans close to the code.
- Keeping user docs in `docs/` and maintainer docs in `reference/` preserves versioning while simplifying the public Pages site.
