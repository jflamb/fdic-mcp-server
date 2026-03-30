# Extensions

This directory contains the **canonical, vendor-neutral extension definitions** for AI-assisted FDIC analysis capabilities.

Extensions are kind-aware: every extension is explicitly a `persona`, `tool`, or `workflow`.

## Quick Start

```bash
# Validate all extensions (schemas, references, tool names)
npm run extensions:validate

# Build adapter outputs (Claude skills, connectors, Gemini Gems, etc.)
npm run extensions:build
```

## Which Kind Should I Create?

| I want to... | Create a... | Example |
|---|---|---|
| Define how an AI model should *reason* in a domain | `persona` | `fdic-skill-builder` — enforces FDIC data rules and three-outcome-state discipline |
| Expose a group of MCP tools as a reusable bundle | `tool` | `fdic-core-mcp` — core FDIC data retrieval tools |
| Describe a multi-step procedural workflow | `workflow` | `fdic-failure-forensics` — 5-phase failure reconstruction |

**Decision guide:**
- If it's about *behavior and instructions* with no tool execution → `persona`
- If it's about *what tools are available* without a procedure → `tool`
- If it's *ordered steps* that consume tools and produce a report → `workflow`

## Directory Layout

```
extensions/
  schema/
    extension.schema.json     # Legacy base schema (backward compat)
    persona.schema.json       # Kind: persona
    tool.schema.json          # Kind: tool
    workflow.schema.json      # Kind: workflow
    eval.schema.json          # Eval fixture schema (all kinds)
    toolset.schema.json       # Toolset schema

  personas/
    <id>/
      persona.json            # Manifest (kind: persona)
      instructions.md         # Behavioral instructions
      examples/
      evals/

  tools/
    <id>/
      tool.json               # Manifest (kind: tool)
      usage.md                # Usage guide
      evals/

  workflows/
    <id>/
      workflow.json           # Manifest (kind: workflow)
      instructions.md         # Workflow instructions
      examples/
      evals/

  shared/
    context/                  # FDIC data rules shared across all kinds
    policies/                 # Behavioral policies
    toolsets/                 # Named MCP tool groups

  capabilities/               # LEGACY — transitional only; do not add new entries
    <id>/extension.json
```

## Adding a New Extension

### Persona
1. Create `extensions/personas/<id>/persona.json` using `schema/persona.schema.json`.
2. Write `instructions.md` with behavioral instructions.
3. Reference shared context and policies via relative paths.
4. Add at least one example.

### Tool
1. Create `extensions/tools/<id>/tool.json` using `schema/tool.schema.json`.
2. Write `usage.md` describing the tool bundle.
3. List only real MCP tools in `tools.mcp.preferred`.

### Workflow
1. Create `extensions/workflows/<id>/workflow.json` using `schema/workflow.schema.json`.
2. Declare `composition.personas[]` and `composition.tools[]` by ID.
3. Write `instructions.md` with the step-by-step procedure.
4. Add at least one example and one eval fixture.

### After adding any kind
```bash
npm run extensions:validate   # must pass
npm run extensions:build      # generates adapters
npm test                      # extension tests must pass
```

## Key Rules

- **`extensions/` is the source of truth.** Do not hand-edit files under `adapters/`.
- **`capabilities/` is transitional.** Do not add new entries there; use `personas/`, `tools/`, or `workflows/` instead.
- **Canonical wins over legacy** during adapter generation — canonical outputs overwrite legacy outputs for the same adapter target.
- **Shared context and policies are not duplicated.** Reference them by relative path in manifests.
- **Tool names must match real MCP tools.** The validator enforces this.

See [reference/extension-system.md](../reference/extension-system.md) for the full design rationale and migration guide.
