---
title: MCP Host Compatibility Matrix
nav_group: project
kicker: Project Info
summary: A concise support snapshot showing which MCP hosts are directly documented here, which transports they use, and what level of support to expect.
breadcrumbs:
  - title: Overview
    url: /
  - title: Project Info
    url: /project-information/
---

The public endpoint and website chatbot are retired. This matrix describes setup paths for the package; remote HTTP requires an endpoint supplied by you or your operator. Client capabilities below retain their original review date.

Last reviewed: March 15, 2026.

| Host | Local Stdio | Remote HTTP | Support | Notes |
|------|:-----------:|:-----------:|:-------:|-------|
| Claude Desktop | ✓ | ✓ | Good | Use local stdio; remote requires your own endpoint |
| ChatGPT Developer Mode | ✗ | ✓ | Good | Requires reachable HTTPS MCP endpoint |
| Gemini CLI | ✓ | ✓ | Good | Local trust settings can block startup |
| GitHub Copilot CLI | ✓ | — | Good | Local config is straightforward |
| Other MCP hosts | — | — | Best effort | Validate transport support before relying on the server |

## Protocol Compatibility

The server supports MCP `2026-07-28` over stdio and stateless HTTP. SDK v2 compatibility handling also supports older clients; a host does not need to adopt the new protocol immediately. This server-side compatibility does not constitute a new review of each host listed above.

Modern HTTP requests carry protocol metadata individually and do not require `MCP-Session-Id`. Progress uses the originating POST response; standalone GET streams and DELETE session teardown are unsupported. Custom integrations that depend on session IDs must migrate. Remote deployments must configure their endpoint hostname in `ALLOWED_HOSTS` as well as any browser origins in `ALLOWED_ORIGINS`.

## Support Level Meanings

- `Good`: documented in this repo and expected to work with the current guidance
- `Best effort`: likely compatible in principle, but not covered by host-specific instructions here

## Notes By Host

### Claude Desktop

- Use local stdio
- Remote connector setup requires your own reachable HTTPS endpoint
- Remote connectors are added from `Settings -> Connectors`

### ChatGPT Developer Mode

- Requires remote HTTP or SSE
- Local binaries are not enough unless exposed through a reachable HTTPS endpoint
- Workspace or admin settings may affect availability

### Gemini CLI

- Local stdio works well
- Project trust settings may need attention if the folder is not trusted

### GitHub Copilot CLI

- Local MCP registration is simple
- New servers are typically available immediately after config update

## Recommendation

- Use a local stdio-capable client for package installation
- Remote-only clients require a self-hosted HTTPS endpoint; the project does not supply one
