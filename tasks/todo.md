# Hosted Onboarding And Registry Publication

Reference: issue #35 and user request to update the docs around the live hosted endpoint and automate publication to a public MCP registry.

## Goals

- [x] Verify that the hosted endpoint is live and suitable for onboarding docs.
- [x] Update end-user docs to prioritize the live hosted endpoint where appropriate.
- [x] Add official MCP Registry metadata to the repository.
- [x] Automate official MCP Registry publication from the release workflow.
- [x] Validate with `npm run typecheck`, `npm test`, and `npm run build`.

## Acceptance Criteria

- [x] Getting Started and client setup pages point to the hosted endpoint as the easiest path when remote URLs are supported.
- [x] The repo contains registry metadata for the hosted MCP server.
- [x] Release tags publish metadata to at least one public MCP registry.
- [x] The workflow uses the documented official MCP Registry OIDC path instead of long-lived registry secrets.
- [x] Validation commands pass after the repo changes.

## Review / Results

- [x] Verified the live custom-domain endpoint `https://bankfind.jflamb.com/mcp`.
- [x] Added `server.json` metadata plus release-time version synchronization for the official MCP Registry.
- [x] Updated onboarding docs to prefer the hosted endpoint and clarify that npm-install-by-prompt only applies to agentic environments with machine access.
- [x] Verified `npm run typecheck`, `npm test`, `npm run build`, and `npm run registry:sync`.

# Workflow Concurrency And Job Naming Cleanup

Reference: issue #41 and user request to continue with the next-tier workflow hygiene tasks after the workflow-name cleanup.

## Goals

- [x] Normalize concurrency-group naming across GitHub Actions workflows.
- [x] Standardize job display names for a cleaner Actions UI.
- [x] Clarify in the technical docs that the GitHub Package workflow is a backfill workflow, not a second primary release path.
- [ ] Open a PR for the resulting cleanup.

## Acceptance Criteria

- [x] All workflow concurrency groups follow one explicit naming pattern.
- [x] GitHub Actions jobs have intentional display names where that improves the UI.
- [x] The technical docs describe the role of the GitHub Package backfill workflow clearly.
- [x] Workflow behavior is unchanged apart from presentation and concurrency-key cleanup.

## Review / Results

- [x] Issue created and linked: #41.
- [x] Parsed all workflow YAML files successfully with Ruby `YAML.load_file`.

# Docs And Config Bug Batch

Reference: issues #44, #55, #56, and #57 and the follow-up bug triage work.

## Goals

- [x] Fix summary dataset date-basis references that incorrectly describe summary data as quarterly or `REPDTE`-based.
- [x] Fix the README license text to match the MIT `LICENSE` file.
- [x] Prevent `.envrc.example` from exporting an empty `GITHUB_TOKEN`.
- [x] Fix the Gemini CLI compatibility matrix entry to reflect documented remote HTTP support.

## Acceptance Criteria

- [x] Summary data is described as annual and `YEAR`-based across the affected docs and repo guidance.
- [x] The README license section matches the `LICENSE` file.
- [x] `.envrc.example` no longer overrides an existing `GITHUB_TOKEN` with an empty value.
- [x] The compatibility matrix matches the Gemini CLI client setup page.

## Review / Results

- [ ] Final verification and PR creation pending.

# Correctness Bug Batch

Reference: issue #62 and bugs #46, #53, and #59.

## Goals

- [x] Fix all-null asset series handling in timeseries analysis output.
- [x] Make `scripts/deploy-local.sh` fail immediately on shell command errors.
- [x] Validate `PORT` explicitly for HTTP startup and return a clearer configuration error.
- [x] Add or update tests for the code-path changes where practical.
- [ ] Open a PR for the resulting fixes.

## Acceptance Criteria

- [x] Timeseries analysis handles all-null asset series without producing `-Infinity`.
- [x] `scripts/deploy-local.sh` uses strict shell failure handling.
- [x] Invalid `PORT` values fail with a clear startup error message.
- [x] Relevant tests pass for the changed code paths.

## Review / Results

- [x] Issue created and linked: #62.
- [x] Verified `npm test -- tests/analysis.test.ts tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build`.
