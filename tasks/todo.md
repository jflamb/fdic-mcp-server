# Issue #142: Node Engine Minimum Matches Supported CI Matrix

Reference: issue #142.

## Goals

- [x] Align the declared Node.js engine minimum with the lowest runtime version this repository actually validates in CI.
- [x] Update user-facing documentation so local install prerequisites no longer imply unsupported Node 18 usage.
- [x] Add regression coverage that fails if `package.json` and the CI Node matrix drift apart again.
- [x] Validate the change with repo-standard commands and record the result.

## Acceptance Criteria

- [x] `package.json` declares a Node engine minimum that matches the lowest version in `.github/workflows/ci.yml`'s `validate` job.
- [x] Docs that describe local install prerequisites or troubleshooting minimums say Node.js 20 or later.
- [x] Automated tests fail if the declared engine minimum and CI-supported minimum diverge in the future.
- [x] `npm run typecheck`, `npm test`, and `npm run build` pass after the change.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`

## Review / Results

- [x] Branch created for this work: `fix/issue-142-node-engine-minimum`.
- [x] Updated [package.json](/Users/jlamb/Projects/bankfind-mcp/package.json) and the install/troubleshooting docs to state Node.js 20 or later consistently with the current CI support policy.
- [x] Added [runtime-policy.test.ts](/Users/jlamb/Projects/bankfind-mcp/tests/runtime-policy.test.ts) to compare `package.json.engines.node` against the lowest Node version in the CI `validate` matrix so future policy drift fails under `npm test`.

# Issue #148: Peer Group extra_fields Validation

Reference: issue #148.

## Goals

- [x] Validate `fdic_peer_group_analysis.extra_fields` against the financials endpoint field catalog before any FDIC API call.
- [x] Return a clear error that lists invalid field names while preserving the existing tool contract for valid requests.
- [x] Add regression coverage for both invalid and valid `extra_fields` behavior.
- [x] Validate with repo-standard commands and record the final review outcome.

## Acceptance Criteria

- [x] Invalid `extra_fields` entries are rejected before any upstream FDIC request is attempted.
- [x] The error message clearly lists the invalid field names.
- [x] Valid `extra_fields` values are still included as raw values in peer-group output.
- [x] `npm run typecheck`, `npm test`, and `npm run build` pass after the change.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`

## Review / Results

- [x] Branch created for this work: `fix/issue-148-peer-group-extra-fields-validation`.
- [x] Reused the shared endpoint metadata catalog in [fdicSchema.ts](/Users/jlamb/Projects/bankfind-mcp/src/services/fdicSchema.ts) so peer-group validation and low-level query validation use the same invalid-field detection and error wording.
- [x] Added an early `extra_fields` guard in [peerGroup.ts](/Users/jlamb/Projects/bankfind-mcp/src/tools/peerGroup.ts) so invalid requests fail before progress or FDIC API calls begin.
- [x] Added MCP HTTP regression coverage for invalid and valid `extra_fields` requests in [mcp-http.test.ts](/Users/jlamb/Projects/bankfind-mcp/tests/mcp-http.test.ts).

# Docker Healthcheck And Runtime Parity

Reference: issues #139 and #147.

## Goals

- [x] Add a container `HEALTHCHECK` that exercises the existing `/health` endpoint.
- [x] Make the Dockerfile runtime version explicit and reproducible instead of relying on a mutable major tag.
- [x] Add CI coverage that actually builds the Docker image across the supported container runtime matrix.
- [x] Validate the batch with repo-standard checks plus Dockerfile/workflow verification.

## Acceptance Criteria

- [x] `Dockerfile` includes a non-shell `HEALTHCHECK` that fails when `http://localhost:8080/health` is unavailable or non-OK.
- [x] The Docker base image is pinned to a specific published Node 22 patch version by default.
- [x] CI adds a Docker build job that builds the container with both Node 20 and Node 22 image args so Dockerfile regressions are caught in the same matrix CI claims to support.
- [x] Repo-standard validation passes after the changes.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] Parse the updated workflow YAML successfully.

