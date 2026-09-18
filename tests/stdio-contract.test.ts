import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";
import baseline from "./fixtures/pre-stateless-contract.json";

// Compare the pre-migration public contract, allowing only SDK/Zod representation
// changes: schema dialect, safe-integer bounds, and equivalent object forms.
function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "$schema" ||
        (key === "maximum" && value[key] === Number.MAX_SAFE_INTEGER) ||
        (key === "minimum" && value[key] === Number.MIN_SAFE_INTEGER) ||
        (key === "propertyNames" && JSON.stringify(value[key]) === '{"type":"string"}')) continue;
    result[key] = key === "additionalProperties" && value[key] === true ? {} : normalize(value[key]);
  }
  return result;
}

function fingerprints(items: any[]) {
  return Object.fromEntries(items.map((item) => {
    const copy = { ...item };
    // SDK v1 advertised forbidden experimental tasks; v2 removes that vocabulary.
    if (copy.execution?.taskSupport === "forbidden") delete copy.execution;
    return [item.name ?? item.uriTemplate,
      createHash("sha256").update(JSON.stringify(normalize(copy))).digest("hex")];
  }));
}

describe("stdio protocol compatibility", () => {
  it.each(["modern", "legacy"] as const)("preserves public contracts over %s stdio", async (era) => {
    const client = new Client({ name: "contract-test", version: "1.0.0" }, {
      versionNegotiation: { mode: era === "modern" ? { pin: "2026-07-28" } : "legacy" },
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/cli.ts"],
      env: { ...process.env, FDIC_MCP_PROFILE: "all", TRANSPORT: "stdio" } as Record<string, string>,
      stderr: "pipe",
    });
    try {
      await client.connect(transport);
      expect(client.getProtocolEra()).toBe(era);
      expect(fingerprints((await client.listTools()).tools)).toEqual(baseline.tools);
      expect(fingerprints((await client.listResources()).resources)).toEqual(baseline.resources);
      expect(fingerprints((await client.listResourceTemplates()).resourceTemplates)).toEqual(baseline.templates);
      expect(fingerprints((await client.listPrompts()).prompts)).toEqual(baseline.prompts);
      const prompt = await client.getPrompt({ name: "bank_deep_dive", arguments: { bank: "3511" } });
      expect(prompt.messages[0].content).toMatchObject({ type: "text", text: expect.stringContaining("3511") });
      const schema = await client.callTool({ name: "fdic_fetch", arguments: { id: "schema:institutions" } });
      expect(schema.isError).not.toBe(true);
      expect(schema.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "text" })]));
    } finally {
      await client.close();
    }
  }, 15000);
});
