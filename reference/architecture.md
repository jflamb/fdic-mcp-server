# Architecture

Repository reference for the end-to-end request flow and the code boundaries between transports, tools, and FDIC API access.

## High-Level Flow

1. An MCP host calls a tool exposed by the server.
2. The server validates arguments and dispatches to the relevant tool implementation in `src/tools`.
3. Tool implementations call the FDIC client in `src/services/fdicClient.ts`.
4. The FDIC client handles request construction, pagination, and API error normalization.
5. The tool formats both human-readable `content` and machine-readable `structuredContent`.

## Code Layout

- `src/index.ts`: server construction and transport wiring
- `src/tools/*.ts`: MCP tool definitions and response shaping
- `src/services/fdicClient.ts`: FDIC API access, pagination, retries, and error handling
- `tests/*.test.ts`: tool behavior and contract coverage
- `scripts/build.js`: build entry point

## Design Boundaries

- Tool logic stays in `src/tools` instead of scattering FDIC-specific logic through transport code.
- The FDIC client centralizes HTTP and pagination concerns.
- Analysis tools batch multiple FDIC lookups inside the server to reduce client-side orchestration cost.

## Shared Analysis Engine

The `src/tools/shared/` directory contains reusable analysis modules:

- `metricNormalization.ts` — canonical metric extraction with provenance tracking (reads primary FDIC field names)
- `capitalClassification.ts` — PCA-style capital categorization using official regulatory thresholds (critically undercapitalized requires tangible-equity data not available from BankFind public financials)
- `trendEngine.ts` — enhanced trend analysis with consecutive-worsening detection, reversal flags, and history-event awareness
- `peerEngine.ts` — peer comparison with percentile computation, MAD-based robust z-scores, and outlier detection
- `managementOverlay.ts` — management overlay assessment with band-capping logic
- `riskSignalEngine.ts` — unified risk signal classification with standardized codes
- `publicCamelsProxy.ts` — orchestration layer assembling all modules into the `public_camels_proxy_v1` model
- `camelsScoring.ts` — original CAMELS-style scoring (retained for backward compatibility)
- `financialMetrics.ts` — derived financial metrics used by peer group and snapshot tools
- `queryUtils.ts` — shared query construction, date handling, and concurrency utilities

These modules are designed as pure functions with no FDIC API dependencies, making them fully testable in isolation — with the exception of `historyFetch.ts`, which queries the FDIC history endpoint and is tested via mock.

## Operational Notes

- The package supports both direct CLI execution and imported server construction via `dist/server.js`.
- Short-lived caching is used to make repeated analysis prompts more efficient.
- The HTTP transport is intended for hosts that cannot launch local stdio processes.
- The public HTTP endpoint at `https://bankfind.jflamb.com/mcp` is hosted on Google Cloud Run behind a custom domain.
- Release tags are configured to publish `server.json` metadata to the official MCP Registry, with publication status verified separately from deployment.
