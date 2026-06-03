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

Last reviewed: June 3, 2026.

| Host | Local Stdio | Remote HTTP | Plugin / Skills | Support | Notes |
|------|:-----------:|:-----------:|:---------------:|:-------:|-------|
| Codex | ✓ | ✓ | ✓ | Good | Local plugin can bundle the hosted or local server with Codex skills |
| Claude Code | ✓ | ✓ | ✓ | Good | Plugin install can include hosted MCP tools and Claude Code skills |
| Claude Desktop | ✓ | ✓ | — | Good | Hosted connector path is preferred when available |
| ChatGPT Developer Mode | ✗ | ✓ | — | Good | Requires reachable HTTPS MCP endpoint |
| Gemini CLI | ✓ | ✓ | — | Good | Local trust settings can block startup |
| GitHub Copilot CLI | ✓ | — | — | Good | Local config is straightforward |
| Other MCP hosts | — | — | — | Best effort | Validate transport support before relying on the server |

## Support Level Meanings

- `Good`: documented in this repo and expected to work with the current guidance
- `Best effort`: likely compatible in principle, but not covered by host-specific instructions here

## Notes By Host

### Codex

- Local plugin setup can package `.mcp.json` and `skills/` together
- Hosted HTTP is the simplest plugin path when local source changes are not needed
- The local stdio server should launch from a built checkout when testing source changes
- Use this path when Codex needs the FDIC tools and the repository-specific workflows in the same session

### Claude Code

- Plugin setup can install MCP tools and Claude Code skills together
- Hosted MCP tools are preferred when you do not need local development changes
- Local stdio can still be configured for source-checkout testing

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
- Use Codex or Claude Code when you want plugin-packaged skills alongside MCP tools
- Use Gemini CLI or GitHub Copilot CLI when you specifically want local stdio without plugin workflows
