---
title: Support
nav_group: project
kicker: Project Info
summary: Where to get help, what to include in an issue, and which checks to perform before filing a bug or prompt-quality report.
breadcrumbs:
  - title: Overview
    url: /
  - title: Project Info
    url: /project-information/
---

## Get Help

- Open a GitHub issue for bugs, documentation problems, or feature requests: <https://github.com/jflamb/fdic-mcp-server/issues>
- Review the documentation entry point at [Overview]({{ '/' | relative_url }})
- Check [Usage Examples]({{ '/usage-examples/' | relative_url }}) and [Prompting Guide]({{ '/prompting-guide/' | relative_url }}) before filing prompt-quality issues

## What To Include In An Issue

- the MCP host you used
- whether you ran the server over stdio or HTTP
- the exact prompt or tool arguments involved
- the expected behavior
- the actual behavior
- relevant logs or error messages

## Troubleshooting Checklist

- Confirm you are using Node.js 20 or later.
- Confirm the MCP host supports the transport you configured.
- If using ChatGPT, confirm the server is exposed over reachable HTTPS rather than local stdio only.
- If using a packaged install, confirm the binary path in the client config is correct.
- If results look wrong, confirm the report date basis and dataset match your question.