## Review / Results

- [x] Branch created for this work: `fix/issues-139-147-docker-runtime-parity`.
- [x] Pinned the Docker build and runtime stages to `node:22.22.1-bookworm-slim` by default while keeping `NODE_VERSION` overrideable for CI matrix builds.
- [x] Added a JSON-array `HEALTHCHECK` that probes the existing HTTP `/health` endpoint.
- [x] Added CI Docker image builds for `20.20.1` and `22.22.1`, then asserted that the built images carry `Healthcheck` metadata.

# Bug Batch 4: CI, Release, And Deployment Bugs

Reference: bug #144 from the `bug` issue batch generated on 2026-03-16.

## Goals

- [x] Replace locale-dependent report-date formatting with deterministic manual formatting.
- [x] Add regression coverage for valid and invalid formatted dates.
- [x] Validate the batch with targeted tests plus repo-standard type/build checks.

## Acceptance Criteria

- [x] `formatRepdteHuman()` returns stable `Month D, YYYY` output without relying on runtime ICU locale data.
- [x] Invalid report dates still round-trip as the original string.
- [x] `npm test -- tests/peerGroup.test.ts`, `npm run typecheck`, and `npm run build` pass after the changes.

## Review / Results

- [x] Branch created for Batch 4 work: `fix/bug-batch-4-date-format-pr`.
- [x] Replaced locale-dependent formatting with explicit UTC validation plus month-name formatting in [peerGroup.ts](/Users/jlamb/Projects/bankfind-mcp-batch4/src/tools/peerGroup.ts).
- [x] Added deterministic date-format regression coverage, including impossible calendar dates, in [peerGroup.test.ts](/Users/jlamb/Projects/bankfind-mcp-batch4/tests/peerGroup.test.ts).
- [x] Verified `npm test -- tests/peerGroup.test.ts`, `npm run typecheck`, and `npm run build`.

# Bug Batch 3: FDIC Data And Query Contract Bugs

Reference: bug #135 from the `bug` issue batch generated on 2026-03-16.

## Goals

- [x] Remove the insertion-order assumption from query-cache expiration pruning.
- [x] Add regression coverage for mixed expired and live cache entries.
- [x] Validate the batch with targeted tests plus repo-standard type/build checks.

## Acceptance Criteria

- [x] Expired query-cache entries are pruned wherever they appear in the cache map.
- [x] Live cache entries are preserved while stale entries are removed.
- [x] `npm test -- tests/fdicClient.test.ts`, `npm run typecheck`, and `npm run build` pass after the changes.

## Review / Results

- [x] Branch created for Batch 3 work: `fix/bug-batch-3-cache-pr`.
- [x] Removed the early `break` from cache pruning in [fdicClient.ts](/Users/jlamb/Projects/bankfind-mcp-batch3/src/services/fdicClient.ts) so expiration cleanup no longer depends on map iteration order.
- [x] Added a cache-regression scenario in [fdicClient.test.ts](/Users/jlamb/Projects/bankfind-mcp-batch3/tests/fdicClient.test.ts) that exercises stale-entry cleanup alongside live cache entries.
- [x] Verified `npm test -- tests/fdicClient.test.ts`, `npm run typecheck`, and `npm run build`.

# Bug Batch 2: HTTP Transport And Protocol Bugs

Reference: bugs #143 and #149 from the `bug` issue batch generated on 2026-03-16.

## Goals

- [x] Add idle-session cleanup for HTTP MCP sessions so abandoned sessions do not accumulate indefinitely.
- [x] Make the `mapWithConcurrency()` safety invariant explicit in code.
- [x] Add regression coverage for idle-session expiration.
- [x] Validate the batch with targeted tests plus repo-standard type/build checks.

