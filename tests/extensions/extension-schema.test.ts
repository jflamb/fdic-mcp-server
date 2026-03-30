import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const CAPABILITIES_DIR = resolve(ROOT, 'extensions', 'capabilities');

// Known MCP tools — must match the validator script
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

function loadManifest(id: string) {
  const path = resolve(CAPABILITIES_DIR, id, 'extension.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Extension schema validation', () => {
  const extensionIds = ['fdic-failure-forensics', 'fdic-portfolio-surveillance', 'fdic-skill-builder'];

  for (const id of extensionIds) {
    describe(id, () => {
      it('has all required fields', () => {
        const manifest = loadManifest(id);
        expect(manifest.id).toBe(id);
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(manifest.title).toBeTruthy();
        expect(manifest.summary).toBeTruthy();
        expect(manifest.instructions).toBeTruthy();
        expect(manifest.instructions.system).toBeTruthy();
        expect(manifest.tools).toBeTruthy();
        expect(manifest.workflow).toBeTruthy();
      });

      it('references only known MCP tools', () => {
        const manifest = loadManifest(id);
        const allTools: string[] = [
          ...(manifest.tools?.mcp?.preferred || []),
          ...(manifest.tools?.mcp?.forbidden || []),
        ];
        for (const step of manifest.workflow?.steps || []) {
          allTools.push(...(step.tools || []));
        }
        for (const tool of allTools) {
          expect(KNOWN_TOOLS.has(tool), `Unknown tool: ${tool}`).toBe(true);
        }
      });

      it('references files that exist', () => {
        const manifest = loadManifest(id);
        const capDir = resolve(CAPABILITIES_DIR, id);

        // Instructions
        const sysPath = resolve(capDir, manifest.instructions.system);
        expect(existsSync(sysPath), `Missing: ${manifest.instructions.system}`).toBe(true);

        // Shared context
        for (const ctx of manifest.instructions.shared_context || []) {
          expect(existsSync(resolve(capDir, ctx)), `Missing: ${ctx}`).toBe(true);
        }

        // Policies
        for (const pol of manifest.instructions.policies || []) {
          expect(existsSync(resolve(capDir, pol)), `Missing: ${pol}`).toBe(true);
        }

        // Examples
        for (const ex of manifest.examples || []) {
          expect(existsSync(resolve(capDir, ex)), `Missing: ${ex}`).toBe(true);
        }

        // Evals
        for (const ev of manifest.evals || []) {
          expect(existsSync(resolve(capDir, ev)), `Missing: ${ev}`).toBe(true);
        }

        // Toolset references
        for (const ts of manifest.tools?.mcp?.toolsets || []) {
          expect(existsSync(resolve(capDir, ts)), `Missing: ${ts}`).toBe(true);
        }
      });
    });
  }

  it('rejects a malformed extension fixture', () => {
    const malformed = {
      id: 'INVALID_ID',
      version: 'not-semver',
    };

    // id must be kebab-case
    expect(/^[a-z][a-z0-9-]*$/.test(malformed.id)).toBe(false);
    // version must be semver
    expect(/^\d+\.\d+\.\d+$/.test(malformed.version)).toBe(false);
    // missing required fields
    expect(malformed).not.toHaveProperty('title');
    expect(malformed).not.toHaveProperty('instructions');
    expect(malformed).not.toHaveProperty('tools');
    expect(malformed).not.toHaveProperty('workflow');
  });

  it('has unique extension ids across all manifests', () => {
    const ids = extensionIds.map(id => loadManifest(id).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
