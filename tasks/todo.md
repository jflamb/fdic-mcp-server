# Documentation Refactor

Reference: user request on 2026-03-15 to refactor repository and published documentation for GitHub best practices and GitHub Pages.

## Goals

- [x] Review the existing README and `docs/` content to identify gaps.
- [x] Rewrite `README.md` with stronger repository onboarding, navigation, and contributor guidance.
- [x] Build a GitHub Pages-ready documentation set under `docs/`.
- [x] Publish release notes through `docs/` instead of keeping them only under `.github/`.
- [x] Add technical architecture and decision records in a stable docs location.
- [x] Add plain-language end-user guides, prompting guidance, usage examples, and a tool reference.
- [x] Add support and contributing entry points.
- [x] Add repository support for publishing `docs/` with GitHub Pages.
- [x] Validate the repo with `npm run typecheck`, `npm test`, and `npm run build`.

## Acceptance Criteria

- [x] `README.md` follows common GitHub repository documentation conventions and links to the docs site entry point.
- [x] `docs/index.md` acts as a clear documentation home page for GitHub Pages.
- [x] Release notes, technical specifications, and end-user docs are easy to scan and cross-linked.
- [x] Contributors have a dedicated guide instead of relying on the README alone.
- [x] The documentation reflects current MCP client setup and current tool capabilities.
- [x] Validation commands complete successfully after the refactor.

## Review / Results

- [x] Completed on branch `docs/github-pages-refactor`.
- [x] Validation passed: `npm run typecheck`, `npm test`, `npm run build`.
- [x] Added `SECURITY.md`.
- [x] Added troubleshooting and FAQ documentation.
- [x] Added an MCP host compatibility and support matrix.
- [x] Added a documentation overview page organized by audience.
- [x] Added custom docs-site styling and breadcrumb navigation for sub-pages.
- [x] Refined the docs home to surface latest version and clear starting points earlier.
- [x] Expanded the prompting guide with narrower deep-analysis prompts that are ready to copy and paste.