## Acceptance Criteria

- [x] HTTP sessions expire after a configurable idle timeout even if the client never sends `DELETE`.
- [x] Session activity refreshes the idle deadline for active clients.
- [x] `mapWithConcurrency()` documents why its shared `nextIndex` access is safe under JavaScript’s execution model.
- [x] `npm test -- tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build` pass after the changes.

## Review / Results

- [x] Branch created for Batch 2 work: `fix/bug-batch-2-http-transport-pr`.
- [x] Added configurable idle-session sweeping plus per-request activity refresh in [index.ts](/Users/jlamb/Projects/bankfind-mcp-batch2/src/index.ts).
- [x] Added MCP HTTP regression coverage for session expiration and keep-alive behavior in [mcp-http.test.ts](/Users/jlamb/Projects/bankfind-mcp-batch2/tests/mcp-http.test.ts).
- [x] Documented the `mapWithConcurrency()` safety invariant inline in [queryUtils.ts](/Users/jlamb/Projects/bankfind-mcp-batch2/src/tools/shared/queryUtils.ts).
- [x] Verified `npm test -- tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build`.

# Bug Batch 1: Analysis And Ranking Bugs

Reference: bugs #141 and #146 from the `bug` issue batch generated on 2026-03-16.

## Goals

- [x] Make analysis progress notifications describe work before it happens, especially when financial and demographic fetches run in parallel.
- [x] Ensure top-level analysis insights are computed from the full analyzed population, not only the returned ranked slice.
- [x] Add or update tests that fail on the current misleading progress sequence and sliced-insight behavior.
- [x] Validate the batch with targeted tests plus repo-standard type/build checks.

## Acceptance Criteria

- [x] Snapshot and timeseries analysis progress notifications are semantically accurate for both `include_demographics: false` and `include_demographics: true`.
- [x] `structuredContent.comparisons` remains limited by `limit`, but `structuredContent.insights` reflects the full sorted comparison population.
- [x] Existing MCP tool contracts remain unchanged apart from the corrected progress messages and insight population semantics.
- [x] `npm test -- tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build` pass after the changes.

## Review / Results

- [x] Branch created for Batch 1 work: `fix/bug-batch-1-analysis-ranking-pr`.
- [x] Replaced misleading post-fetch demographic progress notifications with combined pre-fetch progress messages in [analysis.ts](/Users/jlamb/Projects/bankfind-mcp/src/tools/analysis.ts).
- [x] Decoupled top-level insight generation from the returned `limit` slice so the insight summary reflects the full sorted analysis population.
- [x] Follow-up review fix: kept human-readable analysis text insights scoped to the returned ranked slice while leaving `structuredContent.insights` sourced from the full sorted population.
- [x] Added MCP HTTP regression coverage for combined demographic progress messaging and full-population top-level insights in [mcp-http.test.ts](/Users/jlamb/Projects/bankfind-mcp/tests/mcp-http.test.ts).
- [x] Verified `npm test -- tests/mcp-http.test.ts`, `npm run typecheck`, and `npm run build`.

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

# Docs Release Sync Automation

Reference: issue #133 and user report that the GitHub Pages site still advertises `1.1.3` while GitHub Releases shows `v1.2.2`.

## Goals

- [x] Identify why the docs site release card drifted behind the actual published releases.
- [x] Remove the hardcoded latest-release version from the docs homepage.
- [x] Generate latest-release metadata for Jekyll automatically from GitHub Releases during the Pages build.
- [x] Ensure the Pages workflow rebuilds when a GitHub release is published, not only when `main` receives a push.
- [x] Validate the automation with targeted checks.

## Acceptance Criteria

- [x] The docs homepage latest-release card renders from generated data instead of a manually edited version string.
- [x] A newly published GitHub release is sufficient to refresh the GitHub Pages site.
- [x] If release metadata is unavailable, the docs build still succeeds with a safe fallback.
- [x] Targeted validation passes for the generation script and Jekyll build.

