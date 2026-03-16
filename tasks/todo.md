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
- [x] Open a PR for the resulting cleanup.

## Acceptance Criteria

- [x] All workflow concurrency groups follow one explicit naming pattern.
- [x] GitHub Actions jobs have intentional display names where that improves the UI.
- [x] The technical docs describe the role of the GitHub Package backfill workflow clearly.
- [x] Workflow behavior is unchanged apart from presentation and concurrency-key cleanup.

## Review / Results

- [x] Issue created and linked: #41.
- [x] Opened PR #42.
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

- [x] Opened PR #61.
- [x] Verified stale wording searches after the edits.

# Correctness Bug Batch

Reference: issue #62 and bugs #46, #53, and #59.

## Goals

- [x] Fix all-null asset series handling in timeseries analysis output.
- [x] Make `scripts/deploy-local.sh` fail immediately on shell command errors.
- [x] Validate `PORT` explicitly for HTTP startup and return a clearer configuration error.
- [x] Add or update tests for the code-path changes where practical.
- [x] Open a PR for the resulting fixes.

## Acceptance Criteria

- [x] Timeseries analysis handles all-null asset series without producing `-Infinity`.
- [x] `scripts/deploy-local.sh` uses strict shell failure handling.
- [x] Invalid `PORT` values fail with a clear startup error message.
- [x] Relevant tests pass for the changed code paths.

## Review / Results

- [x] Issue created and linked: #62.
- [x] Opened PR #63.
- [x] Verified `npm test -- tests/analysis.test.ts tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build`.

# Peer Group Ranking Semantics

Reference: issue #64 and bug #45.

## Goals

- [x] Make rank, denominator, and percentile use the same comparison set in peer-group output.
- [x] Update tests to reflect the chosen ranking contract.
- [x] Update user-facing wording where it currently implies different denominator semantics.
- [x] Open a PR for the resulting fix.

## Acceptance Criteria

- [x] `rank` and `of` describe the same comparison set.
- [x] Percentile remains in-range and matches the same comparison set.
- [x] Tests cover best, worst, tie, and small-peer-group scenarios under the updated semantics.

## Review / Results

- [x] Issue created and linked: #64.
- [x] Opened PR #65.
- [x] Verified `npm test -- tests/peerGroup.test.ts tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build`.

# FDIC Response Shape Hardening

Reference: issue #47.

## Goals

- [x] Validate the FDIC API response shape centrally in the client layer.
- [x] Replace low-level shape errors with explicit, actionable error messages.
- [x] Add tests for malformed FDIC response payloads.
- [x] Open a PR for the hardening change.

## Acceptance Criteria

- [x] Unexpected FDIC response shapes fail with clear errors.
- [x] Cached requests do not retain malformed-response failures.
- [x] Tests cover malformed top-level and malformed record-level response shapes.

## Review / Results

- [x] Opened PR #66.
- [x] Verified `npm test -- tests/fdicClient.test.ts`, `npm run typecheck`, and `npm run build`.

# CI-Gated Cloud Run Deployment

Reference: issue #52.

## Goals

- [x] Gate Cloud Run deployment on successful CI rather than raw pushes to `main`.
- [x] Prevent in-progress production deployments from being canceled by a newer push.
- [x] Update technical docs to describe the new deploy trigger correctly.
- [x] Open a PR for the workflow change.

## Acceptance Criteria

- [x] Cloud Run deploys only after the `CI` workflow completes successfully for `main`.
- [x] Production deploy concurrency no longer cancels an in-flight deployment.
- [x] Technical docs describe the CI-gated deploy behavior accurately.

## Review / Results

- [x] Opened PR #67.
- [x] Parsed `.github/workflows/deploy-cloud-run.yml` successfully with Ruby `YAML.load_file`.

# Non-Root Docker Runtime

Reference: issue #51.

## Goals

- [x] Run the production container as a non-root user.
- [x] Keep the current Cloud Run startup contract unchanged.
- [x] Document the runtime hardening in the Cloud Run technical docs.
- [x] Open a PR for the container hardening change.

## Acceptance Criteria

- [x] The final Docker image includes a non-root `USER`.
- [x] The application files remain readable and executable for the runtime user.
- [x] The container still starts with `TRANSPORT=http` and `PORT=8080`.
- [x] Technical docs mention the non-root runtime expectation.

## Review / Results

- [x] Used existing issue #51 for the tracked work.
- [x] Opened PR #68.
- [x] Verified `npm run build`.
- [x] Confirmed the final Dockerfile stage sets `USER fdicmcp` and copies runtime files with matching ownership.
- [x] Docker image build could not be run in this environment because `docker` is not installed.

# Tool Coverage Batch

Reference: issue #54.

## Goals

- [x] Add MCP HTTP coverage for the failures tool handlers.
- [x] Add MCP HTTP coverage for the history tool handler.
- [x] Add MCP HTTP coverage for the SOD tool handler.
- [x] Add MCP HTTP coverage for the annual summary tool handler.
- [x] Open a PR for the test coverage batch.

## Acceptance Criteria

- [x] The HTTP suite exercises the uncovered tool handlers with happy-path requests.
- [x] New tests verify structured output for each covered tool.
- [x] New tests verify the expected FDIC endpoint and composed query parameters.
- [x] Validation passes for the targeted test suite and repo type/build checks.

## Review / Results

