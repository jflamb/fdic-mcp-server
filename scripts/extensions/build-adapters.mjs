#!/usr/bin/env node

/**
 * Builds adapter outputs from canonical extension definitions.
 * Generation is kind-aware: persona, tool, and workflow extensions produce
 * different adapter shapes targeting different vendor surfaces.
 *
 *   persona   → Claude/Codex SKILL.md (instruction-first)
 *               Gemini gem.md (persona guide)
 *
 *   tool      → Claude connector/extension spec
 *               OpenAI connector spec
 *               Gemini integration guide
 *
 *   workflow  → Claude/Codex SKILL.md (multi-step task guide)
 *               OpenAI prompt pack
 *               Gemini agent guide
 *
 *   legacy capability → same outputs as before (backward compat)
 *
 * All generated files carry a GENERATED_BANNER.
 * Output is deterministic given the same inputs.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const ADAPTERS_DIR = join(ROOT, 'adapters');

// ── File discovery helper ────────────────────────────────────────────────

function listSubdirFiles(baseDir, filename) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(baseDir, d.name, filename))
    .filter(f => existsSync(f));
}

// ── Helpers ──────────────────────────────────────────────────────────────

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function loadText(filePath) {
  return readFileSync(filePath, 'utf-8');
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function relativeSource(kind, id) {
  switch (kind) {
    case 'persona':   return `extensions/personas/${id}/`;
    case 'tool':      return `extensions/tools/${id}/`;
    case 'workflow':  return `extensions/workflows/${id}/`;
    default:          return `extensions/capabilities/${id}/`;
  }
}

function generatedBanner(kind, id) {
  return `<!-- \u26a0\ufe0f GENERATED FILE \u2014 DO NOT EDIT MANUALLY
     Source: ${relativeSource(kind, id)}
     Generator: scripts/extensions/build-adapters.mjs
     Edit the canonical extension definition and re-run: npm run extensions:build -->

`;
}

function loadInstructionsText(manifest, dir) {
  if (!manifest.instructions?.system) return '';
  const p = resolve(dir, manifest.instructions.system);
  return existsSync(p) ? loadText(p) : '';
}

function commentedRefs(label, refs) {
  if (!refs?.length) return '';
  const lines = refs.map(r => `<!-- - ${r} -->`).join('\n');
  return `<!-- ${label} -->\n${lines}\n\n`;
}

// ── Persona adapters ──────────────────────────────────────────────────────
// Persona = instruction-first outputs. Claude/Codex get a SKILL.md with the
// persona instructions. Gemini gets a Gem guide with the same instructions.

function buildPersonaClaudeSkill(manifest, dir) {
  const id = manifest.id;
  const skillName = manifest.adapters?.claude?.skill_name;
  if (!skillName) return null;

  const instructions = loadInstructionsText(manifest, dir);
  const frontmatter = [
    '---',
    `name: ${skillName}`,
    `description: >`,
    `  ${manifest.summary}`,
    '---',
    '',
  ].join('\n');

  const content = [
    generatedBanner('persona', id),
    frontmatter,
    commentedRefs('Shared Context (from extensions/shared/context/)', manifest.instructions?.shared_context),
    commentedRefs('Policies (from extensions/shared/policies/)', manifest.instructions?.policies),
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'claude', 'skills', skillName, 'SKILL.md'), content };
}

function buildPersonaGeminiGem(manifest, dir) {
  const id = manifest.id;
  const gemName = manifest.adapters?.gemini?.gem_name || manifest.adapters?.gemini?.guide_name;
  if (!gemName) return null;

  const instructions = loadInstructionsText(manifest, dir);
  const content = [
    generatedBanner('persona', id),
    `# ${manifest.title}\n\n`,
    `> **Kind:** Persona (Gemini Gem)\n\n`,
    `${manifest.summary}\n\n`,
    `## Instructions\n\n`,
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'gemini', 'gems', `${gemName}.md`), content };
}

// ── Tool adapters ─────────────────────────────────────────────────────────
// Tool = integration/tool-bundle outputs.

function buildToolClaudeConnector(manifest, dir) {
  const id = manifest.id;
  const connectorName = manifest.adapters?.claude?.connector_name || manifest.adapters?.claude?.extension_name;
  if (!connectorName) return null;

  const usagePath = manifest.usage ? resolve(dir, manifest.usage) : null;
  const usageText = usagePath && existsSync(usagePath) ? loadText(usagePath) : '';

  const toolList = (manifest.tools?.mcp?.preferred || []).map(t => `- \`${t}\``).join('\n');

  const content = [
    generatedBanner('tool', id),
    `# ${manifest.title}\n\n`,
    `> **Kind:** Tool (Claude Connector / Desktop Extension)\n\n`,
    `${manifest.summary}\n\n`,
    `## Transport\n\n`,
    `\`${manifest.transport || 'stdio'}\`\n\n`,
    `## Tools Exposed\n\n`,
    toolList + '\n\n',
    usageText ? `## Usage\n\n${usageText}\n` : '',
  ].join('');

  return { path: join(ADAPTERS_DIR, 'claude', 'connectors', `${connectorName}.md`), content };
}

function buildToolOpenAIConnector(manifest) {
  const id = manifest.id;
  const connectorName = manifest.adapters?.openai?.connector_name || manifest.adapters?.openai?.app_name;
  if (!connectorName) return null;

  const toolList = (manifest.tools?.mcp?.preferred || []).map(t => `- \`${t}\``).join('\n');

  const content = [
    generatedBanner('tool', id),
    `# ${manifest.title}\n\n`,
    `> **Kind:** Tool (OpenAI Connector / App)\n\n`,
    `${manifest.summary}\n\n`,
    `## Tools Exposed\n\n`,
    toolList + '\n\n',
    `> Full connector spec stub \u2014 TBD.\n`,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'openai', 'connectors', `${connectorName}.md`), content };
}

function buildToolGeminiIntegration(manifest) {
  const id = manifest.id;
  const integName = manifest.adapters?.gemini?.integration_name;
  if (!integName) return null;

  const content = generatedBanner('tool', id)
    + `# ${manifest.title}\n\n`
    + `> **Kind:** Tool (Gemini Integration) \u2014 stub. Full generation TBD.\n\n`
    + `${manifest.summary}\n`;

  return { path: join(ADAPTERS_DIR, 'gemini', 'integrations', `${integName}.md`), content };
}

// ── Workflow adapters ─────────────────────────────────────────────────────
// Workflow = multi-step task guide. Claude/Codex get SKILL.md. OpenAI gets a
// prompt pack. Gemini gets an agent guide.

function buildWorkflowClaudeSkill(manifest, dir) {
  const id = manifest.id;
  const skillName = manifest.adapters?.claude?.skill_name;
  if (!skillName) return null;

  const instructions = loadInstructionsText(manifest, dir);
  const compositionNote = buildCompositionNote(manifest);

  const frontmatter = [
    '---',
    `name: ${skillName}`,
    `description: >`,
    `  ${manifest.summary}`,
    '---',
    '',
  ].join('\n');

  const content = [
    generatedBanner('workflow', id),
    frontmatter,
    commentedRefs('Shared Context (from extensions/shared/context/)', manifest.instructions?.shared_context),
    commentedRefs('Policies (from extensions/shared/policies/)', manifest.instructions?.policies),
    compositionNote,
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'claude', 'skills', skillName, 'SKILL.md'), content };
}

function buildWorkflowCodexSkill(manifest, dir) {
  const id = manifest.id;
  const skillName = manifest.adapters?.codex?.skill_name;
  if (!skillName) return null;

  const instructions = loadInstructionsText(manifest, dir);

  const content = [
    generatedBanner('workflow', id),
    `# ${manifest.title}\n\n`,
    `> **Kind:** Workflow (Codex Skill)\n\n`,
    `${manifest.summary}\n\n`,
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'codex', 'skills', skillName, 'SKILL.md'), content };
}

function buildWorkflowOpenAIPromptPack(manifest, dir) {
  const id = manifest.id;
  const packName = manifest.adapters?.openai?.prompt_pack;
  if (!packName) return null;

  const instructions = loadInstructionsText(manifest, dir);

  const content = [
    generatedBanner('workflow', id),
    `# ${manifest.title}\n\n`,
    `> **Kind:** Workflow (OpenAI Prompt Pack)\n\n`,
    `${manifest.summary}\n\n`,
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'openai', 'prompt-packs', `${packName}.md`), content };
}

function buildWorkflowGeminiAgentGuide(manifest, dir) {
  const id = manifest.id;
  const guideName = manifest.adapters?.gemini?.guide_name;
  if (!guideName) return null;

  const instructions = loadInstructionsText(manifest, dir);

  const content = [
    generatedBanner('workflow', id),
    `# ${manifest.title}\n\n`,
    `> **Kind:** Workflow (Gemini Agent Guide)\n\n`,
    `${manifest.summary}\n\n`,
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'gemini', 'agent-guides', `${guideName}.md`), content };
}

function buildCompositionNote(manifest) {
  const personas = manifest.composition?.personas || [];
  const tools = manifest.composition?.tools || [];
  if (!personas.length && !tools.length) return '';
  const lines = [
    '<!-- Composition: this workflow references the following canonical definitions -->',
  ];
  if (personas.length) lines.push(`<!-- Personas: ${personas.join(', ')} -->`);
  if (tools.length)    lines.push(`<!-- Tools: ${tools.join(', ')} -->`);
  return lines.join('\n') + '\n\n';
}

// ── Legacy capability adapter (backward compat) ───────────────────────────

function buildLegacyClaudeSkill(manifest, capDir) {
  const id = manifest.id;
  const skillName = manifest.adapters?.claude?.skill_name;
  if (!skillName) return null;

  const instructions = loadInstructionsText(manifest, capDir);

  const frontmatter = [
    '---',
    `name: ${skillName}`,
    `description: >`,
    `  ${manifest.summary}`,
    '---',
    '',
  ].join('\n');

  const content = [
    generatedBanner(null, id),
    frontmatter,
    commentedRefs('Shared Context (from extensions/shared/context/)', manifest.instructions?.shared_context),
    commentedRefs('Policies (from extensions/shared/policies/)', manifest.instructions?.policies),
    instructions,
  ].join('');

  return { path: join(ADAPTERS_DIR, 'claude', 'skills', skillName, 'SKILL.md'), content };
}

// ── Write output helper ───────────────────────────────────────────────────

function writeOutput(result, description) {
  if (!result) return 0;
  ensureDir(dirname(result.path));
  writeFileSync(result.path, result.content, 'utf-8');
  const relPath = result.path.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  console.log(`  \u2192 ${relPath}${description ? ` (${description})` : ''}`);
  return 1;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('Building adapters from canonical extensions...\n');
  let total = 0;

  // ── 1. Legacy capabilities (transitional — run FIRST so canonical overwrites)
  // Note: canonical adapters below deliberately overwrite legacy outputs for
  // any id that has been migrated to personas/workflows. This ensures the
  // canonical source wins without requiring manual cleanup of legacy entries.
  const legacyFiles = listSubdirFiles(join(ROOT, 'extensions', 'capabilities'), 'extension.json');
  if (legacyFiles.length > 0) {
    console.log('\nLegacy capabilities (transitional):');
    for (const mf of legacyFiles) {
      const manifest = loadJson(mf);
      const dir = dirname(mf);
      console.log(`  ${manifest.id}`);
      // Legacy capabilities use the old generation path but still emit a banner
      total += writeOutput(buildLegacyClaudeSkill(manifest, dir), 'Claude skill (legacy)');
      // Codex stub
      if (manifest.adapters?.codex?.skill_name) {
        const outPath = join(ADAPTERS_DIR, 'codex', 'skills', manifest.adapters.codex.skill_name, 'SKILL.md');
        ensureDir(dirname(outPath));
        writeFileSync(outPath,
          generatedBanner(null, manifest.id)
          + `# ${manifest.title}\n\n> Codex adapter \u2014 stub. Full generation TBD.\n\n${manifest.summary}\n`,
          'utf-8');
        console.log(`  \u2192 adapters/codex/skills/${manifest.adapters.codex.skill_name}/SKILL.md (Codex stub, legacy)`);
        total++;
      }
      // OpenAI stub
      if (manifest.adapters?.openai?.prompt_pack) {
        const outPath = join(ADAPTERS_DIR, 'openai', 'prompt-packs', `${manifest.adapters.openai.prompt_pack}.md`);
        ensureDir(dirname(outPath));
        writeFileSync(outPath,
          generatedBanner(null, manifest.id)
          + `# ${manifest.title}\n\n> OpenAI prompt pack \u2014 stub. Full generation TBD.\n\n${manifest.summary}\n`,
          'utf-8');
        console.log(`  \u2192 adapters/openai/prompt-packs/${manifest.adapters.openai.prompt_pack}.md (OpenAI stub, legacy)`);
        total++;
      }
      // Gemini stub
      if (manifest.adapters?.gemini?.guide_name) {
        const outPath = join(ADAPTERS_DIR, 'gemini', 'agent-guides', `${manifest.adapters.gemini.guide_name}.md`);
        ensureDir(dirname(outPath));
        writeFileSync(outPath,
          generatedBanner(null, manifest.id)
          + `# ${manifest.title}\n\n> Gemini agent guide \u2014 stub. Full generation TBD.\n\n${manifest.summary}\n`,
          'utf-8');
        console.log(`  \u2192 adapters/gemini/agent-guides/${manifest.adapters.gemini.guide_name}.md (Gemini stub, legacy)`);
        total++;
      }
    }
  }

  // ── 2. Personas (run after legacy so canonical wins for same skill names)
  const personaFiles = listSubdirFiles(join(ROOT, 'extensions', 'personas'), 'persona.json');
  if (personaFiles.length > 0) {
    console.log('\nPersonas (canonical):');
    for (const mf of personaFiles) {
      const manifest = loadJson(mf);
      const dir = dirname(mf);
      console.log(`  ${manifest.id}`);
      total += writeOutput(buildPersonaClaudeSkill(manifest, dir), 'Claude skill');
      total += writeOutput(buildPersonaGeminiGem(manifest, dir), 'Gemini Gem');
    }
  }

  // ── 3. Tools
  const toolFiles = listSubdirFiles(join(ROOT, 'extensions', 'tools'), 'tool.json');
  if (toolFiles.length > 0) {
    console.log('\nTools (canonical):');
    for (const mf of toolFiles) {
      const manifest = loadJson(mf);
      const dir = dirname(mf);
      console.log(`  ${manifest.id}`);
      total += writeOutput(buildToolClaudeConnector(manifest, dir), 'Claude connector');
      total += writeOutput(buildToolOpenAIConnector(manifest), 'OpenAI connector');
      total += writeOutput(buildToolGeminiIntegration(manifest), 'Gemini integration');
    }
  }

  // ── 4. Workflows (run last so canonical wins over legacy for same skill names)
  const workflowFiles = listSubdirFiles(join(ROOT, 'extensions', 'workflows'), 'workflow.json');
  if (workflowFiles.length > 0) {
    console.log('\nWorkflows (canonical):');
    for (const mf of workflowFiles) {
      const manifest = loadJson(mf);
      const dir = dirname(mf);
      console.log(`  ${manifest.id}`);
      total += writeOutput(buildWorkflowClaudeSkill(manifest, dir), 'Claude skill');
      total += writeOutput(buildWorkflowCodexSkill(manifest, dir), 'Codex skill');
      total += writeOutput(buildWorkflowOpenAIPromptPack(manifest, dir), 'OpenAI prompt pack');
      total += writeOutput(buildWorkflowGeminiAgentGuide(manifest, dir), 'Gemini agent guide');
    }
  }

  const sources = personaFiles.length + toolFiles.length + workflowFiles.length + legacyFiles.length;
  console.log(`\n\u2713 Generated ${total} adapter output(s) from ${sources} extension(s).`);
}

main();
