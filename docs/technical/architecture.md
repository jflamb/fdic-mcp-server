---
title: Architecture
---

# Architecture

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

## Operational Notes

- The package supports both direct CLI execution and imported server construction via `dist/server.js`.
- Short-lived caching is used to make repeated analysis prompts more efficient.
- The HTTP transport is intended for hosts that cannot launch local stdio processes.
