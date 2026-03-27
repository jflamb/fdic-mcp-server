---
name: docs-site-content-structure-update
description: Workflow command scaffold for docs-site-content-structure-update in fdic-mcp-server.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /docs-site-content-structure-update

Use this workflow when working on **docs-site-content-structure-update** in `fdic-mcp-server`.

## Goal

Restructures documentation site content, navigation, and hub pages to reflect new information architecture or major content changes.

## Common Files

- `docs/_data/navigation.yml`
- `docs/*.md`
- `docs/_layouts/redirect.html`
- `docs/index.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit docs/_data/navigation.yml to update navigation structure.
- Add or update hub pages in docs/ (e.g., setup.md, prompting.md).
- Update front matter in multiple docs/*.md files to reflect new sections.
- Add redirect layouts or update old URLs as needed.
- Update docs/index.md and related landing pages.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.