import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const ADAPTERS_DIR = resolve(ROOT, 'adapters');
const SCHEMAS_PATH = resolve(ROOT, 'extensions', 'shared', 'tool-schemas.json');

describe('Adapter build', () => {
  // Read the registry content from git HEAD (not the working tree) so the
  // staleness check cannot be masked by a local regeneration that was never
  // committed.  Falls back to the on-disk file when not running inside a git
  // repo (e.g. published tarball).
  let committedSchemasContent: string;
  try {
    committedSchemasContent = execSync(
      'git show HEAD:extensions/shared/tool-schemas.json',
      { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    committedSchemasContent = existsSync(SCHEMAS_PATH) ? readFileSync(SCHEMAS_PATH, 'utf-8') : '';
  }

  beforeAll(() => {
    // Extract tool schemas from TypeScript source (public MCP API, no dist required),
    // then build adapters from the static registry.
    execSync('npm run extensions:extract-schemas', { cwd: ROOT, stdio: 'pipe' });
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

    it('generates Gemini Gem markdown', () => {
      const gemPath = resolve(ADAPTERS_DIR, 'gemini', 'gems', 'fdic-skill-builder.md');
      expect(existsSync(gemPath)).toBe(true);
      const content = readFileSync(gemPath, 'utf-8');
      expect(content).toContain('Gemini Gem');
    });

    it('generates Gemini Gem YAML with required fields', () => {
      const gemPath = resolve(ADAPTERS_DIR, 'gemini', 'gems', 'fdic-skill-builder.yaml');
      expect(existsSync(gemPath)).toBe(true);
      const content = readFileSync(gemPath, 'utf-8');
      expect(content).toContain('title:');
      expect(content).toContain('prompt:');
      expect(content).toContain('source: extensions/personas/fdic-skill-builder/');
      expect(content).toContain('recommended_first_prompt:');
    });

    it('Gemini Gem YAML prompt includes inlined shared context', () => {
      const gemPath = resolve(ADAPTERS_DIR, 'gemini', 'gems', 'fdic-skill-builder.yaml');
      const content = readFileSync(gemPath, 'utf-8');
      expect(content).toContain('FDIC Date Basis Rules');
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
        expect(content).not.toContain('Full connector spec stub');
      });

      it('OpenAI connector includes function definitions from the tool schema registry', () => {
        const path = resolve(ADAPTERS_DIR, 'openai', 'connectors', `${toolId}.md`);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('## Function Definitions');
        expect(content).toContain('"type": "function"');
        expect(content).toContain('"parameters"');
        expect(content).not.toContain('"$schema"');
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

      it('OpenAI prompt pack inlines shared context content', () => {
        const path = resolve(ADAPTERS_DIR, 'openai', 'prompt-packs', `${id}.md`);
        const content = readFileSync(path, 'utf-8');
        // Shared context files are inlined, not just referenced as HTML comments
        expect(content).toContain('FDIC Date Basis Rules');
        expect(content).toContain('Temporal Accuracy Policy');
        expect(content).not.toMatch(/<!--.*fdic-date-basis.*-->/);
      });

      it('generates Gemini agent guide with workflow source', () => {
        const path = resolve(ADAPTERS_DIR, 'gemini', 'agent-guides', `${id}.md`);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain(`extensions/workflows/${id}/`);
      });

      it('Gemini agent guide inlines shared context content', () => {
        const path = resolve(ADAPTERS_DIR, 'gemini', 'agent-guides', `${id}.md`);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('FDIC Date Basis Rules');
        expect(content).toContain('Temporal Accuracy Policy');
      });

      it('generates Gemini Gem YAML with required fields', () => {
        const path = resolve(ADAPTERS_DIR, 'gemini', 'gems', `${id}.yaml`);
        expect(existsSync(path)).toBe(true);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('title:');
        expect(content).toContain('prompt:');
        expect(content).toContain(`source: extensions/workflows/${id}/`);
        expect(content).toContain('recommended_first_prompt:');
      });

      it('Gemini Gem YAML prompt includes inlined shared context', () => {
        const path = resolve(ADAPTERS_DIR, 'gemini', 'gems', `${id}.yaml`);
        const content = readFileSync(path, 'utf-8');
        expect(content).toContain('FDIC Date Basis Rules');
      });
    });
  }

  // ── Tool schema registry staleness ──────────────────────────────────────
  it('committed tool-schemas.json matches freshly extracted output (not stale)', () => {
    // Compares git HEAD content against freshly extracted schemas.  If this
    // fails, a tool inputSchema changed without re-running:
    //   npm run extensions:extract-schemas
    // and committing the updated extensions/shared/tool-schemas.json.
    const fresh = readFileSync(SCHEMAS_PATH, 'utf-8');
    expect(fresh).toBe(committedSchemasContent);
  });

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
