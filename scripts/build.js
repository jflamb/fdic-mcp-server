const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

async function main() {
  // Prefer BUILD_VERSION when supplied by a self-hosted container build.
  // Fall back to package.json
  // so local `npm run build` keeps working unchanged.
  const version = process.env.BUILD_VERSION || pkg.version;
  const define = {
    __APP_VERSION__: JSON.stringify(version),
  };

  await Promise.all([
    build({
      entryPoints: ["src/cli.ts"],
      bundle: true,
      platform: "node",
      target: "node20",
      outfile: "dist/index.js",
      external: [
        "@modelcontextprotocol/server",
        "@modelcontextprotocol/node",
        "express",
        "axios",
        "zod",
      ],
      format: "cjs",
      define,
    }),
    build({
      entryPoints: ["src/index.ts"],
      bundle: true,
      platform: "node",
      target: "node20",
      outfile: "dist/server.js",
      external: [
        "@modelcontextprotocol/server",
        "@modelcontextprotocol/node",
        "express",
        "axios",
        "zod",
      ],
      format: "cjs",
      define,
    }),
  ]);

  const cliPath = path.join("dist", "index.js");
  const cliSource = fs.readFileSync(cliPath, "utf8");
  const withShebang = cliSource.startsWith("#!/usr/bin/env node\n")
    ? cliSource
    : `#!/usr/bin/env node\n${cliSource}`;

  fs.writeFileSync(cliPath, withShebang);
  fs.chmodSync(cliPath, 0o755);

  console.log("Build success");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
