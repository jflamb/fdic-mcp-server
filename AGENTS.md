# AGENTS.md

Canonical repository instructions for LLM agents working in this repo. Keep repo-specific guidance here and use thin pointer files for agent-specific entrypoints.

## Purpose

This repository implements an MCP server for the FDIC BankFind Suite API. The codebase wraps FDIC datasets as MCP tools and includes server-side analysis helpers for multi-bank comparisons.

Primary references:
- [README.md](/Users/jlamb/Projects/bankfind-mcp/README.md)
- [docs/clients.md](/Users/jlamb/Projects/bankfind-mcp/docs/clients.md)

## Core Commands

Install dependencies:

```bash
npm install
```

Validate changes:

```bash
npm run typecheck
npm test
npm run build
```

Run locally over stdio:

```bash
node dist/index.js
```

Run locally over HTTP:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

## Working Norms

- Prefer using the MCP server tool implementations in `src/tools` rather than bypassing them with ad hoc FDIC API logic when validating server behavior.
- Preserve tool contracts. Changes to tool names, argument shapes, `content`, or `structuredContent` should be treated as breaking unless intentionally coordinated.
- Keep changes small and explicit. Add or update tests whenever tool behavior, output structure, filtering, ranking, or error handling changes.
- Do not add secrets or API keys. The FDIC BankFind API is public and this server should work without credentials.
- Prefer the simplest change that solves the real problem. Avoid speculative refactors and temporary fixes.
- Find root causes. Do not stop at symptom treatment if the underlying defect is identifiable.

## Workflow Orchestration

- Enter plan mode for non-trivial tasks, especially work with multiple implementation steps, verification steps, or architectural choices.
- If execution goes sideways, stop and re-plan instead of pushing through a weak plan.
- For non-trivial work, write a detailed spec up front to reduce ambiguity before editing.
- Use parallel exploration where tooling allows it to keep the main execution path focused.
- For larger problems, break work into focused tracks rather than mixing research, implementation, and verification in one pass.

## Change Management

- Treat `main` as protected. Do not develop directly on `main` for substantive work.
- Create a clearly named branch scoped to the work before making non-trivial changes.
- Open or reference an issue before implementation. The issue should describe the work, acceptance criteria, and any supporting context needed to execute cleanly.
- Use sub-tasks when the work naturally splits into distinct deliverables or validation tracks.
- Commit in logical chunks with clear, concise commit messages.
- When the work is ready for review, open a pull request that explains what changed, why it changed, how it was validated, and any follow-up risk or context.
- If validation passes, merge the PR and clean up local and remote working branches.
- If validation fails, investigate the root cause, fix it, and iterate until checks pass.

## Task Management

- Use `tasks/todo.md` for non-trivial tasks. If the `tasks/` directory does not exist yet, create it when the task justifies explicit tracking.
- Write plans as checkable items.
- Update progress as work advances.
- Add a short review/results section before closing the task.
- After any user correction, update `tasks/lessons.md`. If it does not exist yet, create it at that point.

## Self-Improvement Loop

- After any user correction, capture the mistake pattern in `tasks/lessons.md`.
- Write the lesson as a prevention rule that can be applied on future tasks.
- Revisit relevant lessons at the start of later tasks in this repo when applicable.

## Verification Before Done

- Do not mark work complete without evidence.
- Run tests, compare behavior, inspect logs, or otherwise demonstrate correctness as appropriate to the change.
- For behavior changes, verify both the intended path and likely regressions.
- Ask whether the result would meet a strong senior or staff-level review standard before presenting it as done.

## Demand Elegance

- For non-trivial changes, pause and ask whether there is a more elegant design with less complexity or better boundaries.
- Do not over-engineer simple fixes, but do replace hacky solutions when a cleaner approach is apparent and proportionate.

## Autonomous Bug Fixing

- When given a concrete bug report, move directly into diagnosis and repair.
- Use failing tests, logs, stack traces, and reproducible behavior as the path to root cause.
- Do not require unnecessary back-and-forth from the user when the issue can be investigated directly from the repo and runtime behavior.

## FDIC Data Notes

- FDIC financial and demographics data are quarterly and use `REPDTE` in `YYYYMMDD` format.
- FDIC summary data are annual and use `YEAR` rather than `REPDTE`.
- SOD data is annual branch-level data as of June 30. Use SOD for branch counts and branch deposit totals rather than quarterly financial fields.
- Do not casually mix quarterly financial snapshots with annual branch data without saying so. If both are used in an analysis, state the date basis clearly.
- FDIC amounts are generally reported in thousands of dollars. Preserve that convention unless a change explicitly converts units for presentation.
- The `CERT` field is the stable institution identifier used across datasets.

## File Guide

- `src/cli.ts`: CLI entrypoint that invokes `main()` and exits non-zero on startup failure
- `src/index.ts`: server construction, transport wiring, and HTTP app creation
- `src/constants.ts`: shared runtime constants such as API base URL, version, endpoints, and output limits
- `src/schemas/common.ts`: shared Zod query schemas reused across tool modules
- `src/tools/*.ts`: MCP tool definitions
- `src/services/fdicClient.ts`: FDIC API access, pagination, and error handling
- `tests/*.test.ts`: behavior and contract coverage
- `scripts/build.js`: build entrypoint that produces both `dist/index.js` and `dist/server.js`
- `dist/index.js`: executable CLI bundle built from `src/cli.ts`
- `dist/server.js`: reusable server bundle built from `src/index.ts`

## Testing Expectations

- For tool changes, prefer targeted tests in `tests/` that verify both human-readable output and `structuredContent` when relevant.
- For ranking or comparison logic, test exact metric behavior and edge cases around missing data, date ranges, and null handling.
- If you cannot run tests, say so explicitly.

## Multi-Agent Support

- `AGENTS.md` is the single source of truth for repository instructions.
- Agent-specific files such as `CLAUDE.md` should point here instead of duplicating rules.
