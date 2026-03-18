# Docs Migration To Reference

Reference: 2026-03-18 request to move repo-oriented documentation out of the public Pages site into a repo-rendered `reference/` area while keeping the public site focused on end users.

## Goals

- [x] Create an exact file-by-file migration checklist before making changes.
- [x] Create a `reference/` landing page and move the technical reference docs there.
- [x] Move plan and design markdown files out of `docs/` into a browsable location under `reference/`.
- [x] Remove the published technical-reference section from the GitHub Pages information architecture without adding stub pages.
- [x] Update README and cross-links so repo docs remain discoverable from the repository home page.
- [x] Validate the resulting docs split with the repo-standard checks.

## Acceptance Criteria

- [x] Technical reference documents currently under `docs/technical/` live under `reference/` and are readable in GitHub with a clear index.
- [x] Plan and design markdown files remain accessible from the `reference/` documentation rather than disappearing from navigation.
- [x] The GitHub Pages site continues to build from `docs/` and remains user-focused.
- [x] The public site no longer exposes a primary `Technical Reference` section.
- [x] Existing repository links are updated to the new `reference/` paths where appropriate.
- [x] No slim stub pages are left behind in `docs/technical/`.

## File-By-File Migration Checklist

- [x] Add `reference/README.md` as the repo-docs landing page.
- [x] Move `docs/technical/specification.md` to `reference/specification.md`.
- [x] Move `docs/technical/architecture.md` to `reference/architecture.md`.
- [x] Move `docs/technical/decisions.md` to `reference/decisions.md`.
- [x] Move `docs/technical/cloud-run-deployment.md` to `reference/cloud-run-deployment.md`.
- [x] Move `docs/plans/2026-03-15-peer-group-analysis-design.md` to `reference/plans/2026-03-15-peer-group-analysis-design.md`.
- [x] Move `docs/plans/2026-03-15-peer-group-analysis-plan.md` to `reference/plans/2026-03-15-peer-group-analysis-plan.md`.
- [x] Move `docs/plans/2026-03-15-tool-schema-listing-fix-plan.md` to `reference/plans/2026-03-15-tool-schema-listing-fix-plan.md`.
- [x] Move `docs/plans/2026-03-16-state-input-normalization-design.md` to `reference/plans/2026-03-16-state-input-normalization-design.md`.
- [x] Move `docs/plans/2026-03-16-state-input-normalization-plan.md` to `reference/plans/2026-03-16-state-input-normalization-plan.md`.
- [x] Move `docs/plans/2026-03-18-docs-frontend-cleanup-design.md` to `reference/plans/2026-03-18-docs-frontend-cleanup-design.md`.
- [x] Move `docs/plans/2026-03-18-docs-frontend-cleanup-plan.md` to `reference/plans/2026-03-18-docs-frontend-cleanup-plan.md`.
- [x] Move `docs/plans/2026-03-18-docs-chatbot-demo-design.md` to `reference/plans/2026-03-18-docs-chatbot-demo-design.md`.
- [x] Move `docs/plans/2026-03-18-docs-chatbot-demo-plan.md` to `reference/plans/2026-03-18-docs-chatbot-demo-plan.md`.
- [x] Remove `docs/technical/index.md`.
- [x] Update `docs/_data/navigation.yml` to remove the technical nav group and keep the public site user-first.
- [x] Update `docs/index.md` cards and copy to point to repo reference instead of a public technical section.
- [x] Update `README.md` documentation links to split public docs from repo reference docs.
- [x] Update any remaining repo links that still point at `docs/technical/*` or `docs/plans/*`.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`

## Review / Results

- [x] Branch created for this work: `refactor/reference-docs-split`.
- [x] Public Pages docs remain focused on setup, usage, tool selection, and support without a top-level technical-reference section.
- [x] Repo reference docs are reachable from `README.md`, `reference/README.md`, and `reference/plans/README.md`.
- [x] Link audit completed for moved files, with stale technical and plans references removed outside the task checklist.

# Docs Chatbot Markdown Rendering

Reference: issue #185 and the 2026-03-18 user report that Gemini responses are still showing up as hard-to-read markdown in the hosted docs chat UI.

## Goals

- [x] Inspect the current renderer and identify which markdown patterns are not being formatted in the launcher UI.
- [x] Improve the safe markdown renderer for common Gemini output patterns.
- [x] Add or update automated coverage for richer markdown rendering.
- [ ] Validate the fix with the repo-standard commands and merge it through the normal workflow.

## Acceptance Criteria

- [x] Assistant replies render common markdown structures such as headings, numbered lists, emphasis, links, inline code, and tables into readable HTML.
- [x] The renderer continues to escape raw HTML rather than trusting model output.
- [x] Bubble styling supports the richer markdown structure without collapsing spacing.
- [x] Automated coverage verifies the richer markdown rendering path.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:e2e`

## Review / Results

- [x] Branch created for this work: `fix/chatbot-markdown-rendering`.
- [x] Confirmed the existing renderer only handles a narrow markdown subset and misses common Gemini output patterns.
- [x] Added richer safe markdown rendering for headings, ordered lists, emphasis, links, inline code, and fenced code blocks.
- [x] Updated bubble styling and e2e coverage, including an escaped raw HTML assertion.

# User Docs Internal-Detail Cleanup

Reference: 2026-03-18 request to remove implementation-facing MCP server details from the public `docs/` site and either rewrite them in user terms or relocate them to `reference/`.

## Goals

- [x] Audit the public docs for implementation-facing language, especially endpoint-specific, payload-shape, and transport-internal details.
- [x] Rewrite user-facing pages so they explain limits and recovery steps in user terms rather than MCP or FDIC implementation terms.
- [x] Move any detail that still belongs in the repo docs into `reference/` rather than leaving it on the GitHub Pages site.
- [x] Validate the resulting docs with the repo-standard checks.

## Acceptance Criteria

- [x] Public pages under `docs/` stay focused on setup, prompting, tool selection, examples, and troubleshooting from a user perspective.
- [x] User docs no longer explain issues in terms of FDIC endpoint membership, MCP response payload fields, or low-level HTTP session mechanics unless that detail is essential for setup.
- [x] Any technical detail that remains useful for maintainers or advanced integrators is captured under `reference/`.
- [x] Cross-links remain accurate after the rewrite.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`

## Review / Results

- [x] Branch created for this work: `docs/remove-internal-user-doc-details`.
- [x] Rewrote public docs to explain dataset mismatches, setup paths, and expected results in user terms rather than endpoint or payload-contract terms.
- [x] Removed public references to `structuredContent`, `REPDTE` search hints, endpoint-specific `fields` and `sort_by` guidance, and low-level HTTP session/header details from the user-doc path.
- [x] Expanded [reference/specification.md](../reference/specification.md) with the HTTP transport details that were removed from public onboarding pages.
