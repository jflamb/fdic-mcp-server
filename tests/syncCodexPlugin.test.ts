import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "sync-codex-plugin.mjs");
const pluginDirs: string[] = [];

function createPluginDir() {
  const pluginDir = mkdtempSync(path.join(tmpdir(), "fdic-plugin-test-"));
  pluginDirs.push(pluginDir);
  return pluginDir;
}

function readJson(relativePath: string, pluginDir: string) {
  return JSON.parse(readFileSync(path.join(pluginDir, relativePath), "utf8"));
}

afterEach(() => {
  for (const pluginDir of pluginDirs.splice(0)) {
    rmSync(pluginDir, { recursive: true, force: true });
  }
});

describe("sync Codex plugin script", () => {
  it("uses the hosted HTTP endpoint by default and copies skills", () => {
    const pluginDir = createPluginDir();

    execFileSync("node", [scriptPath, "--plugin-dir", pluginDir], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const manifest = readJson(".codex-plugin/plugin.json", pluginDir);
    const mcpConfig = readJson(".mcp.json", pluginDir);

    expect(manifest.name).toBe("fdic-mcp-server");
    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(mcpConfig).toEqual({
      mcpServers: {
        "fdic-bankfind": {
          url: "https://bankfind.jflamb.com/mcp",
        },
      },
    });
    expect(
      existsSync(
        path.join(pluginDir, "skills", "fdic-portfolio-surveillance", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      existsSync(path.join(pluginDir, "skills", "fdic-skill-builder", "SKILL.md")),
    ).toBe(true);
  });

  it("can make local stdio the active transport while retaining the example file", () => {
    const pluginDir = createPluginDir();

    execFileSync(
      "node",
      [scriptPath, "--plugin-dir", pluginDir, "--transport", "stdio"],
      {
        cwd: repoRoot,
        stdio: "pipe",
      },
    );

    const activeMcpConfig = readJson(".mcp.json", pluginDir);
    const stdioExample = readJson(".mcp.local-stdio.example.json", pluginDir);
    const localServer = activeMcpConfig.mcpServers["fdic-bankfind-local"];

    expect(activeMcpConfig).toEqual(stdioExample);
    expect(localServer.command).toBe("bash");
    expect(localServer.args).toEqual(["-lc", `cd ${repoRoot} && npm start`]);
    expect(localServer.env.FDIC_MCP_PROFILE).toBe(
      "core,analysis,chatgpt-aliases,prompts,resources",
    );
  });

  it("rejects unsupported transport values", () => {
    const pluginDir = createPluginDir();

    const result = spawnSync(
      "node",
      [scriptPath, "--plugin-dir", pluginDir, "--transport", "ftp"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unsupported --transport value: ftp");
  });
});
