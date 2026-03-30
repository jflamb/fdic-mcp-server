# Repo Tool Contracts

Extensions must respect the MCP tool contracts exposed by this repository.

## General Rules

1. **Skills orchestrate; servers compute.** Extensions must not re-implement logic that belongs in a tool. If a derived value is needed, call the tool that computes it.

2. **Do not describe tool behavior you cannot observe.** If you need a tool to return a new field, the server tool must be updated first.

3. **Field names are case-sensitive.** Use exact field names from `src/fdicEndpointMetadata.ts`.

4. **Output path fidelity:** Extensions referencing `structuredContent` paths must use verified paths from actual tool responses, not guesses.

## Dependency Tiers

Every tool in an extension's workflow must have an assigned tier:

| Tier | Definition | On Failure |
|---|---|---|
| **Hard** | Output cannot be produced without this data | Stop and report the error |
| **Soft** | Output degrades but remains useful | Omit the section; note the omission |
| **Context** | Enriches output; not load-bearing | Silently omit if unavailable |
