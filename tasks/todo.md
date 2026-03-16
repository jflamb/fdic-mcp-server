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

# Idempotent Publish Workflow

Reference: issue #78.

## Goals

- [x] Prevent the publish workflow from failing when npm already has the target version.
- [x] Allow later release steps to continue when npm publish is skipped.
- [x] Open a PR for the workflow fix.

## Acceptance Criteria

- [x] `.github/workflows/publish.yml` checks whether the npm version already exists before publishing.
- [x] The npm publish step is skipped instead of failing when the version is already present.
- [x] The rest of the publish workflow can still run after a skipped npm publish.
- [x] Workflow YAML remains valid after the change.

## Review / Results

- [x] Used existing issue #78 for the tracked work.
- [x] Opened PR #79.
- [x] Verified `.github/workflows/publish.yml` parses with Ruby `YAML.load_file`.

# Tool Schema Listing Fix

Reference: issue #80.

## Goals

- [x] Fix empty `inputSchema` listings for `fdic_compare_bank_snapshots` and `fdic_peer_group_analysis`.
- [x] Preserve runtime rejection of invalid cross-field argument combinations.
- [x] Add regression tests for the advertised `tools/list` schemas and invalid argument handling.
- [x] Open a PR for the fix.

## Acceptance Criteria

- [x] `tools/list` returns non-empty parameter schemas for both affected analysis tools.
- [x] `fdic_compare_bank_snapshots` still rejects requests that provide neither `state` nor `certs`.
- [x] `fdic_peer_group_analysis` still rejects requests that provide no peer-group constructor or an invalid asset range.
- [x] Validation passes for targeted tests plus repo type/build checks.

## Review / Results

- [x] Opened issue #80.
- [x] Opened PR #81.
- [x] Verified `npm test -- tests/mcp-http.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.
- [x] Verified post-build `tools/list` output contains populated schemas for both affected tools.

# Schema Fix Release Prep

Reference: issue #80 and PR #81.

## Goals

- [x] Bump the package and registry metadata version for the schema-listing fix release.
- [x] Add matching GitHub and docs release notes for the new version.
- [x] Merge the fix branch to `main`.
- [x] Tag the merged `main` commit so the publish workflow runs.

## Acceptance Criteria

- [x] `package.json`, `package-lock.json`, and `server.json` all point to the new patch version.
- [x] The docs site points to the new latest release notes entry.
- [x] The release tag references a commit already on `main`.
- [x] Validation passes after the release-prep changes.

## Review / Results

- [x] Release version selected: `1.1.3`.
- [x] Merged PR #81 to `main`.
- [x] Tagged merged `main` commit as `v1.1.3`.
- [x] Verified `npm test -- tests/mcp-http.test.ts`.
- [x] Verified `npm run typecheck`.
- [x] Verified `npm run build`.

# Idempotent GitHub Packages Publish

Reference: issue #82.

## Goals

- [ ] Prevent the tagged publish workflow from failing when GitHub Packages already has the target version.
- [ ] Allow later release steps to continue when GitHub Packages publish is skipped.
- [ ] Open a PR for the workflow fix.

## Acceptance Criteria

- [ ] `.github/workflows/publish.yml` checks whether the GitHub Packages version already exists before publishing.
- [ ] The GitHub Packages publish step is skipped instead of failing when the version is already present.
- [ ] The GitHub Release step can still run after a skipped GitHub Packages publish.
- [ ] Workflow YAML remains valid after the change.

## Review / Results

- [x] Opened issue #82.

# Trusted Publishing Release Recovery

Reference: issue #122.

## Goals

- [x] Trace why the `Release` workflow on `main` is failing before it can publish a new version.
- [x] Verify whether npm trusted publishing is still the supported path for this repo.
- [x] Update the release workflow to use the supported trusted-publishing configuration instead of the broken token-oriented path.
- [x] Validate the workflow change before merge.

## Acceptance Criteria

- [x] The repo captures evidence for the current `Release` workflow failure mode.
- [x] The release workflow no longer configures `setup-node` with npm `registry-url` in the semantic-release job.
- [x] The semantic-release step no longer requires `NPM_TOKEN` when the repo is using npm trusted publishing from GitHub Actions.
- [x] Validation covers workflow syntax and the repo-standard PR checks.

## Review / Results

- [x] Confirmed failed `Release` runs on March 16, 2026 were stopping in semantic-release with `EINVALIDNPMTOKEN` during `@semantic-release/npm` `verifyConditions`.
- [x] Verified the workflow was still setting `registry-url` in `setup-node` and passing `NPM_TOKEN`, which conflicts with the semantic-release trusted-publishing guidance.
- [x] Validated `.github/workflows/publish.yml` parses cleanly with `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish.yml"); puts "YAML OK"'`.
- [x] Verified `npm run typecheck`, `npm test`, and `npm run build`.