- [x] Used existing issue #54 for the tracked work.
- [x] Opened PR #69.
- [x] Verified `npm test -- tests/mcp-http.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.

# AGENTS File Guide Cleanup

Reference: issue #60.

## Goals

- [x] Update the AGENTS file guide to include the CLI entrypoint and shared support modules.
- [x] Explain the built output split between the executable CLI bundle and the reusable server bundle.
- [x] Open a PR for the AGENTS documentation cleanup.

## Acceptance Criteria

- [x] `AGENTS.md` mentions `src/cli.ts`, `src/constants.ts`, and `src/schemas/common.ts`.
- [x] `AGENTS.md` explains the relationship between `dist/index.js` and `dist/server.js`.
- [x] The update matches the current build script and repository layout.

## Review / Results

- [x] Used existing issue #60 for the tracked work.
- [x] Opened PR #70.
- [x] Verified `npm run build`.

# FDIC Batch Truncation Warnings

Reference: issue #50.

## Goals

- [x] Warn when FDIC 10,000-record batch queries are truncated in snapshot analysis.
- [x] Warn when FDIC 10,000-record batch queries are truncated in time-series analysis.
- [x] Warn when FDIC 10,000-record batch queries are truncated in peer-group analysis.
- [x] Open a PR for the warning behavior.

## Acceptance Criteria

- [x] Analysis responses surface warnings when a financial or demographics batch returns fewer records than `meta.total`.
- [x] Peer-group responses surface warnings when a peer financial batch returns fewer records than `meta.total`.
- [x] HTTP tests cover at least one analysis and one peer-group truncation case.
- [x] Validation passes for the targeted tests plus type/build checks.

## Review / Results

- [x] Used existing issue #50 for the tracked work.
- [x] Opened PR #71.
- [x] Verified `npm test -- tests/mcp-http.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.

# FDIC Cache Bounds

Reference: issue #49.

## Goals

- [x] Prevent unbounded growth of the FDIC query cache during long-lived sessions.
- [x] Avoid full-map cache pruning on every request.
- [x] Add focused tests for cache eviction behavior.
- [x] Open a PR for the cache-bounding change.

## Acceptance Criteria

- [x] The FDIC query cache has a fixed maximum size.
- [x] Expired entries are removed without scanning the full map on every request.
- [x] Tests cover cache reuse, expiration, and cap-based eviction behavior.
- [x] Validation passes for targeted tests plus type/build checks.

## Review / Results

- [x] Used existing issue #49 for the tracked work.
- [x] Opened PR #72.
- [x] Verified `npm test -- tests/fdicClient.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.

# Shared Analysis Query Utilities

Reference: issue #48.

## Goals

- [x] Extract duplicated query and batching helpers from `analysis.ts` and `peerGroup.ts`.
- [x] Keep the refactor limited to the clearly shared mechanics.
- [x] Validate the affected analysis and peer-group behavior after the extraction.
- [x] Open a PR for the refactor.

## Acceptance Criteria

- [x] `asNumber`, `buildCertFilters`, `mapWithConcurrency`, and the shared batch constants live in one module.
- [x] `analysis.ts` and `peerGroup.ts` import those helpers instead of maintaining local copies.
- [x] Existing analysis and peer-group tests still pass without changing observable behavior.
- [x] Validation passes for targeted tests plus type/build checks.

## Review / Results

- [x] Used existing issue #48 for the tracked work.
- [x] Opened PR #73.
- [x] Left older local branches intact because they are not merged and still diverge from `main`.
- [x] Verified `npm test -- tests/analysis.test.ts tests/peerGroup.test.ts tests/mcp-http.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.

# Metrics And Task Cleanup

Reference: issue #74.

## Goals

- [x] Normalize stale completed checklist items in `tasks/todo.md`.
- [x] Extract the remaining reusable financial metric helpers from `peerGroup.ts`.
- [x] Validate the peer-group behavior after the extraction.
- [x] Open a PR for the cleanup/refactor work.

## Acceptance Criteria

- [x] Older completed sections in `tasks/todo.md` no longer show stale unchecked PR bookkeeping.
- [x] `DerivedMetrics`, `deriveMetrics`, and `computeMedian` live in a shared module.
- [x] `peerGroup.ts` imports the shared metric helpers instead of maintaining local copies.
- [x] Validation passes for targeted peer-group tests plus type/build checks.

## Review / Results

- [x] Used existing issue #74 for the tracked work.
- [x] Opened PR #75.
- [x] Verified `npm test -- tests/peerGroup.test.ts tests/mcp-http.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.
- [x] Bumped the package and registry metadata version to `1.1.1`.
- [x] Added matching GitHub and docs release notes for `1.1.1`.

# Registry Validation Recovery Release

Reference: issue #76.

## Goals

- [x] Shorten the MCP registry description to satisfy the schema validation limit.
- [x] Roll the release metadata forward from `1.1.1` to `1.1.2`.
- [x] Add matching release notes for `1.1.2`.
- [x] Open a PR for the recovery release preparation.

## Acceptance Criteria

- [x] `server.json.description` is 100 characters or fewer.
- [x] `package.json`, `package-lock.json`, and `server.json` all point to `1.1.2`.
- [x] The GitHub release notes and docs release notes include `1.1.2`.
- [x] Validation passes for the updated branch.

## Review / Results

- [x] Used existing issue #76 for the tracked work.
- [x] Opened PR #77.
- [x] Verified the registry description length is 73 characters.
- [x] Verified `npm run build`.
