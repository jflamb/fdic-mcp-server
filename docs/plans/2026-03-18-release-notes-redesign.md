# Release Notes Page Redesign

**Date:** 2026-03-18
**Status:** Approved

## Problem

The release notes page is stale: it shows manually curated notes for v1.1.0–1.1.3 (7+ major versions behind), a single pointer to the latest GitHub release, and section nav tabs for each old version. The current release is v1.9.0.

## Design

### Data layer

Extend `scripts/generate-docs-release-data.mjs` to fetch the last 10 releases from the GitHub Releases API (paginated, sorted by published date). Write two files:

- `docs/_data/latest_release.json` — unchanged, used by other pages
- `docs/_data/releases.json` — array of release objects, each with: `tag_name`, `version`, `display_name`, `url`, `published_at`, `body` (raw markdown), and `summary` (plain-text excerpt)

The `body` field preserves the full semantic-release changelog markdown so the template can render it inline. The `summary` field is a truncated plain-text fallback.

### Page template

Rework `docs/release-notes/index.md` to render the releases array as a compact changelog:

- Each release gets a heading (version + date), the rendered body, and a "View on GitHub" link
- A "View all releases" link at the bottom points to the full GitHub Releases page
- Remove the old manual version links

### Cleanup

- Delete `docs/release-notes/v1.1.0.md` through `docs/release-notes/v1.1.3.md`
- Remove these pages from `docs/_data/navigation.yml` section items
- The release notes page becomes a standalone page in the Project & Support section (no section nav tabs for individual versions)

### Working norms (AGENTS.md)

Add a section under Change Management about writing meaningful commit messages that support release note generation:

- Conventional commit subjects should describe the user-facing change, not the implementation detail
- The body should include context when the subject alone is ambiguous
- `feat:` commits should name the capability added
- `fix:` commits should name the behavior corrected
- Avoid generic subjects like "update code" or "fix bug"

This matters because semantic-release derives the GitHub Release body from commit messages — better commits produce better release notes automatically.

## Out of scope

- Per-release static pages (GitHub Releases already serves this)
- Fetching more than 10 releases (keeps build fast and page scannable)
