# Docs Chatbot Live Runtime Failure

Reference: issue #183 and the 2026-03-18 live docs report that the launcher sometimes responds with "The demo could not process that request right now."

## Goals

- [x] Reproduce or otherwise confirm the live failure mode against the deployed docs and chat service.
- [x] Identify the root cause in the backend or launcher integration without relying on a speculative UI-only workaround.
- [x] Add or update automated coverage for the failing path.
- [ ] Validate the fix with the repo-standard commands and merge it through the normal workflow.

## Acceptance Criteria

- [x] Investigation captures evidence from the live deployment, not only local assumptions.
- [x] The chat backend is more resilient to transient upstream failures that would otherwise surface as a generic demo error.
- [x] Server-side failures emit enough structured information to diagnose future incidents from Cloud Run logs.
- [x] Automated tests cover the retry or failure-handling path that caused the user-visible break.

## Validation

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:e2e`

## Review / Results

- [x] Branch created for this work: `fix/chatbot-live-runtime-failure`.
- [x] Confirmed the live service logged a real browser-side `POST /chat` 500 on revision `cc96580a3521c3856f5b135cae63934eda909623`.
- [x] Added transient retry handling around Gemini generation calls and structured server-side failure logging.
- [x] Local validation passed for typecheck, unit/integration tests, build, and e2e coverage.
