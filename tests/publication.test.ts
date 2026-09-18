import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { parse } from "yaml";
import { validateRelease, waitForNpm } from "../scripts/prepare-publication.mjs";
import { checkRegistry } from "../scripts/check-registry-publication.mjs";
import { checkGithubPackage } from "../scripts/check-github-package.mjs";

const commit = "a".repeat(40);
const release = { tag_name: "v2.0.0", published_at: "2026-09-18", draft: false, prerelease: false };
const pkg = { name: "fdic-mcp-server", version: "2.0.0", gitHead: commit };
const server = {
  name: "io.github.jflamb/fdic-mcp-server", version: "2.0.0",
  packages: [{ registryType: "npm", identifier: pkg.name, version: pkg.version, transport: { type: "stdio" } }],
};
const registryResponse = (value = server) => Response.json({
  server: value, _meta: { "io.modelcontextprotocol.registry/official": { status: "active" } },
});

describe("publication identity and npm processing", () => {
  it("accepts the existing stable release", () => {
    expect(() => validateRelease("2.0.0", release, commit)).not.toThrow();
  });
  it.each(["latest", "v2.0.0", "2.0.0-beta.1", "../../main", "2.0.0;exit", "02.0.0"])("rejects invalid recovery input %s", (version) => {
    expect(() => validateRelease(version, release, commit)).toThrow();
  });
  it.each([{ draft: true }, { prerelease: true }, { published_at: null }, { tag_name: "v1.0.0" }])("rejects an unpublished or different release %o", (change) => {
    expect(() => validateRelease("2.0.0", { ...release, ...change }, commit)).toThrow();
  });
  it("recovers from npm processing without republishing", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json(pkg));
    const sleep = vi.fn();
    await expect(waitForNpm("2.0.0", commit, { fetchFn, sleep })).resolves.toEqual(pkg);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(60000);
  });
  it("stops after two retries", async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })));
    const sleep = vi.fn();
    await expect(waitForNpm("2.0.0", commit, { fetchFn, sleep })).rejects.toThrow("after 3 checks");
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 400])("does not retry unsafe HTTP %s", async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status }));
    const sleep = vi.fn();
    await expect(waitForNpm("2.0.0", commit, { fetchFn, sleep })).rejects.toThrow(`HTTP ${status}`);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("rejects mismatched npm commit without retrying", async () => {
    const sleep = vi.fn();
    await expect(waitForNpm("2.0.0", commit, { fetchFn: async () => Response.json({ ...pkg, gitHead: "b".repeat(40) }), sleep })).rejects.toThrow("does not match");
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("idempotent downstream publication", () => {
  it("skips an already matching registry version", async () => {
    await expect(checkRegistry(server, { fetchFn: async () => registryResponse() })).resolves.toBe(true);
  });
  it("allows a missing version for publication but requires readback afterward", async () => {
    const fetchFn = async () => new Response(null, { status: 404 });
    await expect(checkRegistry(server, { fetchFn })).resolves.toBe(false);
    await expect(checkRegistry(server, { fetchFn, requirePresent: true })).rejects.toThrow("HTTP 404");
  });
  it("rejects a registry entry that still advertises the retired endpoint", async () => {
    await expect(checkRegistry(server, { fetchFn: async () => registryResponse({ ...server, remotes: [{ type: "streamable-http", url: "https://bankfind.jflamb.com/mcp" }] }) })).rejects.toThrow("conflicts");
  });
  it("does not treat registry authorization failure as a missing version", async () => {
    await expect(checkRegistry(server, { fetchFn: async () => new Response(null, { status: 403 }) })).rejects.toThrow("HTTP 403");
  });
  it("skips an existing GitHub package", () => {
    expect(checkGithubPackage(pkg, { run: () => JSON.stringify(pkg.version) })).toBe(true);
  });
  it("distinguishes missing GitHub package from authorization failure", () => {
    const run = (code: string) => () => { throw { stdout: JSON.stringify({ error: { code } }) }; };
    expect(checkGithubPackage(pkg, { run: run("E404") })).toBe(false);
    expect(() => checkGithubPackage(pkg, { run: run("E404"), requirePresent: true })).toThrow();
    expect(() => checkGithubPackage(pkg, { run: run("E401") })).toThrow();
    expect(() => checkGithubPackage(pkg, { run: run("E403") })).toThrow();
  });
});

describe("release workflow failure isolation", () => {
  const workflow = parse(fs.readFileSync(".github/workflows/publish.yml", "utf8"));
  const steps = workflow.jobs.publish.steps;
  it("continues independent GitHub Packages work after any registry failure", () => {
    for (const step of steps.filter((s: any) => s.id?.startsWith("registry"))) {
      expect(step["continue-on-error"]).toBe(true);
    }
    expect(steps.find((s: any) => s.id === "gpr_prepare").if).toBe("${{ !cancelled() && steps.publication.outcome == 'success' }}");
    const summary = steps.find((s: any) => s.name === "Summarize release result");
    expect(summary.run).toContain('test "$REGISTRY_RESULT" = "success" && test "$PACKAGES_RESULT" = "success"');
  });
  it("bypasses semantic-release during recovery and passes version through the environment", () => {
    expect(steps.find((s: any) => s.id === "semantic").if).toContain("inputs.recover_version == ''");
    expect(steps.find((s: any) => s.id === "publication").run).toBe('node scripts/prepare-publication.mjs "$RELEASE_VERSION"');
    expect(workflow.jobs.publish["timeout-minutes"]).toBe(15);
  });
});
