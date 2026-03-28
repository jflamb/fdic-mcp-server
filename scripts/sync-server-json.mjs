import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverJson = JSON.parse(fs.readFileSync("server.json", "utf8"));
const version = process.argv[2] || packageJson.version;

serverJson.version = version;

if (Array.isArray(serverJson.packages)) {
  for (const pkg of serverJson.packages) {
    if (pkg.registryType === "npm") {
      pkg.version = version;
    }
  }
}

fs.writeFileSync("server.json", `${JSON.stringify(serverJson, null, 2)}\n`);

const pluginJsonPath = ".claude-plugin/plugin.json";
if (fs.existsSync(pluginJsonPath)) {
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf8"));
  pluginJson.version = version;
  fs.writeFileSync(pluginJsonPath, `${JSON.stringify(pluginJson, null, 2)}\n`);
}
