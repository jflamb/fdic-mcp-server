const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");

async function main() {
  await Promise.all([
    build({
      entryPoints: ["src/cli.ts"],
      bundle: true,
      platform: "node",
      target: "node18",
      outfile: "dist/index.js",
      external: ["@modelcontextprotocol/sdk", "express", "axios", "zod"],
      format: "cjs",
    }),
    build({
      entryPoints: ["src/index.ts"],
      bundle: true,
      platform: "node",
      target: "node18",
      outfile: "dist/server.js",
      external: ["@modelcontextprotocol/sdk", "express", "axios", "zod"],
      format: "cjs",
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
