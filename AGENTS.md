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
- Prompt macros for label-driven orchestration:
  - If the user says `/issue-batch <label>` or `issue-batch <label>`, treat that as an instruction to run `npm run issues:batch -- --label <label>`, review the generated batches, and use the brief as the planning input for the next implementation steps.
  - If the user says `/issue-batch-run <label>` or `issue-batch-run <label>`, first run `npm run issues:batch -- --label <label>`, then execute the recommended batches one at a time using the document agent working norms in this file. That means restating acceptance criteria, refreshing from `main`, creating a dedicated branch per coherent batch, updating `tasks/todo.md` for non-trivial work, implementing root-cause fixes with tests, validating, opening a PR, watching checks, merging when green, and only then moving to the next batch unless the user explicitly asks to pause.

## Standard Operating Procedure

Follow this sequence for substantive repo work unless the user explicitly asks for a narrower slice:

1. Review the issue, bug report, or request and restate the acceptance criteria before editing.
2. Check the current repo state, refresh from `main` as needed, and avoid building new work on a stale base.
3. Create a focused branch from updated `main`. Keep one branch and one PR scoped to one coherent change set.
4. For non-trivial work, add or update `tasks/todo.md` with goals, acceptance criteria, validation steps, and a review/results section.
5. Inspect the existing implementation and tests before deciding on the fix. Prefer root-cause changes over symptom patches.
6. Implement in small, reviewable steps. Preserve MCP tool contracts unless a breaking change is intentional and coordinated.
7. Add or update tests in the same change set whenever behavior, ranking, output shape, filtering, error handling, or release-critical workflow behavior changes.
8. Run the required validation commands before declaring the work ready. At minimum, use the repo-standard commands unless the change clearly justifies a narrower targeted suite.
9. Commit in logical chunks with conventional commit messages that match the release impact.
10. Open a PR that links the issue, explains what changed and why, lists exact validation commands, and calls out release impact or residual risk when relevant.
11. Watch the PR checks to completion. If any required check fails, investigate the root cause, push the fix to the same branch, and re-run the workflow until the PR is green.
12. Merge only after checks pass, then clean up local and remote branches.
13. Do not treat local edits, a local commit, or an open PR by itself as completion. For substantive work, the workflow is complete only after the validated PR is merged.

## Change Management

- Treat `main` as protected. Do not develop directly on `main` for substantive work.
- Create a clearly named branch scoped to the work before making non-trivial changes.
- Open or reference an issue before implementation. The issue should describe the work, acceptance criteria, and any supporting context needed to execute cleanly.
- Use sub-tasks when the work naturally splits into distinct deliverables or validation tracks.
- Commit in logical chunks with clear, concise commit messages.
- Use conventional commit messages for any commit that may land on `main`, because release automation derives versions from commit semantics. Use `fix:` for patch-level behavior fixes, `feat:` for new user-facing capability, and `!` or `BREAKING CHANGE:` for breaking changes. Do not hide behavior changes under `docs:` or `chore:` just to avoid a release bump.
- Write commit subjects that describe the user-facing change, not the implementation detail. "feat: add peer group benchmarking tool" is better than "feat: add new tool." "fix: correct deposit ranking for tied institutions" is better than "fix: update sort logic."
- Include a commit body when the subject alone is ambiguous or when the change has non-obvious implications. The body should explain why the change was made, not repeat what the diff shows.
- These norms matter because semantic-release derives the published changelog from commit messages. Better commits produce better release notes without manual curation.
- Ensure the final commit message that reaches `main` remains conventional. If the repo uses squash merges, make the PR title conventional as well so the squashed mainline commit keeps the correct release signal.
- Do not manually bump `package.json` versions or create release tags by hand. `semantic-release` owns version calculation, tagging, GitHub Release publication, and downstream publishing.
- When the work is ready for review, open a pull request that explains what changed, why it changed, how it was validated, and any follow-up risk or context.
- After opening the PR, monitor the required checks rather than assuming they passed. If validation fails, investigate the root cause, fix it on the same branch, and iterate until checks pass.
- If validation passes, merge the PR and clean up local and remote working branches.
- For substantive work, do not stop after opening a PR. The expected endpoint is a merged PR unless the user explicitly asks to pause earlier.

## Task Management

- Use `tasks/todo.md` for non-trivial tasks. If the `tasks/` directory does not exist yet, create it when the task justifies explicit tracking.
- Write plans as checkable items.
- Update progress as work advances.
- Add a short review/results section before closing the task.
- After any user correction, update `tasks/lessons.md`. If it does not exist yet, create it at that point.
- For label-driven maintenance passes, use `npm run issues:batch -- --label <label>` to generate grouped issue batches before starting implementation. Review the proposed batches before treating them as execution scope.
- In prompt-driven orchestration, the shorthand `/issue-batch <label>` is the preferred way to invoke that batching step.
- In prompt-driven orchestration, use `/issue-batch-run <label>` when the user wants the agent to carry the work through batch execution rather than stop after planning.

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

## Extension System

The extension system uses three canonical kinds. New extension work must choose one:

| Kind | Use when... | Location |
|---|---|---|
| `persona` | Defining behavioral rules, output style, or reasoning constraints | `extensions/personas/<id>/persona.json` |
| `tool` | Exposing a group of MCP tools as a reusable integration bundle | `extensions/tools/<id>/tool.json` |
| `workflow` | Describing a multi-step procedure that composes personas and tools | `extensions/workflows/<id>/workflow.json` |

Rules:
- `extensions/personas/`, `extensions/tools/`, `extensions/workflows/` are canonical. Edit here.
- `extensions/capabilities/` is transitional/legacy. Do not add new entries there.
- `adapters/` is generated. Do not hand-edit. Run `npm run extensions:build` to regenerate.
- `.agents/skills/*/SKILL.md` may be generated. Check for a generated-file banner before editing.
- Shared FDIC data rules live in `extensions/shared/` — reference them, do not duplicate.
- Validate with `npm run extensions:validate` before opening a PR.
- See [reference/extension-system.md](reference/extension-system.md) for the full design and migration guide.

## Multi-Agent Support

- `AGENTS.md` is the single source of truth for repository instructions.
- Agent-specific files such as `CLAUDE.md` should point here instead of duplicating rules.
