# Extension System

## Why It Exists

The FDIC MCP server includes AI-assisted analysis capabilities (historically called "skills") that orchestrate MCP tools into structured analytical workflows. These capabilities were originally authored as flat, Claude-specific `.agents/skills/*/SKILL.md` files.

The extension system provides a **vendor-neutral, machine-validatable, kind-aware layer** that becomes the canonical source of truth. Benefits:

- **Cross-model support:** Generate adapter outputs for Claude, Codex, OpenAI, Gemini, and future environments from a single definition.
- **Kind-aware design:** Extensions are explicitly `persona`, `tool`, or `workflow` — matching real product surfaces.
- **Schema validation:** JSON manifests enable automated validation of structure, cross-references, and tool names.
- **Composition:** Workflows declare which personas and tools they depend on — no duplication.
- **Shared context:** FDIC data rules live once in shared files, not repeated in every extension.
- **Deterministic generation:** Adapter outputs are generated, not hand-authored.

---

## The Three Kinds

| Kind | What it models | Real product analogs |
|---|---|---|
| `persona` | A reusable instruction bundle — how the model should reason or behave | Gemini Gems, Claude/Codex skill personas |
| `tool` | A reusable MCP tool integration bundle | Claude Connectors, Claude Desktop Extensions, ChatGPT Apps/Connectors |
| `workflow` | A multi-step procedural capability | Claude/Codex skill-like operating guides, multi-step prompt surfaces |

### Persona
A `persona` is instruction-first. It defines behavioral rules, output style, anti-patterns, and constraints — but no tool execution or ordered steps. Personas are consumed by workflows (via `composition.personas`) or used standalone as Gems / skill personas.

### Tool
A `tool` is integration-first. It declares which MCP tools are available as a named bundle, how to authenticate (if needed), and what transport the server uses. Tool definitions become Claude Connector specs, OpenAI connector manifests, and Gemini integration guides.

### Workflow
A `workflow` is procedure-first. It has ordered steps, required inputs, expected outputs, and declares which personas and tools it composes. Workflows are the primary surface for complex multi-tool analytical capabilities.

---

## Composition Model

A workflow references personas and tools by ID in its `composition` block:

```json
{
  "composition": {
    "personas": ["fdic-skill-builder"],
    "tools": ["fdic-core-mcp", "fdic-analysis-mcp"]
  }
}
```

The validator verifies that every referenced ID exists as a canonical definition. This means:
- Behavioral rules from personas are not duplicated in the workflow manifest.
- Tool availability from tool bundles is not redeclared in the workflow.
- The workflow can be understood by reading just the workflow instructions, knowing it inherits the rules from its composed persona.

---

## Canonical vs. Generated vs. Transitional

| Path | Status | Edit? |
|---|---|---|
| `extensions/personas/`, `extensions/tools/`, `extensions/workflows/` | **Canonical** | Yes — source of truth |
| `extensions/shared/` | **Canonical** | Yes — shared rules and toolsets |
| `extensions/schema/` | **Canonical** | Yes — JSON schemas |
| `adapters/` | **Generated** | No — run `npm run extensions:build` to regenerate |
| `extensions/capabilities/` | **Transitional / Legacy** | No new entries — see migration section |
| `.agents/skills/*/SKILL.md` | **Transitional** | No — generated from canonical sources |

---

## Directory Structure

