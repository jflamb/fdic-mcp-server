import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, ".tmp", "github-package");

const packageJsonPath = path.join(rootDir, "package.json");
const rawPackageJson = await readFile(packageJsonPath, "utf8");
const packageJson = JSON.parse(rawPackageJson);

const scopedName = `@jflamb/${packageJson.name}`;
const {
  build: _build,
  test: _test,
  typecheck: _typecheck,
  prepack: _prepack,
  prepublishOnly: _prepublishOnly,
  packCheck: _packCheck,
  "pack:check": _packCheckAlt,
  dev: _dev,
  "deploy:local": _deployLocal,
  ...remainingScripts
} = packageJson.scripts ?? {};

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(path.join(outputDir, "dist"), { recursive: true });

await cp(path.join(rootDir, "dist"), path.join(outputDir, "dist"), {
  recursive: true,
});
await cp(path.join(rootDir, "README.md"), path.join(outputDir, "README.md"));
await cp(path.join(rootDir, "LICENSE"), path.join(outputDir, "LICENSE"));

const githubPackageJson = {
  ...packageJson,
  name: scopedName,
  scripts: remainingScripts,
  publishConfig: {
    registry: "https://npm.pkg.github.com",
  },
};

await writeFile(
  path.join(outputDir, "package.json"),
  `${JSON.stringify(githubPackageJson, null, 2)}\n`,
);

console.log(`Prepared GitHub Packages bundle at ${outputDir}`);
