#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) {
    continue;
  }
  const [key, inlineValue] = arg.slice(2).split("=", 2);
  const value =
    inlineValue ??
    (process.argv[index + 1]?.startsWith("--") ? undefined : process.argv[++index]);
  args.set(key, value ?? "true");
}

const pluginDir = path.resolve(
  args.get("plugin-dir") ??
    path.join(os.homedir(), "plugins", "fdic-mcp-server"),
);
const transport = args.get("transport") ?? "http";

if (!["http", "stdio"].includes(transport)) {
  throw new Error(`Unsupported --transport value: ${transport}`);
}

const manifestDir = path.join(pluginDir, ".codex-plugin");
const skillsDir = path.join(pluginDir, "skills");
const sourceSkillsDir = path.join(repoRoot, ".agents", "skills");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function copyDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

const manifest = {
  name: "fdic-mcp-server",
  version: packageJson.version,
  description:
    "Codex plugin for the FDIC BankFind MCP server and analysis skills.",
  author: {
    name: "Jaime Lamb",
  },
  homepage: "https://github.com/jflamb/fdic-mcp-server#readme",
  repository: "https://github.com/jflamb/fdic-mcp-server",
  license: "MIT",
  keywords: ["fdic", "bankfind", "mcp", "banking", "public-data"],
  skills: "./skills/",
  interface: {
    displayName: "FDIC BankFind MCP Server",
    shortDescription: "Use FDIC BankFind tools and analysis workflows in Codex.",
    longDescription:
      "Adds the FDIC BankFind MCP server plus skills for repository development, portfolio surveillance, failure forensics, and FDIC skill design.",
    developerName: "Jaime Lamb",
    category: "Productivity",
    capabilities: ["MCP tools", "Skills", "Public data analysis"],
    defaultPrompt: [
      "Analyze a bank with FDIC public data.",
      "Build a state bank surveillance watchlist.",
      "Help me work in fdic-mcp-server.",
    ],
  },
  mcpServers: "./.mcp.json",
};

const httpMcp = {
  mcpServers: {
    "fdic-bankfind": {
      url: "https://bankfind.jflamb.com/mcp",
    },
  },
};

const stdioMcp = {
  mcpServers: {
    "fdic-bankfind-local": {
      command: "bash",
      args: ["-lc", `cd ${repoRoot} && npm start`],
      env: {
        FDIC_MCP_PROFILE: "core,analysis,chatgpt-aliases,prompts,resources",
      },
    },
  },
};

fs.mkdirSync(pluginDir, { recursive: true });
fs.mkdirSync(manifestDir, { recursive: true });

writeJson(path.join(manifestDir, "plugin.json"), manifest);
writeJson(path.join(pluginDir, ".mcp.json"), transport === "http" ? httpMcp : stdioMcp);
writeJson(path.join(pluginDir, ".mcp.local-stdio.example.json"), stdioMcp);
copyDirectory(sourceSkillsDir, skillsDir);

console.log(`Synced Codex plugin: ${pluginDir}`);
console.log(`Active MCP transport: ${transport}`);
