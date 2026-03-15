---
title: FDIC BankFind MCP Server Docs
---

# FDIC BankFind MCP Server

Documentation for the MCP server that exposes the FDIC BankFind Suite API as LLM-friendly tools and server-side analysis workflows.

## Start Here

- [Getting Started](./getting-started.md): install the package, run the server, and connect it to an MCP client
- [Prompting Guide](./prompting-guide.md): write reliable prompts that work with FDIC data and this server's toolset
- [Usage Examples](./usage-examples.md): copyable examples for search, comparison, and peer analysis workflows
- [Tool Reference](./tool-reference.md): quick guidance on which MCP tool to use for which job
- [Client Setup](./clients.md): client-specific setup notes for Claude Desktop, ChatGPT, Gemini CLI, and GitHub Copilot CLI
- [Troubleshooting And FAQ](./troubleshooting.md): common setup and data questions, plus targeted fixes
- [Compatibility Matrix](./compatibility-matrix.md): quick support snapshot by MCP host

## Technical Documentation

- [Technical Specification](./technical/specification.md): architecture, transport model, tool surface, and data contracts
- [Architecture](./technical/architecture.md): code layout and request flow
- [Key Decisions](./technical/decisions.md): important design choices and why they were made

## Project Information

- [Release Notes](./release-notes/index.md): versioned changes and upgrade notes
- [Support](./support.md): where to get help and how to report issues
- [Contributing](./contributing.md): contributor workflow and validation expectations
- [Security](./security.md): vulnerability reporting expectations and security scope

## Documentation Scope

This documentation is organized for three audiences:

- MCP users who need fast setup and practical prompt examples
- maintainers and contributors who need architecture and decision context
- evaluators comparing the server's capabilities, release history, and support model
