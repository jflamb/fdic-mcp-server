import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const WORKFLOWS_DIR = resolve(ROOT, 'extensions', 'workflows');

const KNOWN_TOOLS = new Set([
  'fdic_search_institutions', 'fdic_get_institution', 'fdic_search_failures',
  'fdic_get_institution_failure', 'fdic_search_financials', 'fdic_search_summary',
  'fdic_search_locations', 'fdic_search_history', 'fdic_search_sod',
  'fdic_search_demographics', 'fdic_compare_bank_snapshots', 'fdic_peer_group_analysis',
  'fdic_analyze_bank_health', 'fdic_compare_peer_health', 'fdic_detect_risk_signals',
  'fdic_analyze_credit_concentration', 'fdic_analyze_funding_profile',
  'fdic_analyze_securities_portfolio', 'fdic_ubpr_analysis', 'fdic_market_share_analysis',
  'fdic_franchise_footprint', 'fdic_holding_company_profile', 'fdic_regional_context',
]);

function loadWorkflow(id: string) {
  return JSON.parse(readFileSync(resolve(WORKFLOWS_DIR, id, 'workflow.json'), 'utf-8'));
}

describe('Workflow schema validation', () => {
  const workflowIds = ['fdic-failure-forensics', 'fdic-portfolio-surveillance'];

  for (const id of workflowIds) {
    describe(id, () => {
      it('has kind = workflow', () => {
        expect(loadWorkflow(id).kind).toBe('workflow');
      });

      it('has all required fields', () => {
        const manifest = loadWorkflow(id);
        expect(manifest.id).toBe(id);
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(manifest.title).toBeTruthy();
        expect(manifest.summary).toBeTruthy();
        expect(manifest.inputs).toBeTruthy();
        expect(manifest.outputs).toBeTruthy();
        expect(manifest.workflow).toBeTruthy();
        expect(manifest.workflow.steps).toBeInstanceOf(Array);
        expect(manifest.workflow.steps.length).toBeGreaterThan(0);
      });

      it('instructions.system file exists', () => {
        const manifest = loadWorkflow(id);
        const dir = resolve(WORKFLOWS_DIR, id);
        if (manifest.instructions?.system) {
          expect(existsSync(resolve(dir, manifest.instructions.system))).toBe(true);
        }
      });

      it('all shared_context files exist', () => {
        const manifest = loadWorkflow(id);
        const dir = resolve(WORKFLOWS_DIR, id);
        for (const ctx of manifest.instructions?.shared_context || []) {
          expect(existsSync(resolve(dir, ctx)), `Missing: ${ctx}`).toBe(true);
        }
      });

      it('all policy files exist', () => {
        const manifest = loadWorkflow(id);
        const dir = resolve(WORKFLOWS_DIR, id);
        for (const pol of manifest.instructions?.policies || []) {
          expect(existsSync(resolve(dir, pol)), `Missing: ${pol}`).toBe(true);
        }
      });

      it('all example files exist', () => {
        const manifest = loadWorkflow(id);
        const dir = resolve(WORKFLOWS_DIR, id);
        for (const ex of manifest.examples || []) {
          expect(existsSync(resolve(dir, ex)), `Missing: ${ex}`).toBe(true);
        }
      });

      it('all eval files exist', () => {
        const manifest = loadWorkflow(id);
        const dir = resolve(WORKFLOWS_DIR, id);
        for (const ev of manifest.evals || []) {
          expect(existsSync(resolve(dir, ev)), `Missing: ${ev}`).toBe(true);
        }
      });

      it('all workflow step tools are known MCP tools', () => {
        const manifest = loadWorkflow(id);
        for (const step of manifest.workflow?.steps || []) {
          for (const toolName of step.tools || []) {
            expect(KNOWN_TOOLS.has(toolName), `Unknown tool in step "${step.name}": ${toolName}`).toBe(true);
          }
        }
      });

      it('has composition with personas and tools', () => {
        const manifest = loadWorkflow(id);
        expect(manifest.composition).toBeTruthy();
        expect(manifest.composition.personas).toBeInstanceOf(Array);
        expect(manifest.composition.tools).toBeInstanceOf(Array);
      });

      it('has required inputs', () => {
        const manifest = loadWorkflow(id);
        expect(manifest.inputs.required).toBeInstanceOf(Array);
        expect(manifest.inputs.required.length).toBeGreaterThan(0);
      });
    });
  }

  it('rejects a malformed workflow fixture', () => {
    const bad = { id: 'ok-id', kind: 'workflow', version: '1.0.0' };
    expect(bad).not.toHaveProperty('inputs');
    expect(bad).not.toHaveProperty('outputs');
    expect(bad).not.toHaveProperty('workflow');
    expect(bad).not.toHaveProperty('summary');
  });

  it('has unique workflow ids', () => {
    const ids = workflowIds.map(id => loadWorkflow(id).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