```
extensions/
  schema/
    extension.schema.json     # Legacy base schema (retained for backward compat)
    persona.schema.json       # Kind: persona
    tool.schema.json          # Kind: tool
    workflow.schema.json      # Kind: workflow
    eval.schema.json          # Eval fixture schema
    toolset.schema.json       # Toolset schema
  shared/
    context/                  # FDIC data rules shared across extensions
      fdic-date-basis.md
      fdic-units.md
      fdic-cert-identity.md
      repo-tool-contracts.md
    policies/
      temporal-accuracy.md
      graceful-degradation.md
      source-attribution.md
    toolsets/
      fdic-core.json
      fdic-analysis.json
  personas/
    <id>/
      persona.json
      instructions.md
      examples/
      evals/
  tools/
    <id>/
      tool.json
      usage.md
      evals/
  workflows/
    <id>/
      workflow.json
      instructions.md
      examples/
      evals/
  capabilities/               # Legacy — transitional only

adapters/
  claude/
    skills/                   # Persona + workflow → Claude SKILL.md
    connectors/               # Tool → Claude Connector / Desktop Extension spec
  codex/
    skills/                   # Workflow → Codex skill
  openai/
    prompt-packs/             # Workflow → OpenAI prompt pack
    connectors/               # Tool → OpenAI Connector spec
  gemini/
    gems/                     # Persona → Gemini Gem guide
    agent-guides/             # Workflow → Gemini agent guide
    integrations/             # Tool → Gemini integration guide

scripts/extensions/
  validate-extensions.mjs     # Kind-aware validator with cross-reference checking
  build-adapters.mjs          # Kind-aware adapter generation

tests/extensions/
  persona-schema.test.ts
  tool-schema.test.ts
  workflow-schema.test.ts
  cross-reference.test.ts
  extension-schema.test.ts    # Legacy capability tests (backward compat)
  adapter-build.test.ts       # Generation determinism and output tests
```

---

## Manifest Anatomy

### Persona manifest (`persona.json`)

```json
{
  "id": "fdic-skill-builder",
  "kind": "persona",
  "version": "1.0.0",
  "title": "...",
  "summary": "...",
  "instructions": {
    "system": "instructions.md",
    "shared_context": ["../../shared/context/fdic-date-basis.md"],
    "policies": ["../../shared/policies/temporal-accuracy.md"]
  },
  "output_style": "supervisory-safe markdown",
  "anti_patterns": ["Writing content before contract verification"],
  "adapters": {
    "claude": { "skill_name": "fdic-skill-builder" },
    "gemini": { "gem_name": "fdic-skill-builder" }
  }
}
```

### Tool manifest (`tool.json`)

```json
{
  "id": "fdic-core-mcp",
  "kind": "tool",
  "version": "1.0.0",
  "title": "...",
  "summary": "...",
  "tools": {
    "mcp": {
      "toolsets": ["../../shared/toolsets/fdic-core.json"],
      "preferred": ["fdic_search_institutions", "..."],
      "forbidden": []
    }
  },
  "auth": null,
  "transport": "stdio",
  "adapters": {
    "claude": { "connector_name": "fdic-core-mcp" },
    "openai": { "connector_name": "fdic-core-mcp" }
  }
}
```

### Workflow manifest (`workflow.json`)

```json
{
  "id": "fdic-failure-forensics",
  "kind": "workflow",
  "version": "1.0.0",
  "title": "...",
  "summary": "...",
  "composition": {
    "personas": ["fdic-skill-builder"],
    "tools": ["fdic-core-mcp", "fdic-analysis-mcp"]
  },
  "inputs": { "required": [...], "optional": [...] },
  "outputs": { "primary": "...", "format": "markdown" },
  "workflow": {
    "steps": [
      { "name": "...", "tools": ["fdic_search_institutions"], "required": true }
    ],
    "stop_conditions": [...]
  },
  "adapters": {
    "claude": { "skill_name": "fdic-failure-forensics" },
    "openai": { "prompt_pack": "fdic-failure-forensics" }
  }
}
```

---

## Adapter Generation

Running `npm run extensions:build`:

1. **Legacy capabilities** generate first (backward compat output).
2. **Personas** generate next — overwriting legacy outputs for the same adapter target.
3. **Tools** generate next — new connector/integration surfaces only.
4. **Workflows** generate last — canonical outputs win over legacy for the same skill name.

| Kind | Claude | Codex | OpenAI | Gemini |
|---|---|---|---|---|
| `persona` | `skills/<id>/SKILL.md` (instruction-first) | — | — | `gems/<id>.md` |
| `tool` | `connectors/<id>.md` | — | `connectors/<id>.md` | `integrations/<id>.md` |
| `workflow` | `skills/<id>/SKILL.md` (multi-step guide) | `skills/<id>/SKILL.md` | `prompt-packs/<id>.md` | `agent-guides/<id>.md` |

