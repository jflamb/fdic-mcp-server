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
