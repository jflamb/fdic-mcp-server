import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export async function checkRegistry(server, { fetchFn = fetch, requirePresent = false } = {}) {
  const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(server.name)}/versions/${encodeURIComponent(server.version)}`;
  const response = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
  if (response.status === 404 && !requirePresent) return false;
  if (!response.ok) throw new Error(`MCP Registry readback failed: HTTP ${response.status}.`);
  const data = await response.json();
  const actual = data.server;
  if (actual?.name !== server.name || actual?.version !== server.version ||
      !isDeepStrictEqual(actual.packages ?? [], server.packages ?? []) ||
      !isDeepStrictEqual(actual.remotes ?? [], server.remotes ?? []) ||
      data._meta?.["io.modelcontextprotocol.registry/official"]?.status !== "active") {
    throw new Error("Existing MCP Registry version conflicts with the release metadata.");
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = JSON.parse(fs.readFileSync("server.json", "utf8"));
  const exists = await checkRegistry(server, { requirePresent: process.argv[2] === "--verify" });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `exists=${exists}\n`);
  console.log(`MCP Registry ${server.version}: ${exists ? "verified" : "not yet published"}.`);
}
