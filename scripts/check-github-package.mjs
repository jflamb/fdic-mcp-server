import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function checkGithubPackage(pkg, { run = execFileSync, requirePresent = false } = {}) {
  try {
    const version = JSON.parse(run("npm", ["view", `${pkg.name}@${pkg.version}`, "version",
      "--registry=https://npm.pkg.github.com", "--json", "--fetch-retries=0"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    if (version !== pkg.version) throw new Error("GitHub Packages version mismatch.");
    return true;
  } catch (error) {
    let code;
    try { code = JSON.parse(error.stdout?.toString() ?? "{}").error?.code; } catch { /* fail closed below */ }
    if (code === "E404" && !requirePresent) return false;
    throw new Error(`GitHub Packages readback failed (${code || "invalid response"}).`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const exists = checkGithubPackage(pkg, { requirePresent: process.argv[2] === "--verify" });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `exists=${exists}\n`);
  console.log(`GitHub Packages ${pkg.name}@${pkg.version}: ${exists ? "verified" : "not yet published"}.`);
}
