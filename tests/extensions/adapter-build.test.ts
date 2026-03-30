import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const ADAPTERS_DIR = resolve(ROOT, 'adapters');

describe('Adapter build', () => {
  beforeAll(() => {
    execSync('node scripts/extensions/build-adapters.mjs', { cwd: ROOT, stdio: 'pipe' });
  });

  // ── Persona adapters ────────────────────────────────────────────────────
  describe('Persona: fdic-skill-builder', () => {
    it('generates Claude SKILL.md with persona source in banner', () => {
      const skillPath = resolve(ADAPTERS_DIR, 'claude', 'skills', 'fdic-skill-builder', 'SKILL.md');
      expect(existsSync(skillPath)).toBe(true);
      const content = readFileSync(skillPath, 'utf-8');
      expect(content).toContain('⚠️ GENERATED FILE — DO NOT EDIT MANUALLY');
      expect(content).toContain('extensions/personas/fdic-skill-builder/');
    });

    it('generates Gemini Gem', () => {
      const gemPath = resolve(ADAPTERS_DIR, 'gemini', 'gems', 'fdic-skill-builder.md');
      expect(existsSync(gemPath)).toBe(true);
      const content = readFileSync(gemPath, 'utf-8');
      expect(content).toContain('Gemini Gem');
    });
  });

  // ── Tool adapters ────────────────────────────────────────────────────────
  for (const toolId of ['fdic-core-mcp', 'fdic-analysis-mcp']) {
    describe(`Tool: ${toolId}`, () => {
      it('generates Claude connector', () => {
        const path = resolve(ADAPTERS_DIR, 'claude', 'connectors', `${toolId}.md`);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('⚠️ GENERATED FILE — DO NOT EDIT MANUALLY');
        expect(content).toContain(`extensions/tools/${toolId}/`);
        expect(content).toContain('Claude Connector');
      });

      it('generates OpenAI connector', () => {
        const path = resolve(ADAPTERS_DIR, 'openai', 'connectors', `${toolId}.md`);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('OpenAI Connector');
      });

      it('generates Gemini integration', () => {
        const path = resolve(ADAPTERS_DIR, 'gemini', 'integrations', `${toolId}.md`);
        expect(existsSync(path)).toBe(true);
      });
    });
  }

  // ── Workflow adapters ────────────────────────────────────────────────────
  const workflowIds = ['fdic-failure-forensics', 'fdic-portfolio-surveillance'];

  for (const id of workflowIds) {
    describe(`Workflow: ${id}`, () => {
      const skillPath = resolve(ADAPTERS_DIR, 'claude', 'skills', id, 'SKILL.md');

      it('generates Claude SKILL.md with workflow source in banner (canonical wins over legacy)', () => {
        expect(existsSync(skillPath)).toBe(true);
        const content = readFileSync(skillPath, 'utf-8');
        expect(content).toContain('⚠️ GENERATED FILE — DO NOT EDIT MANUALLY');
        // Canonical workflow source must win over legacy capability source
        expect(content).toContain(`extensions/workflows/${id}/`);
        expect(content).not.toContain(`extensions/capabilities/${id}/`);
      });

      it('includes composition note referencing personas and tools', () => {
        const content = readFileSync(skillPath, 'utf-8');
        expect(content).toContain('Composition');
      });

      it('includes YAML frontmatter', () => {
        const content = readFileSync(skillPath, 'utf-8');
        expect(content).toContain(`name: ${id}`);
        expect(content).toContain('description: >');
      });

      it('generates Codex skill', () => {
        const path = resolve(ADAPTERS_DIR, 'codex', 'skills', id, 'SKILL.md');
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain(`extensions/workflows/${id}/`);
      });

      it('generates OpenAI prompt pack with workflow source', () => {
        const path = resolve(ADAPTERS_DIR, 'openai', 'prompt-packs', `${id}.md`);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain(`extensions/workflows/${id}/`);
      });

      it('generates Gemini agent guide with workflow source', () => {
        const path = resolve(ADAPTERS_DIR, 'gemini', 'agent-guides', `${id}.md`);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain(`extensions/workflows/${id}/`);
      });
    });
  }

  // ── Determinism ──────────────────────────────────────────────────────────
  it('produces deterministic output across runs', () => {
    execSync('node scripts/extensions/build-adapters.mjs', { cwd: ROOT, stdio: 'pipe' });
    const firstRun = readFileSync(
      resolve(ADAPTERS_DIR, 'claude', 'skills', 'fdic-failure-forensics', 'SKILL.md'), 'utf-8'
    );
    execSync('node scripts/extensions/build-adapters.mjs', { cwd: ROOT, stdio: 'pipe' });
    const secondRun = readFileSync(
      resolve(ADAPTERS_DIR, 'claude', 'skills', 'fdic-failure-forensics', 'SKILL.md'), 'utf-8'
    );
    expect(firstRun).toBe(secondRun);
  });
});
