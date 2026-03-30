#!/usr/bin/env tsx
/**
 * Extracts MCP tool schemas from the TypeScript source and writes them to
 * extensions/shared/tool-schemas.json for use by build-adapters.mjs.
 *
 * Uses the official MCP public API (InMemoryTransport + client.listTools())
 * rather than inspecting built artifacts or private server internals. The
 * schemas are emitted as JSON Schema objects (the wire format returned by
 * listTools) and require no additional schema conversion step.
 *
 * Run: npm run extensions:extract-schemas
 *
 * When to re-run:
 *   - After adding, removing, or changing any MCP tool's inputSchema
 *   - Before committing changes to extensions/shared/tool-schemas.json
 */

import { createServer } from '../../src/index.js';
import { Client } from '@modelcontextprotocol/sdk/client';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

async function main(): Promise<void> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'schema-extractor', version: '1.0.0' });
  await client.connect(clientTransport);

  const { tools } = await client.listTools();

  await client.close();
  await server.close();

  const schemas: Record<string, { description: string; inputSchema: object }> = {};
  for (const tool of tools) {
    // Strip $schema — OpenAI function-calling format does not use it,
    // and its presence causes interoperability issues.
    const inputSchema = { ...tool.inputSchema } as Record<string, unknown>;
    delete inputSchema['$schema'];
    schemas[tool.name] = {
      description: tool.description ?? '',
      inputSchema,
    };
  }

  const output = {
    _generated_by: 'scripts/extensions/extract-tool-schemas.ts',
    _regenerate_with: 'npm run extensions:extract-schemas',
    tools: schemas,
  };

  const outPath = resolve(ROOT, 'extensions', 'shared', 'tool-schemas.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`\u2713 Extracted ${Object.keys(schemas).length} tool schema(s) \u2192 extensions/shared/tool-schemas.json`);
}

main().catch(err => {
  console.error('\u2717 Schema extraction failed:', err.message);
  process.exit(1);
});