# Semantic Release Automation

Reference: issue #105.

## Goals

- [x] Replace the manual tag-driven release flow with semantic-release automation triggered from validated `main` commits.
- [x] Keep npm, GitHub Packages, GitHub Releases, and MCP registry publication working after the migration.
- [x] Document the commit and merge conventions required for automatic semantic versioning.

## Acceptance Criteria

- [x] A successful CI run for `main` can trigger release automation without manual version bumps or manual tagging.
- [x] Semantic version calculation is driven by conventional commits.
- [x] Release automation still updates package/version metadata used by the runtime and registry publication.
- [x] Documentation explains the new automated release policy and the expected commit hygiene.

## Review / Results

- [x] Added semantic-release configuration, changelog generation, and a helper script that exposes release results to GitHub Actions.
- [x] Replaced the manual tag-triggered publish workflow with an automated release workflow that runs after successful CI on the latest `main` commit.
- [x] Added commit-message linting in CI so semantic versioning stays reliable under the current merge workflow.
- [x] Removed the one-off backfill workflow and updated contributor and deployment docs to describe the automated release process.

# Analysis Bug Batch: Issues #103 And #104

Reference: issues #103 and #104.

## Goals

- [x] Fix invalid `REPDTE` handling in the analysis date-span helpers so impossible calendar dates cannot leak `NaN` into `asset_cagr` or related structured output.
- [x] Make `fdic_compare_bank_snapshots` return one stable `structuredContent` shape for both empty and populated comparison sets.
- [x] Add targeted regression coverage for both bugs in the analysis helper tests and MCP HTTP contract tests.
- [x] Execute the work on a dedicated branch from fresh `main`. Branch: `fix/analysis-batch-103-104`.

## Acceptance Criteria

- [x] `yearsBetween()` returns `0` when either fallback parsed date is invalid, including impossible month/day combinations.
- [x] `cagr()` returns `null` when `years` is non-finite, so `asset_cagr` never becomes `NaN`.
- [x] The empty-result path for `fdic_compare_bank_snapshots` includes the same top-level keys as the success path: `warnings`, `insights`, `total`, `offset`, `count`, `has_more`, and `comparisons`.
- [x] Roster-level warnings remain visible even when the analyzed set is empty.
- [x] Regression tests cover invalid-date helper inputs and the empty-analysis `structuredContent` contract.
- [x] Validation passes with `npm run typecheck`, `npm test -- tests/analysis.test.ts tests/mcp-http.test.ts`, and `npm run build`.

## Review / Results

- [x] Created a dedicated worktree and branch from `main` to keep this bug batch isolated from unrelated local publish work.
- [x] Replaced permissive `Date` fallback parsing in [analysis.ts](/Users/jlamb/Projects/bankfind-mcp-analysis-103-104/src/tools/analysis.ts) with strict UTC round-trip validation so values such as `20240230` are rejected instead of normalized.
- [x] Tightened `cagr()` in [analysis.ts](/Users/jlamb/Projects/bankfind-mcp-analysis-103-104/src/tools/analysis.ts) to return `null` for non-finite year spans.
- [x] Centralized the analysis output envelope in [analysis.ts](/Users/jlamb/Projects/bankfind-mcp-analysis-103-104/src/tools/analysis.ts) so empty and populated responses share the same `structuredContent` shape.
- [x] Added regression coverage in [analysis.test.ts](/Users/jlamb/Projects/bankfind-mcp-analysis-103-104/tests/analysis.test.ts) and [mcp-http.test.ts](/Users/jlamb/Projects/bankfind-mcp-analysis-103-104/tests/mcp-http.test.ts) for invalid dates, non-finite CAGR inputs, empty envelopes, and preserved warnings on empty analyzed results.
- [x] Verified `npm test -- tests/analysis.test.ts tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build`.