## Review / Results

- [x] Root cause documented.
- [x] Automation implemented and validated.
- [x] Issue created and linked: #133.
- [x] Verified `node scripts/generate-docs-release-data.mjs`.
- [x] Verified fallback generation with `GITHUB_API_URL=http://127.0.0.1:9 DOCS_LATEST_RELEASE_OUTPUT=.tmp/latest_release_fallback.json node scripts/generate-docs-release-data.mjs`.
- [x] Parsed `.github/workflows/pages.yml` successfully with Ruby `YAML.load_file`.
- [x] Verified `PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH" jekyll build --source docs --destination .tmp/jekyll-site`.

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

# Trusted Publishing Plugin Upgrade

Reference: issue #124.

## Goals

- [x] Confirm whether the currently pinned `@semantic-release/npm` version supports npm trusted publishing.
- [x] Upgrade to a trusted-publishing-capable `@semantic-release/npm` version.
- [x] Keep the existing `Release` workflow compatible with the upgraded plugin.
- [x] Validate the dependency update before merge.

## Acceptance Criteria

- [x] The repo no longer pins `@semantic-release/npm` to `12.0.2`.
- [x] The upgraded plugin line is compatible with the current Node `22` release workflow runtime.
- [x] Repo validation passes after the dependency update.

## Review / Results

- [x] Verified the repo now resolves `@semantic-release/npm` `13.1.5`.
- [x] Verified `npm run typecheck`, `npm test`, and `npm run build` after the dependency update.

# Semantic Release Core Upgrade

Reference: issue #126.

## Goals

- [x] Trace whether the still-failing release run is using the upgraded npm plugin line or a bundled older plugin from `semantic-release`.
- [x] Upgrade `semantic-release` itself to a trusted-publishing-capable line.
- [x] Keep the current release config and workflow compatible with the upgraded core.
- [x] Validate the dependency update before merge.

## Acceptance Criteria

- [x] The repo no longer pins `semantic-release` to `24.2.9`.
- [x] The upgraded `semantic-release` line is compatible with the release workflow's Node `22` runtime.
- [x] Repo validation passes after the dependency update.

## Review / Results

- [x] Verified the repo now resolves `semantic-release` `25.0.3` and `@semantic-release/npm` `13.1.5` in the same dependency tree.
- [x] Verified `npm run typecheck`, `npm test`, and `npm run build` after the dependency update.

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

# Protected Main Release Flow

Reference: issue #128.

## Goals

- [x] Keep semantic-release fully automatic for version calculation, tagging, npm publishing, GitHub Releases, GitHub Packages, and MCP Registry publication.
- [x] Remove release-time writes back to protected `main`.
- [x] Update repo docs so they point to the correct published release source of truth.

## Acceptance Criteria

- [x] semantic-release no longer attempts to push release commits directly to `main`.
- [x] Automated versioning and downstream publish steps still use the semantic-release-computed version.
- [x] Repo documentation no longer claims `CHANGELOG.md` on `main` is the authoritative published release record.
- [x] Repo-standard validation passes.

## Review / Results

- [x] Removed `@semantic-release/changelog` and `@semantic-release/git` from the release path so the workflow no longer needs to mutate `main` after tagging and publishing.
- [x] Kept `@semantic-release/npm`, `@semantic-release/exec`, and the downstream publish workflow intact so package and MCP Registry artifacts still use the computed release version inside the release workspace.
- [x] Updated [README.md](/Users/jlamb/Projects/bankfind-mcp/README.md), [CONTRIBUTING.md](/Users/jlamb/Projects/bankfind-mcp/CONTRIBUTING.md), [AGENTS.md](/Users/jlamb/Projects/bankfind-mcp/AGENTS.md), [docs/release-notes/index.md](/Users/jlamb/Projects/bankfind-mcp/docs/release-notes/index.md), and [docs/technical/cloud-run-deployment.md](/Users/jlamb/Projects/bankfind-mcp/docs/technical/cloud-run-deployment.md) to point at GitHub Releases rather than a committed changelog on `main`.
- [x] Verified `npm run typecheck`, `npm test`, and `npm run build`.

