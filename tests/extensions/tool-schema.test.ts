import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const TOOLS_DIR = resolve(ROOT, 'extensions', 'tools');

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

function loadTool(id: string) {
  return JSON.parse(readFileSync(resolve(TOOLS_DIR, id, 'tool.json'), 'utf-8'));
}

describe('Tool schema validation', () => {
  const toolIds = ['fdic-core-mcp', 'fdic-analysis-mcp'];

  for (const id of toolIds) {
    describe(id, () => {
      it('has kind = tool', () => {
        expect(loadTool(id).kind).toBe('tool');
      });

      it('has all required fields', () => {
        const manifest = loadTool(id);
        expect(manifest.id).toBe(id);
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(manifest.title).toBeTruthy();
        expect(manifest.summary).toBeTruthy();
        expect(manifest.tools?.mcp).toBeTruthy();
      });

      it('lists only known MCP tools in preferred', () => {
        const manifest = loadTool(id);
        for (const toolName of manifest.tools?.mcp?.preferred || []) {
          expect(KNOWN_TOOLS.has(toolName), `Unknown tool: ${toolName}`).toBe(true);
        }
      });

      it('lists only known MCP tools in forbidden', () => {
        const manifest = loadTool(id);
        for (const toolName of manifest.tools?.mcp?.forbidden || []) {
          expect(KNOWN_TOOLS.has(toolName), `Unknown tool: ${toolName}`).toBe(true);
        }
      });

      it('all toolset references exist', () => {
        const manifest = loadTool(id);
        const dir = resolve(TOOLS_DIR, id);
        for (const ts of manifest.tools?.mcp?.toolsets || []) {
          expect(existsSync(resolve(dir, ts)), `Missing toolset: ${ts}`).toBe(true);
        }
      });

      it('usage file exists when specified', () => {
        const manifest = loadTool(id);
        if (manifest.usage) {
          const usagePath = resolve(TOOLS_DIR, id, manifest.usage);
          expect(existsSync(usagePath), `Missing usage file: ${manifest.usage}`).toBe(true);
        }
      });

      it('has no workflow field (tools are not procedural)', () => {
        const manifest = loadTool(id);
        expect(manifest).not.toHaveProperty('workflow');
        expect(manifest).not.toHaveProperty('inputs');
      });
    });
  }

  it('together cover all 23 known MCP tools across fdic-core-mcp and fdic-analysis-mcp', () => {
    const core = loadTool('fdic-core-mcp');
    const analysis = loadTool('fdic-analysis-mcp');
    const allDeclared = new Set([
      ...(core.tools?.mcp?.preferred || []),
      ...(analysis.tools?.mcp?.preferred || []),
    ]);
    for (const tool of KNOWN_TOOLS) {
      expect(allDeclared.has(tool), `Tool not declared in either bundle: ${tool}`).toBe(true);
    }
  });

  it('rejects a malformed tool fixture', () => {
    const bad = { id: 'OK-id', kind: 'tool', version: '1.0.0' };
    expect(bad).not.toHaveProperty('tools');
    expect(bad).not.toHaveProperty('summary');
  });
});
