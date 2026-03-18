# Docs Chatbot Demo

Reference: approved design in [docs/plans/2026-03-18-docs-chatbot-demo-design.md](/Users/jlamb/Projects/bankfind-mcp/docs/plans/2026-03-18-docs-chatbot-demo-design.md), implementation plan in [docs/plans/2026-03-18-docs-chatbot-demo-plan.md](/Users/jlamb/Projects/bankfind-mcp/docs/plans/2026-03-18-docs-chatbot-demo-plan.md), and the 2026-03-18 user request to implement the feature under the repo workflow.

## Goals

- [x] Add a Gemini-backed `/chat` demo endpoint to the existing HTTP app without changing MCP tool contracts.
- [x] Add a protected `/chat/status` endpoint, origin checks, per-IP rate limiting, request validation, and in-memory chat session handling.
- [x] Add a docs "Try It" page with suggested prompts, conversational UI, loading/error states, and graceful degradation when chat is unavailable.
- [x] Add regression coverage for the server endpoint, rate limiter, docs integration, and chatbot UI behavior.
- [x] Validate the feature with repo-standard commands plus targeted docs/e2e checks.

## Acceptance Criteria

- [x] [src/chat.ts](/Users/jlamb/Projects/bankfind-mcp/src/chat.ts) provides `POST /chat` and `GET /chat/status` behavior matching the approved design, including request/response shapes, origin validation, rate limiting, size limits, and bounded Gemini tool-call rounds.
- [x] [src/index.ts](/Users/jlamb/Projects/bankfind-mcp/src/index.ts) wires the chat routes into `createApp()` while preserving existing `/health` and `/mcp` behavior.
- [x] [docs/try-it.md](/Users/jlamb/Projects/bankfind-mcp/docs/try-it.md), [docs/assets/js/chatbot.js](/Users/jlamb/Projects/bankfind-mcp/docs/assets/js/chatbot.js), and [docs/assets/css/docs.css](/Users/jlamb/Projects/bankfind-mcp/docs/assets/css/docs.css) deliver the chatbot experience and unavailable-state fallback described in the design.
- [x] [docs/_data/navigation.yml](/Users/jlamb/Projects/bankfind-mcp/docs/_data/navigation.yml) exposes the new Try It page in site navigation.
- [x] Automated coverage verifies the chat rate limiter, the `/chat` endpoint contract, and the docs chatbot behavior, including markdown rendering and rate-limit feedback.
- [x] CI/deploy workflow updates cover the new chat tests and post-deploy `/chat/status` smoke check.

## Validation

- [x] `npm install`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:e2e`

## Review / Results

- [x] Branch created for this work: `feat/docs-chatbot-demo`.
- [x] Server-side chat endpoint, protection layers, and Gemini tool execution integrated without breaking existing MCP routes.
- [x] Docs Try It experience added with suggested prompts, conversation rendering, and unavailable-state handling.
- [x] Test coverage added for backend, frontend, and workflow integration.
- [x] Validation results recorded here before closeout.

Notes:
- Implemented the Gemini integration with `@google/genai` instead of the deprecated `@google/generative-ai` package named in the original plan. The endpoint contract and deployment model remain the same, but the dependency is the current supported SDK.