# Cloud Run MCP Session Smoke Test

Reference: issue #131.

## Goals

- [x] Fix the Deploy Cloud Run smoke check so it validates the deployed session-based MCP HTTP endpoint correctly.
- [x] Keep the health probe and tool-list verification in the workflow.

## Acceptance Criteria

- [x] The smoke test performs MCP session initialization before any session-bound method call.
- [x] The smoke test reuses the returned `MCP-Session-Id` for follow-up requests.
- [x] Repo-standard validation passes.

## Review / Results

- [x] Confirmed the latest `Deploy Cloud Run` failure was no longer startup-related; the deployment itself succeeded and the workflow failed in `Run post-deploy smoke checks` with HTTP 400 from `/mcp`.
- [x] Identified the root cause as a protocol mismatch: the smoke test posted `tools/list` without first creating an MCP session, but the server correctly requires `initialize` and a valid `MCP-Session-Id`.
- [x] Updated [deploy-cloud-run.yml](/Users/jlamb/Projects/bankfind-mcp/.github/workflows/deploy-cloud-run.yml) to run `initialize`, capture the `MCP-Session-Id`, send `notifications/initialized`, and only then call `tools/list`.
- [x] Verified `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and a YAML parse check for [deploy-cloud-run.yml](/Users/jlamb/Projects/bankfind-mcp/.github/workflows/deploy-cloud-run.yml).

# Label-Driven Issue Batch Helper

Reference: user request to add a shortcut for reviewing issues by label and grouping them into logical execution batches.

## Goals

- [x] Add a repo-local shortcut that fetches GitHub issues by label and emits grouped batches for maintainer review.
- [x] Make the output align with the repository working norms so each batch can be executed with the expected branch, validation, and PR flow.
- [x] Add regression coverage for the batching heuristics and markdown brief rendering.
- [x] Document the shortcut in agent-facing repo guidance.

## Acceptance Criteria

- [x] `npm run issues:batch -- --label bug` produces a markdown brief for the current repository.
- [x] The brief groups matching issues into logical categories and limits each recommended batch to a configurable size.
- [x] The brief includes the key execution norms for branch, validation, testing, and PR handling.
- [x] Automated tests cover category classification, batch splitting, and markdown rendering.

## Review / Results

- [x] Added [prepare-issue-batches.mjs](/Users/jlamb/Projects/bankfind-mcp/scripts/prepare-issue-batches.mjs) plus [issue-batching.mjs](/Users/jlamb/Projects/bankfind-mcp/scripts/lib/issue-batching.mjs) to fetch labeled issues through `gh`, group them by subsystem heuristics, and render a Codex-ready markdown brief.
- [x] Follow-up review fix: `prepare-issue-batches.mjs` now resolves the default repository from the current git remote before falling back to package metadata.
- [x] Added the `npm run issues:batch` shortcut in [package.json](/Users/jlamb/Projects/bankfind-mcp/package.json).
- [x] Documented the helper in [AGENTS.md](/Users/jlamb/Projects/bankfind-mcp/AGENTS.md) so label-driven maintenance passes start from an explicit batch review step.
- [x] Added the prompt shorthand `/issue-batch <label>` to [AGENTS.md](/Users/jlamb/Projects/bankfind-mcp/AGENTS.md) and [prompting-guide.md](/Users/jlamb/Projects/bankfind-mcp/docs/prompting-guide.md) for AI-driven orchestration.
- [x] Run `npm run typecheck`, `npm test -- tests/issue-batching.test.ts`, and `npm run build`.
# Issue #149: mapWithConcurrency Safety Follow-Up

Reference: issue #149.

## Goals

- [x] Add direct regression coverage for `mapWithConcurrency()` so its async work distribution contract is exercised, not just documented.
- [x] Keep the current implementation and safety comment intact unless testing exposes a real behavioral defect.
- [x] Validate with targeted tests plus repo-standard type/build checks.

## Acceptance Criteria

- [x] `mapWithConcurrency()` maps every input exactly once under interleaved async completion and preserves result ordering.
- [x] `mapWithConcurrency()` does not exceed the requested concurrency limit while work is in flight.
- [x] `npm test -- tests/queryUtils.test.ts`, `npm run typecheck`, and `npm run build` pass after the change.

## Review / Results

- [x] Branch created for this work: `fix/issue-149-map-with-concurrency-tests`.
- [x] Added direct `mapWithConcurrency()` regression coverage in [queryUtils.test.ts](/Users/jlamb/Projects/bankfind-mcp/tests/queryUtils.test.ts) for out-of-order async completion and in-flight concurrency limits.
- [x] Verified `npm test -- tests/queryUtils.test.ts`, `npm run typecheck`, and `npm run build`.

# Issue #136: extractRecords Dead Validation

Reference: issue #136.

## Goals

- [x] Remove the unreachable `extractRecords()` record-wrapper validation that duplicates `validateFdicResponseShape()`.
- [x] Keep the public FDIC client contract unchanged for validated responses.
- [x] Update tests to assert the real invariant boundary instead of direct misuse of `extractRecords()`.
- [x] Validate with repo-standard commands and record the result.

## Acceptance Criteria

- [x] `extractRecords()` is a plain projection from validated response wrappers to record payloads.
- [x] Malformed FDIC record wrappers are still rejected before callers receive an `FdicResponse`.
- [x] `npm run typecheck`, `npm test`, and `npm run build` pass after the change.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`

