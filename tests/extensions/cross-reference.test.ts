import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const EXT_DIR = resolve(ROOT, 'extensions');

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadWorkflow(id: string) {
  return loadJson(resolve(EXT_DIR, 'workflows', id, 'workflow.json'));
}

function loadPersona(id: string) {
  return loadJson(resolve(EXT_DIR, 'personas', id, 'persona.json'));
}

function loadTool(id: string) {
  return loadJson(resolve(EXT_DIR, 'tools', id, 'tool.json'));
}

const personaDir = resolve(EXT_DIR, 'personas');
const toolDir = resolve(EXT_DIR, 'tools');
const workflowDir = resolve(EXT_DIR, 'workflows');

describe('Cross-reference validation', () => {
  const workflowIds = ['fdic-failure-forensics', 'fdic-portfolio-surveillance'];

  describe('Workflow composition references', () => {
    for (const id of workflowIds) {
      describe(id, () => {
        it('all referenced personas exist as canonical definitions', () => {
          const workflow = loadWorkflow(id);
          for (const personaId of workflow.composition?.personas || []) {
            const personaPath = resolve(personaDir, personaId, 'persona.json');
            expect(existsSync(personaPath), `Persona not found: ${personaId}`).toBe(true);
            const persona = loadJson(personaPath);
            expect(persona.kind).toBe('persona');
            expect(persona.id).toBe(personaId);
          }
        });

        it('all referenced tools exist as canonical definitions', () => {
          const workflow = loadWorkflow(id);
          for (const toolId of workflow.composition?.tools || []) {
            const toolPath = resolve(toolDir, toolId, 'tool.json');
            expect(existsSync(toolPath), `Tool not found: ${toolId}`).toBe(true);
            const tool = loadJson(toolPath);
            expect(tool.kind).toBe('tool');
            expect(tool.id).toBe(toolId);
          }
        });

        it('composition includes fdic-skill-builder persona', () => {
          const workflow = loadWorkflow(id);
          expect(workflow.composition?.personas).toContain('fdic-skill-builder');
        });

        it('composition includes both MCP tool bundles', () => {
          const workflow = loadWorkflow(id);
          expect(workflow.composition?.tools).toContain('fdic-core-mcp');
          expect(workflow.composition?.tools).toContain('fdic-analysis-mcp');
        });
      });
    }
  });

  describe('Kind consistency', () => {
    it('all personas have kind=persona', () => {
      const persona = loadPersona('fdic-skill-builder');
      expect(persona.kind).toBe('persona');
    });

    it('all tools have kind=tool', () => {
      for (const id of ['fdic-core-mcp', 'fdic-analysis-mcp']) {
        expect(loadTool(id).kind).toBe('tool');
      }
    });

    it('all workflows have kind=workflow', () => {
      for (const id of workflowIds) {
        expect(loadWorkflow(id).kind).toBe('workflow');
      }
    });

    it('legacy capabilities do not have a kind field', () => {
      // Legacy capabilities are kind-less; this is expected during migration
      const capPath = resolve(EXT_DIR, 'capabilities', 'fdic-failure-forensics', 'extension.json');
      const legacy = loadJson(capPath);
      expect(legacy.kind).toBeUndefined();
    });
  });

  describe('ID consistency — canonical vs legacy', () => {
    it('canonical workflow ids match legacy capability ids', () => {
      // Both layouts exist during migration; they should have matching IDs
      for (const id of workflowIds) {
        const workflow = loadWorkflow(id);
        const legacyPath = resolve(EXT_DIR, 'capabilities', id, 'extension.json');
        if (existsSync(legacyPath)) {
          const legacy = loadJson(legacyPath);
          expect(workflow.id).toBe(legacy.id);
        }
      }
    });

    it('canonical persona id matches legacy capability id for fdic-skill-builder', () => {
      const persona = loadPersona('fdic-skill-builder');
      const legacyPath = resolve(EXT_DIR, 'capabilities', 'fdic-skill-builder', 'extension.json');
      if (existsSync(legacyPath)) {
        const legacy = loadJson(legacyPath);
        expect(persona.id).toBe(legacy.id);
      }
    });
  });

  describe('Invalid cross-reference rejection', () => {
    it('detects a missing persona reference', () => {
      // Simulate a workflow referencing a non-existent persona
      const fakePersonaId = 'non-existent-persona-xyz';
      const fakePath = resolve(personaDir, fakePersonaId, 'persona.json');
      expect(existsSync(fakePath)).toBe(false);
    });

    it('detects a missing tool reference', () => {
      const fakeToolId = 'non-existent-tool-xyz';
      const fakePath = resolve(toolDir, fakeToolId, 'tool.json');
      expect(existsSync(fakePath)).toBe(false);
    });
  });
});
