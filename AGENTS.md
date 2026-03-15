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

## FDIC Data Notes

- FDIC financial data is quarterly. Use `REPDTE` in `YYYYMMDD` format for financial, summary, and demographics queries.
- SOD data is annual branch-level data as of June 30. Use SOD for branch counts and branch deposit totals rather than quarterly financial fields.
- Do not casually mix quarterly financial snapshots with annual branch data without saying so. If both are used in an analysis, state the date basis clearly.
- FDIC amounts are generally reported in thousands of dollars. Preserve that convention unless a change explicitly converts units for presentation.
- The `CERT` field is the stable institution identifier used across datasets.

## File Guide

- `src/index.ts`: server construction and transport wiring
- `src/tools/*.ts`: MCP tool definitions
- `src/services/fdicClient.ts`: FDIC API access, pagination, and error handling
- `tests/*.test.ts`: behavior and contract coverage
- `scripts/build.js`: build entrypoint

## Testing Expectations

- For tool changes, prefer targeted tests in `tests/` that verify both human-readable output and `structuredContent` when relevant.
- For ranking or comparison logic, test exact metric behavior and edge cases around missing data, date ranges, and null handling.
- If you cannot run tests, say so explicitly.

## Multi-Agent Support

- `AGENTS.md` is the single source of truth for repository instructions.
- Agent-specific files such as `CLAUDE.md` should point here instead of duplicating rules.