## Review / Results

- [x] Branch created for this work: `fix/issue-136-extract-records`.
- [x] Simplified [fdicClient.ts](/Users/jlamb/Projects/bankfind-mcp/src/services/fdicClient.ts) so `extractRecords()` now trusts the validated `FdicResponse` shape guaranteed by `validateFdicResponseShape()`.
- [x] Updated [fdicClient.test.ts](/Users/jlamb/Projects/bankfind-mcp/tests/fdicClient.test.ts) to cover extracting records from a validated response instead of expecting unreachable dead-code errors from `extractRecords()`.
- [x] Verified `npm run typecheck`, `npm test`, and `npm run build`.

# Issue #160: Documentation Site UX And Design Remediation

Reference: issue #160 and the March 2026 documentation design review feedback.

## Goals

- [x] Add the missing product-level documentation features: site search, page TOC, mobile navigation, footer, and section/page navigation.
- [x] Strengthen homepage onboarding and page flow so the hosted endpoint and next steps are immediately discoverable.
- [x] Close the highest-value accessibility, responsiveness, and presentation gaps without breaking the existing documentation content contracts.
- [x] Validate the result with repo-standard checks plus docs-site build and UI review evidence.

## Acceptance Criteria

- [x] The docs site has site-wide search, a responsive page TOC, a usable mobile nav, and a footer with key project links and version context.
- [x] Section-local navigation and prev/next page flows exist and clearly distinguish the current page from the current top-level section.
- [x] The homepage hero elevates the hosted MCP URL and preserves a strong first-run path for new users.
- [x] Code blocks and tables behave correctly on narrow screens, syntax highlighting is enabled, and dark mode is available.
- [x] The site includes a skip link, favicon/social metadata, and improved heading hierarchy where needed.
- [x] `npm run typecheck`, `npm test`, `npm run build`, and a docs build/search generation flow pass after the change.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] Docs build and search index generation
- [x] Responsive and interaction smoke test

## Review / Results