All generated files carry a banner pointing to the canonical source and generator script.

---

## Shared Context and Policies

FDIC data rules are shared, not duplicated. Extensions reference these files by relative path:

- `extensions/shared/context/fdic-date-basis.md` — quarterly/annual date conventions
- `extensions/shared/context/fdic-units.md` — $K dollar amounts
- `extensions/shared/context/fdic-cert-identity.md` — CERT resolution rules
- `extensions/shared/context/repo-tool-contracts.md` — MCP tool contract rules
- `extensions/shared/policies/temporal-accuracy.md` — exact dates, staleness caveats
- `extensions/shared/policies/graceful-degradation.md` — three outcome states
- `extensions/shared/policies/source-attribution.md` — proxy disclaimers

---

## Migration Status

### Canonical — live today, source of record
All five entries below exist on disk now under their canonical paths. These are the authoritative source files; adapters are generated from them.

| ID | Kind | Canonical path (live today) |
|---|---|---|
| `fdic-skill-builder` | `persona` | `extensions/personas/fdic-skill-builder/` |
| `fdic-core-mcp` | `tool` | `extensions/tools/fdic-core-mcp/` |
| `fdic-analysis-mcp` | `tool` | `extensions/tools/fdic-analysis-mcp/` |
| `fdic-failure-forensics` | `workflow` | `extensions/workflows/fdic-failure-forensics/` |
| `fdic-portfolio-surveillance` | `workflow` | `extensions/workflows/fdic-portfolio-surveillance/` |

### Retained for backward compatibility only
These `capabilities/` paths also exist on disk today but are **not** the source of record. They exist solely so that any tooling that references the old layout continues to work. The adapter builder runs them first, then overwrites with the canonical output above.

| ID | Legacy path | Source of record |
|---|---|---|
| `fdic-failure-forensics` | `extensions/capabilities/fdic-failure-forensics/` | `extensions/workflows/fdic-failure-forensics/` |
| `fdic-portfolio-surveillance` | `extensions/capabilities/fdic-portfolio-surveillance/` | `extensions/workflows/fdic-portfolio-surveillance/` |
| `fdic-skill-builder` | `extensions/capabilities/fdic-skill-builder/` | `extensions/personas/fdic-skill-builder/` |

### Not yet migrated
| ID | Location | Notes |
|---|---|---|
| `fdic-mcp-server` | `.agents/skills/fdic-mcp-server/` | Repo conventions skill; may not need migration |

### Rules
- Do not add new entries to `extensions/capabilities/`. All new extensions go in the canonical kind directories.
- For any ID that exists in both locations, the canonical adapter wins (builder runs legacy first, canonical last, last write wins).
- Once the canonical equivalents are confirmed complete, the `capabilities/` entries can be deleted.

---

## How to Add a New Extension

**Decide the kind** using the table above.

**Persona:**
```bash
mkdir -p extensions/personas/<id>
# create persona.json, instructions.md, examples/
npm run extensions:validate
npm run extensions:build
```

**Tool:**
```bash
mkdir -p extensions/tools/<id>
# create tool.json, usage.md
npm run extensions:validate
npm run extensions:build
```

**Workflow:**
```bash
mkdir -p extensions/workflows/<id>
# create workflow.json (declare composition.personas + composition.tools)
# create instructions.md, examples/, evals/
npm run extensions:validate
npm run extensions:build
npm test
```

---

## Validation

`npm run extensions:validate` checks:

- All toolsets: field presence, tool name validity
- All personas: required fields, instruction/context/policy file existence
- All tools: required fields, tool name validity, toolset references
- All workflows: required fields, instruction/context/policy/example/eval file existence, workflow step tool names, **cross-references** (composition.personas[] and composition.tools[] must exist as canonical definitions)
- All legacy capabilities: same structural checks as before
- All eval fixtures: field presence, tool name validity
- ID uniqueness per kind

---

## CI Integration

Both `extensions:validate` and `extensions:build` are wired as npm scripts. To add to CI:

```bash
npm run extensions:validate
```

TODO: Wire `extensions:validate` into the CI pipeline alongside `typecheck`, `test`, and `build`.
