#!/usr/bin/env node

/**
 * Validates all extension manifests (persona, tool, workflow, and legacy capability)
 * against their kind-aware schemas, checks referential integrity, and verifies
 * cross-references between workflows, personas, and tools.
 *
 * Exit code 0 = all valid, non-zero = errors found.
 *
 * Supported layouts:
 *   extensions/personas/<id>/persona.json      — kind: persona
 *   extensions/tools/<id>/tool.json            — kind: tool
 *   extensions/workflows/<id>/workflow.json    — kind: workflow
 *   extensions/capabilities/<id>/extension.json — legacy (no kind required)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const EXT_DIR = join(ROOT, 'extensions');

// ── File discovery helpers ───────────────────────────────────────────────

function listSubdirFiles(baseDir, filename) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(baseDir, d.name, filename))
    .filter(f => existsSync(f));
}

function listDirFiles(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(ext))
    .map(f => join(dir, f));
}

function listEvalFiles(...baseDirs) {
  const results = [];
  for (const baseDir of baseDirs) {
    if (!existsSync(baseDir)) continue;
    for (const sub of readdirSync(baseDir, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const evalsDir = join(baseDir, sub.name, 'evals');
      if (!existsSync(evalsDir)) continue;
      for (const f of readdirSync(evalsDir)) {
        if (f.endsWith('.eval.json')) results.push(join(evalsDir, f));
      }
    }
  }
  return results;
}

// ── Known MCP tools exposed by this repo ────────────────────────────────
const KNOWN_TOOLS = new Set([
  'fdic_search_institutions',
  'fdic_get_institution',
  'fdic_search_failures',
  'fdic_get_institution_failure',
  'fdic_search_financials',
  'fdic_search_summary',
  'fdic_search_locations',
  'fdic_search_history',
  'fdic_search_sod',
  'fdic_search_demographics',
  'fdic_compare_bank_snapshots',
  'fdic_peer_group_analysis',
  'fdic_analyze_bank_health',
  'fdic_compare_peer_health',
  'fdic_detect_risk_signals',
  'fdic_analyze_credit_concentration',
  'fdic_analyze_funding_profile',
  'fdic_analyze_securities_portfolio',
  'fdic_ubpr_analysis',
  'fdic_market_share_analysis',
  'fdic_franchise_footprint',
  'fdic_holding_company_profile',
  'fdic_regional_context',
]);

let errors = 0;

function error(file, msg) {
  console.error(`  \u2717 ${file}: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`  \u26a0 ${file}: ${msg}`);
}

function info(msg) {
  console.log(`  \u2713 ${msg}`);
}

function rel(filePath) {
  return filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
}

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (e) {
    error(rel(filePath), `Failed to parse JSON: ${e.message}`);
    return null;
  }
}

// ── Common field validators ──────────────────────────────────────────────

function checkBaseFields(manifest, filePath) {
  const r = rel(filePath);
  for (const field of ['id', 'version', 'title', 'summary']) {
    if (!manifest[field]) error(r, `Missing required field: ${field}`);
  }
  if (manifest.id && !/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
    error(r, `Invalid id format: "${manifest.id}" (must be kebab-case)`);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    error(r, `Invalid version format: "${manifest.version}"`);
  }
}

function checkFileRef(manifestDir, relPath, label, filePath) {
  const r = rel(filePath);
  if (!existsSync(resolve(manifestDir, relPath))) {
    error(r, `${label} not found: ${relPath}`);
  }
}

function checkToolNames(toolList, context, filePath) {
  for (const toolName of toolList || []) {
    if (!KNOWN_TOOLS.has(toolName)) {
      error(rel(filePath), `Unknown MCP tool in ${context}: "${toolName}"`);
    }
  }
}

function checkInstructions(manifest, dir, filePath) {
  if (!manifest.instructions) return;
  const instr = manifest.instructions;
  if (instr.system) checkFileRef(dir, instr.system, 'Instructions system file', filePath);
  for (const ctx of instr.shared_context || []) checkFileRef(dir, ctx, 'Shared context file', filePath);
  for (const pol of instr.policies || []) checkFileRef(dir, pol, 'Policy file', filePath);
}

// ── Kind-specific validators ─────────────────────────────────────────────

function validatePersona(filePath) {
  const manifest = loadJson(filePath);
  if (!manifest) return null;
  const dir = dirname(filePath);
  const r = rel(filePath);

  checkBaseFields(manifest, filePath);

  if (!manifest.instructions) {
    error(r, 'Missing required field: instructions');
  } else {
    if (!manifest.instructions.system) error(r, 'instructions.system is required for persona');
    checkInstructions(manifest, dir, filePath);
  }

  for (const ex of manifest.examples || []) checkFileRef(dir, ex, 'Example file', filePath);
  for (const ev of manifest.evals || []) checkFileRef(dir, ev, 'Eval file', filePath);

  return manifest;
}

function validateTool(filePath) {
  const manifest = loadJson(filePath);
  if (!manifest) return null;
  const dir = dirname(filePath);
  const r = rel(filePath);

  checkBaseFields(manifest, filePath);

  if (!manifest.tools?.mcp) {
    error(r, 'Missing required field: tools.mcp');
  } else {
    checkToolNames(manifest.tools.mcp.preferred, 'preferred list', filePath);
    checkToolNames(manifest.tools.mcp.forbidden, 'forbidden list', filePath);
    for (const tsRef of manifest.tools.mcp.toolsets || []) {
      checkFileRef(dir, tsRef, 'Toolset file', filePath);
    }
  }

  if (manifest.usage) checkFileRef(dir, manifest.usage, 'Usage file', filePath);
  for (const ev of manifest.evals || []) checkFileRef(dir, ev, 'Eval file', filePath);

  return manifest;
}

function validateWorkflow(filePath, personaIds, toolIds) {
  const manifest = loadJson(filePath);
  if (!manifest) return null;
  const dir = dirname(filePath);
  const r = rel(filePath);

  checkBaseFields(manifest, filePath);

  if (!manifest.inputs) error(r, 'Missing required field: inputs');
  if (!manifest.outputs) error(r, 'Missing required field: outputs');
  if (!manifest.workflow) error(r, 'Missing required field: workflow');

  checkInstructions(manifest, dir, filePath);

  // Cross-reference: composition.personas
  for (const personaId of manifest.composition?.personas || []) {
    if (!personaIds.has(personaId)) {
      error(r, `Composition references unknown persona: "${personaId}"`);
    }
  }

  // Cross-reference: composition.tools
  for (const toolId of manifest.composition?.tools || []) {
    if (!toolIds.has(toolId)) {
      error(r, `Composition references unknown tool: "${toolId}"`);
    }
  }

  // Workflow step tool names
  for (const step of manifest.workflow?.steps || []) {
    checkToolNames(step.tools, `workflow step "${step.name}"`, filePath);
  }

  for (const ex of manifest.examples || []) checkFileRef(dir, ex, 'Example file', filePath);
  for (const ev of manifest.evals || []) checkFileRef(dir, ev, 'Eval file', filePath);

  return manifest;
}

function validateLegacyCapability(filePath) {
  const manifest = loadJson(filePath);
  if (!manifest) return null;
  const dir = dirname(filePath);
  const r = rel(filePath);

  // Same structural checks as the original validator
  for (const field of ['id', 'version', 'title', 'summary', 'instructions', 'tools', 'workflow']) {
    if (!manifest[field]) error(r, `Missing required field: ${field}`);
  }
  if (manifest.id && !/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
    error(r, `Invalid id format: "${manifest.id}" (must be kebab-case)`);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    error(r, `Invalid version format: "${manifest.version}"`);
  }

  checkInstructions(manifest, dir, filePath);

  checkToolNames(manifest.tools?.mcp?.preferred, 'preferred list', filePath);
  checkToolNames(manifest.tools?.mcp?.forbidden, 'forbidden list', filePath);
  for (const tsRef of manifest.tools?.mcp?.toolsets || []) {
    checkFileRef(dir, tsRef, 'Toolset file', filePath);
  }
  for (const step of manifest.workflow?.steps || []) {
    checkToolNames(step.tools, `workflow step "${step.name}"`, filePath);
  }
  for (const ex of manifest.examples || []) checkFileRef(dir, ex, 'Example file', filePath);
  for (const ev of manifest.evals || []) checkFileRef(dir, ev, 'Eval file', filePath);

  return manifest;
}

function validateEvalFixture(filePath) {
  const fixture = loadJson(filePath);
  if (!fixture) return;
  const r = rel(filePath);
  for (const field of ['id', 'prompt', 'expect']) {
    if (!fixture[field]) error(r, `Missing required field: ${field}`);
  }
  if (fixture.id && !/^[a-z][a-z0-9-]*$/.test(fixture.id)) {
    error(r, `Invalid eval id format: "${fixture.id}"`);
  }
  checkToolNames(fixture.expect?.required_tools, 'required_tools', filePath);
}

function validateToolset(filePath) {
  const toolset = loadJson(filePath);
  if (!toolset) return;
  const r = rel(filePath);
  for (const field of ['name', 'description', 'tools']) {
    if (!toolset[field]) error(r, `Missing required field: ${field}`);
  }
  checkToolNames(toolset.tools, 'toolset', filePath);
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  console.log('Validating extensions...\n');

  // 1. Toolsets
  console.log('Toolsets:');
  const toolsetFiles = listDirFiles(join(EXT_DIR, 'shared', 'toolsets'), '.json');
  if (toolsetFiles.length === 0) error('extensions/shared/toolsets/', 'No toolset files found');
  for (const f of toolsetFiles) { validateToolset(f); info(rel(f)); }

  // 2. Personas
  console.log('\nPersonas:');
  const personaFiles = listSubdirFiles(join(EXT_DIR, 'personas'), 'persona.json');
  const personaIds = new Set();
  for (const f of personaFiles) {
    const manifest = validatePersona(f);
    if (manifest?.id) personaIds.add(manifest.id);
    info(rel(f));
  }
  if (personaFiles.length === 0) console.log('  (none yet)');

  // 3. Tools
  console.log('\nTools:');
  const toolFiles = listSubdirFiles(join(EXT_DIR, 'tools'), 'tool.json');
  const toolDefIds = new Set();
  for (const f of toolFiles) {
    const manifest = validateTool(f);
    if (manifest?.id) toolDefIds.add(manifest.id);
    info(rel(f));
  }
  if (toolFiles.length === 0) console.log('  (none yet)');

  // 4. Workflows
  console.log('\nWorkflows:');
  const workflowFiles = listSubdirFiles(join(EXT_DIR, 'workflows'), 'workflow.json');
  const workflowIds = new Set();
  for (const f of workflowFiles) {
    const manifest = validateWorkflow(f, personaIds, toolDefIds);
    if (manifest?.id) {
      if (workflowIds.has(manifest.id)) error(rel(f), `Duplicate workflow id: "${manifest.id}"`);
      workflowIds.add(manifest.id);
    }
    info(rel(f));
  }
  if (workflowFiles.length === 0) console.log('  (none yet)');

  // 5. Legacy capabilities (backward compat)
  const legacyFiles = listSubdirFiles(join(EXT_DIR, 'capabilities'), 'extension.json');
  if (legacyFiles.length > 0) {
    console.log('\nLegacy capabilities (transitional):');
    const seenLegacyIds = new Set();
    for (const f of legacyFiles) {
      const manifest = validateLegacyCapability(f);
      if (manifest?.id) {
        if (seenLegacyIds.has(manifest.id)) error(rel(f), `Duplicate legacy id: "${manifest.id}"`);
        seenLegacyIds.add(manifest.id);
      }
      info(rel(f));
    }
  }

  // 6. Eval fixtures (all directories)
  console.log('\nEval fixtures:');
  const evalFiles = listEvalFiles(
    join(EXT_DIR, 'personas'),
    join(EXT_DIR, 'tools'),
    join(EXT_DIR, 'workflows'),
    join(EXT_DIR, 'capabilities'),
  );
  for (const f of evalFiles) { validateEvalFixture(f); info(rel(f)); }
  if (evalFiles.length === 0) console.log('  (none yet)');

  // Summary
  const summary = errors === 0
    ? '\u2713 All extensions valid.'
    : `\u2717 ${errors} error(s) found.`;
  console.log(`\n${summary}`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
