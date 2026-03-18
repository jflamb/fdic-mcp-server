# Docs Chatbot Global Launcher

Reference: issue #181, the merged docs chatbot demo work from PR #180, and the 2026-03-18 user correction that the chat entry point should be a site-wide floating launcher rather than a page-first destination.

## Goals

- [x] Replace the docs chatbot's primary entry point with a site-wide floating launcher.
- [x] Support opening the chat via the launcher and the `?` key without hijacking keyboard input inside editable fields.
- [x] Make the chat surface work across desktop and mobile with accessible focus and dismissal behavior.
- [x] Update the backend chat model to a currently supported Gemini model so the live demo works again.
- [x] Add or update automated coverage for the launcher UX, keyboard shortcut, and live-chat fallback behavior.
- [x] Validate the change with repo-standard commands plus chatbot e2e coverage.

## Acceptance Criteria

- [x] The docs layout renders a floating action button in the lower-right across the site with a chat icon, an accessible label, and `Try it!` text on hover/focus.
- [x] Pressing `?` opens the chat only when focus is not inside a text input, textarea, select, or editable surface.
- [x] The chat opens in an accessible modal or drawer that traps focus appropriately, supports explicit close controls, and scales to mobile viewports.
- [x] The old dedicated page is no longer the primary entry path; the launcher is available site-wide.
- [x] The backend chat route uses a currently supported Gemini model and returns successful live responses again.
- [x] Automated tests verify launcher visibility, modal opening, keyboard shortcut behavior, and the existing chat request/response flows.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:e2e`

## Review / Results

- [x] Branch created for this work: `feat/docs-chatbot-launcher`.
- [x] Site-wide launcher and overlay UX implemented.
- [x] Keyboard shortcut and accessibility details implemented and tested.
- [x] Backend model updated to restore live chat functionality.
- [x] Validation results recorded here before closeout.