- [x] Branch created for this work: `feat/issue-160-docs-site-polish`.
- [x] Issue opened for this work: #160.
- [x] Added shared docs navigation metadata in [navigation.yml](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/_data/navigation.yml) so the site can render top-level nav, section-local pills, and prev/next page flows from one source of truth.
- [x] Reworked the docs shell in [default.html](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/_layouts/default.html) and new include partials to add a skip link, mobile nav drawer, responsive page TOC, search dialog, and footer.
- [x] Replaced the site styling and interaction layer in [docs.css](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/assets/css/docs.css) and [docs.js](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/assets/js/docs.js) to support responsive navigation, TOC generation, table wrapping, copyable code blocks, dark mode, and Pagefind-powered search.
- [x] Elevated the hosted endpoint CTA on [index.md](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/index.md) and corrected homepage heading hierarchy.
- [x] Enabled Rouge syntax highlighting and added favicon/social-card assets via [docs/_config.yml](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/_config.yml) plus [favicon.svg](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/assets/images/favicon.svg) and [social-card.svg](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/assets/images/social-card.svg).
- [x] Updated the Pages workflow in [pages.yml](/Users/jlamb/Projects/bankfind-mcp-issue-160/.github/workflows/pages.yml) to install npm dependencies and generate the Pagefind index after the Jekyll build.
- [x] Follow-up validation fix: quoted the colon-containing frontmatter summary in [specification.md](/Users/jlamb/Projects/bankfind-mcp-issue-160/docs/technical/specification.md) after the first Jekyll build exposed invalid YAML that predated this branch.
- [x] Verified `npm run typecheck`, `npm test`, `npm run build`, `/Users/jlamb/.gem/ruby/2.6.0/bin/jekyll build --source docs --destination _site`, and `npm run docs:search`.
- [x] Verified the rendered site over a local HTTP server, including search, mobile navigation, and long-page navigation, and captured a Lighthouse snapshot score of 100 for accessibility, best practices, and SEO on the troubleshooting page.

# Issue #163: GitHub Pages Deploy Failure After Pagefind Integration

Reference: issue #163 and failed Pages run `23176706983` for merge commit `f4b31d19caf48b812ec4f6680e8bca60314afba1`.

## Goals

- [x] Fix the Pages workflow so Pagefind indexing no longer writes directly into the protected Pages output path during the GitHub Actions build.
- [x] Preserve the generated `pagefind/` assets in the final uploaded Pages artifact so the live docs search still works.
- [ ] Validate the workflow logic locally as far as possible, then carry the fix through PR checks and merged redeploy.

## Acceptance Criteria

- [x] The Pages workflow generates the Jekyll site, builds the Pagefind index in a writable staging location, and copies it into the final `_site` artifact.
- [ ] The merged fix produces a successful `Deploy Docs` workflow run on `main`.
- [ ] The live GitHub Pages site reflects the redesigned docs after the successful deploy.

## Validation

- [x] Workflow YAML parses successfully.
- [x] Local docs build and Pagefind generation succeed with the staged output path.
- [ ] PR checks pass.
- [ ] Post-merge `Deploy Docs` run succeeds on `main`.

## Review / Results

- [x] Branch created for this work: `fix/issue-163-pages-pagefind-deploy`.
- [x] Issue opened for this work: #163.
- [x] Updated [pages.yml](/Users/jlamb/Projects/bankfind-mcp-issue-163/.github/workflows/pages.yml) so the Jekyll Docker action writes to `_site_raw`, then a shell step copies those files into a writable `_site` staging directory before `npm run docs:search`.
- [x] Verified the staged workflow path locally with `/Users/jlamb/.gem/ruby/2.6.0/bin/jekyll build --source docs --destination _site_raw && mkdir -p _site && cp -R ./_site_raw/. ./_site/ && npm run docs:search`.
- [x] Verified `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pages.yml')"`, `npm run typecheck`, `npm test`, and `npm run build`.
