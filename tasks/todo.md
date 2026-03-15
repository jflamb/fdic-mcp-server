# Hosted Onboarding And Registry Publication

Reference: issue #35 and user request to update the docs around the live hosted endpoint and automate publication to a public MCP registry.

## Goals

- [x] Verify that the hosted endpoint is live and suitable for onboarding docs.
- [x] Update end-user docs to prioritize the live hosted endpoint where appropriate.
- [x] Add official MCP Registry metadata to the repository.
- [x] Automate official MCP Registry publication from the release workflow.
- [x] Validate with `npm run typecheck`, `npm test`, and `npm run build`.

## Acceptance Criteria

- [x] Getting Started and client setup pages point to the hosted endpoint as the easiest path when remote URLs are supported.
- [x] The repo contains registry metadata for the hosted MCP server.
- [x] Release tags publish metadata to at least one public MCP registry.
- [x] The workflow uses the documented official MCP Registry OIDC path instead of long-lived registry secrets.
- [x] Validation commands pass after the repo changes.

## Review / Results

- [x] Verified the live custom-domain endpoint `https://bankfind.jflamb.com/mcp`.
- [x] Added `server.json` metadata plus release-time version synchronization for the official MCP Registry.
- [x] Updated onboarding docs to prefer the hosted endpoint and clarify that npm-install-by-prompt only applies to agentic environments with machine access.
- [x] Verified `npm run typecheck`, `npm test`, `npm run build`, and `npm run registry:sync`.
