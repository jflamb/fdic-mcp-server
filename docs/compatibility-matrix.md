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

This matrix summarizes the level of setup guidance and expected support for common MCP hosts documented in this repository.

Last reviewed: March 15, 2026.

| Host | Local Stdio | Remote HTTP | Documented Here | Support Level | Notes |
|------|-------------|-------------|-----------------|---------------|-------|
| Claude Desktop | Yes | No documented path here | Yes | Good | Best fit for local stdio setups |
| ChatGPT Developer Mode | No direct local stdio | Yes | Yes | Good | Requires reachable HTTPS MCP endpoint |
| Gemini CLI | Yes | Not documented here | Yes | Good | Local trust settings can block startup |
| GitHub Copilot CLI | Yes | Not documented here | Yes | Good | Local config is straightforward |
| Other MCP hosts | Varies | Varies | Generic only | Best effort | Validate transport support before relying on the server |

## Support Level Meanings

- `Good`: documented in this repo and expected to work with the current guidance
- `Best effort`: likely compatible in principle, but not covered by host-specific instructions here

## Notes By Host

### Claude Desktop

- Uses local stdio configuration
- Restart required after config changes

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

- Use Claude Desktop, Gemini CLI, or GitHub Copilot CLI for the simplest local setup
- Use ChatGPT when you want a remotely hosted MCP app and are prepared to run HTTP transport