# MCP Compliance Remediation

Reference: umbrella issue #115 and issues #109, #110, #111, #112, #113, and #114.

## Goals

- [x] Make the HTTP transport session-aware so MCP lifecycle state persists across requests.
- [x] Implement compliant `GET /mcp` and `DELETE /mcp` behavior for initialized sessions.
- [x] Default local HTTP binding to localhost and enforce Origin validation with a configurable allowlist.
- [x] Add progress notifications for the long-running analysis tools without changing tool result contracts.
- [x] Update user-facing docs for the new HTTP defaults and environment knobs.

## Acceptance Criteria

- [x] `initialize` creates a reusable session and subsequent requests require `MCP-Session-Id`.
- [x] `GET /mcp` opens an SSE stream for an initialized session and `DELETE /mcp` terminates that session.
- [x] Unsupported `MCP-Protocol-Version` headers are rejected and missing headers after initialization still use the SDK default behavior.
- [x] Local HTTP runs bind to `127.0.0.1` by default, with `HOST` available for explicit overrides.
- [x] Disallowed browser `Origin` headers receive HTTP 403 while non-browser requests without `Origin` continue to work.
- [x] `fdic_compare_bank_snapshots` and `fdic_peer_group_analysis` emit monotonic progress notifications when the request includes a progress token.
- [x] Repo-standard validation passes.

## Review / Results

- [x] Opened umbrella issue #115 and set it as the parent issue for #109 through #114.
- [x] Reworked [index.ts](/Users/jlamb/Projects/bankfind-mcp-mcp-http/src/index.ts) to manage one `McpServer` plus `StreamableHTTPServerTransport` per HTTP session instead of rebuilding the server on every POST.
- [x] Reused the SDK's built-in session, method, protocol-version, and origin-validation behavior by routing requests to the correct persistent transport instance.
- [x] Added `HOST` and `ALLOWED_ORIGINS` runtime support and documented the localhost-default bind behavior in [README.md](/Users/jlamb/Projects/bankfind-mcp-mcp-http/README.md), [getting-started.md](/Users/jlamb/Projects/bankfind-mcp-mcp-http/docs/getting-started.md), and [troubleshooting.md](/Users/jlamb/Projects/bankfind-mcp-mcp-http/docs/troubleshooting.md).
- [x] Added a shared progress notification helper in [progress.ts](/Users/jlamb/Projects/bankfind-mcp-mcp-http/src/tools/shared/progress.ts) and wired it into [analysis.ts](/Users/jlamb/Projects/bankfind-mcp-mcp-http/src/tools/analysis.ts) and [peerGroup.ts](/Users/jlamb/Projects/bankfind-mcp-mcp-http/src/tools/peerGroup.ts).
- [x] Expanded [mcp-http.test.ts](/Users/jlamb/Projects/bankfind-mcp-mcp-http/tests/mcp-http.test.ts) to cover session initialization requirements, GET/DELETE handling, protocol-version validation, origin enforcement, and end-to-end progress notifications over the standalone SSE stream.
- [x] Verified `npm run typecheck`, `npm test -- tests/mcp-http.test.ts tests/analysis.test.ts tests/peerGroup.test.ts`, `npm test`, and `npm run build`.
- [x] Expanded [mcp-http.test.ts](/Users/jlamb/Projects/bankfind-mcp-mcp-http/tests/mcp-http.test.ts) to cover session initialization requirements, GET/DELETE handling, protocol-version validation, and origin enforcement.
- [x] Verified `npm run typecheck`, `npm test -- tests/mcp-http.test.ts`, `npm test`, and `npm run build`.
