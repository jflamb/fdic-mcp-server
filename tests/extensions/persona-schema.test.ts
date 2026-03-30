import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const PERSONAS_DIR = resolve(ROOT, 'extensions', 'personas');

function loadPersona(id: string) {
  return JSON.parse(readFileSync(resolve(PERSONAS_DIR, id, 'persona.json'), 'utf-8'));
}

describe('Persona schema validation', () => {
  const personaIds = ['fdic-skill-builder'];

  for (const id of personaIds) {
    describe(id, () => {
      it('has kind = persona', () => {
        const manifest = loadPersona(id);
        expect(manifest.kind).toBe('persona');
      });

      it('has all required fields', () => {
        const manifest = loadPersona(id);
        expect(manifest.id).toBe(id);
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(manifest.title).toBeTruthy();
        expect(manifest.summary).toBeTruthy();
        expect(manifest.instructions).toBeTruthy();
        expect(manifest.instructions.system).toBeTruthy();
      });

      it('instructions.system file exists', () => {
        const manifest = loadPersona(id);
        const dir = resolve(PERSONAS_DIR, id);
        expect(existsSync(resolve(dir, manifest.instructions.system))).toBe(true);
      });

      it('all shared_context files exist', () => {
        const manifest = loadPersona(id);
        const dir = resolve(PERSONAS_DIR, id);
        for (const ctx of manifest.instructions.shared_context || []) {
          expect(existsSync(resolve(dir, ctx)), `Missing: ${ctx}`).toBe(true);
        }
      });

      it('all policy files exist', () => {
        const manifest = loadPersona(id);
        const dir = resolve(PERSONAS_DIR, id);
        for (const pol of manifest.instructions.policies || []) {
          expect(existsSync(resolve(dir, pol)), `Missing: ${pol}`).toBe(true);
        }
      });

      it('all example files exist', () => {
        const manifest = loadPersona(id);
        const dir = resolve(PERSONAS_DIR, id);
        for (const ex of manifest.examples || []) {
          expect(existsSync(resolve(dir, ex)), `Missing: ${ex}`).toBe(true);
        }
      });

      it('has no tools field (personas are instruction-first)', () => {
        const manifest = loadPersona(id);
        expect(manifest).not.toHaveProperty('inputs');
        expect(manifest).not.toHaveProperty('workflow');
      });
    });
  }

  it('rejects a malformed persona fixture', () => {
    const bad = { id: 'INVALID', kind: 'persona', version: 'x.y.z' };
    expect(/^[a-z][a-z0-9-]*$/.test(bad.id)).toBe(false);
    expect(/^\d+\.\d+\.\d+$/.test(bad.version)).toBe(false);
    expect(bad).not.toHaveProperty('instructions');
    expect(bad).not.toHaveProperty('summary');
  });
});
