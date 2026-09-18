import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function validateVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("Publication requires an exact stable version, such as 2.0.0.");
  }
}

export function validateRelease(version, release, commit) {
  validateVersion(version);
  if (release.tag_name !== `v${version}` || release.draft || release.prerelease || !release.published_at) {
    throw new Error("Recovery requires an existing published stable GitHub release.");
  }
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid release commit.");
}

// npm publication can be accepted before version metadata is readable.
// This operation owns the full retry budget: 3 attempts, 60 seconds apart.
export async function waitForNpm(version, commit, {
  fetchFn = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const url = `https://registry.npmjs.org/fdic-mcp-server/${encodeURIComponent(version)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
    } catch (error) {
      if (attempt === 2) throw error;
    }
    if (response?.ok) {
      const data = await response.json();
      if (data.name !== "fdic-mcp-server" || data.version !== version || data.gitHead !== commit) {
        throw new Error("npm package identity or commit does not match the release tag.");
      }
      return data;
    }
    if (response && response.status !== 404 && response.status !== 429 && response.status < 500) {
      throw new Error(`npm visibility check failed: HTTP ${response.status}.`);
    }
    if (attempt < 2) await sleep(60000);
  }
  throw new Error("npm version is still processing or unavailable after 3 checks; recover this release later.");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

export async function preparePublication(version) {
  // Validate before using the input in refs, API routes, or package selectors.
  validateVersion(version);
  const repository = process.env.GITHUB_REPOSITORY || "jflamb/fdic-mcp-server";
  const tag = `v${version}`;
  const release = JSON.parse(run("gh", ["api", `repos/${repository}/releases/tags/${tag}`]));
  const commit = run("git", ["rev-parse", `refs/tags/${tag}^{commit}`]);
  validateRelease(version, release, commit);
  run("git", ["merge-base", "--is-ancestor", commit, "origin/main"]);
  await waitForNpm(version, commit);

  // Reuse npm's published bytes, including dist, rather than rebuilding from main.
  const directory = fs.mkdtempSync(path.resolve(".tmp-publication-"));
  const packed = JSON.parse(run("npm", ["pack", `fdic-mcp-server@${version}`,
    "--registry=https://registry.npmjs.org", "--ignore-scripts", "--json",
    "--fetch-retries=0", "--pack-destination", directory]));
  const archive = packed[0]?.filename;
  if (!archive || path.basename(archive) !== archive) throw new Error("Unexpected npm archive name.");
  run("tar", ["-xzf", path.join(directory, archive), "-C", directory]);
  const packageDirectory = path.join(directory, "package");
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8"));
  const server = JSON.parse(run("git", ["show", `refs/tags/${tag}:server.json`]));
  if (pkg.name !== "fdic-mcp-server" || pkg.version !== version || pkg.mcpName !== server.name) {
    throw new Error("Downloaded package does not match the release identity.");
  }
  server.version = version;
  for (const entry of server.packages ?? []) {
    if (entry.registryType === "npm") entry.version = version;
  }
  fs.writeFileSync("server.json", `${JSON.stringify(server, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\npackage_directory=${packageDirectory}\n`);
  }
  console.log(`Prepared publication of ${pkg.name}@${version} from ${commit}.`);
  return { version, commit, packageDirectory };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await preparePublication(process.argv[2] ?? "");
}
