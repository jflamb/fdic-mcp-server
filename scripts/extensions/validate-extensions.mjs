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

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { glob } from 'node:fs/promises';

const ROOT = resolve(import.meta.dirname, '..', '..');
const EXT_DIR = join(ROOT, 'extensions');

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
  console.error(`  ✗ ${file}: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`  ⚠ ${file}: ${msg}`);
}

function info(msg) {
  console.log(`  ✓ ${msg}`);
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

async function main() {
  console.log('Validating extensions...\n');

  // 1. Toolsets
  console.log('Toolsets:');
  const toolsetFiles = [];
  for await (const f of glob('extensions/shared/toolsets/*.json', { cwd: ROOT })) {
    toolsetFiles.push(join(ROOT, f));
  }
  if (toolsetFiles.length === 0) error('extensions/shared/toolsets/', 'No toolset files found');
  for (const f of toolsetFiles) { validateToolset(f); info(rel(f)); }

  // 2. Personas
  console.log('\nPersonas:');
  const personaFiles = [];
  for await (const f of glob('extensions/personas/*/persona.json', { cwd: ROOT })) {
    personaFiles.push(join(ROOT, f));
  }
  const personaIds = new Set();
  for (const f of personaFiles) {
    const manifest = validatePersona(f);
    if (manifest?.id) personaIds.add(manifest.id);
    info(rel(f));
  }
  if (personaFiles.length === 0) console.log('  (none yet)');

  // 3. Tools
  console.log('\nTools:');
  const toolFiles = [];
  for await (const f of glob('extensions/tools/*/tool.json', { cwd: ROOT })) {
    toolFiles.push(join(ROOT, f));
  }
  const toolDefIds = new Set();
  for (const f of toolFiles) {
    const manifest = validateTool(f);
    if (manifest?.id) toolDefIds.add(manifest.id);
    info(rel(f));
  }
  if (toolFiles.length === 0) console.log('  (none yet)');

  // 4. Workflows
  console.log('\nWorkflows:');
  const workflowFiles = [];
  for await (const f of glob('extensions/workflows/*/workflow.json', { cwd: ROOT })) {
    workflowFiles.push(join(ROOT, f));
  }
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
  const legacyFiles = [];
  for await (const f of glob('extensions/capabilities/*/extension.json', { cwd: ROOT })) {
    legacyFiles.push(join(ROOT, f));
  }
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
  const evalFiles = [];
  for await (const f of glob('extensions/{personas,tools,workflows,capabilities}/*/evals/*.eval.json', { cwd: ROOT })) {
    evalFiles.push(join(ROOT, f));
  }
  for (const f of evalFiles) { validateEvalFixture(f); info(rel(f)); }
  if (evalFiles.length === 0) console.log('  (none yet)');

  // Summary
  console.log(`\n${errors === 0 ? '✓ All extensions valid.' : `✗ ${errors} error(s) found.`}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
