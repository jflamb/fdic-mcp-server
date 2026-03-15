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
| Claude Desktop | Yes | Yes | Yes | Good | Hosted connector path is preferred when available |
| ChatGPT Developer Mode | No direct local stdio | Yes | Yes | Good | Requires reachable HTTPS MCP endpoint |
| Gemini CLI | Yes | Not documented here | Yes | Good | Local trust settings can block startup |
| GitHub Copilot CLI | Yes | Not documented here | Yes | Good | Local config is straightforward |
| Other MCP hosts | Varies | Varies | Generic only | Best effort | Validate transport support before relying on the server |

## Support Level Meanings

- `Good`: documented in this repo and expected to work with the current guidance
- `Best effort`: likely compatible in principle, but not covered by host-specific instructions here

## Notes By Host

### Claude Desktop

- Remote connector setup is supported and preferred when available
- Local stdio still works as a fallback path
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

- Use Claude Desktop or ChatGPT when you want the simplest hosted-URL setup
- Use Gemini CLI or GitHub Copilot CLI when you specifically want local stdio
