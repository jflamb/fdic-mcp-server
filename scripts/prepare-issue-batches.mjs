import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { buildIssueBatches, renderIssueBatchBrief } from "./lib/issue-batching.mjs";

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repo = options.repo || getRepositorySlug();
  const issues = fetchIssues({
    repo,
    label: options.label,
    state: options.state,
    limit: options.limit,
  });
  const batches = buildIssueBatches(issues, { maxBatchSize: options.maxBatchSize });
  const brief = renderIssueBatchBrief({
    repo,
    label: options.label,
    state: options.state,
    maxBatchSize: options.maxBatchSize,
    batches,
  });

  if (options.writePath) {
    fs.writeFileSync(options.writePath, brief);
    console.log(`Wrote issue batch brief to ${options.writePath}`);
    return;
  }

  process.stdout.write(brief);
}

function parseArgs(argv) {
  const options = {
    label: "",
    state: "open",
    limit: 100,
    maxBatchSize: 4,
    repo: process.env.GITHUB_REPOSITORY || "",
    writePath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--label") {
      options.label = argv[++index] ?? "";
      continue;
    }

    if (arg === "--state") {
      options.state = argv[++index] ?? options.state;
      continue;
    }

    if (arg === "--limit") {
      options.limit = Number(argv[++index] ?? options.limit);
      continue;
    }

    if (arg === "--max-batch-size") {
      options.maxBatchSize = Number(argv[++index] ?? options.maxBatchSize);
      continue;
    }

    if (arg === "--repo") {
      options.repo = argv[++index] ?? options.repo;
      continue;
    }

    if (arg === "--write") {
      options.writePath = argv[++index] ?? "";
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.label) {
    throw new Error("Missing required --label argument.");
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }

  if (!Number.isInteger(options.maxBatchSize) || options.maxBatchSize <= 0) {
    throw new Error("--max-batch-size must be a positive integer.");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/prepare-issue-batches.mjs --label <label> [options]

Options:
  --state <open|closed|all>     Issue state filter. Default: open
  --limit <n>                   Maximum issues to inspect. Default: 100
  --max-batch-size <n>          Maximum issues per recommended batch. Default: 4
  --repo <owner/name>           GitHub repository slug. Defaults from gh, git remote, or package metadata
  --write <path>                Write the markdown brief to a file instead of stdout
  --help                        Show this help text
`);
}

export function parseGitHubRepositorySlug(repositoryUrl) {
  const normalized = String(repositoryUrl ?? "")
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  const match = normalized.match(/github\.com\/([^/]+\/[^/]+)$/);

  return match?.[1] ?? null;
}

export function getRepositorySlug(options = {}) {
  const env = options.env ?? process.env;
  const execFile = options.execFile ?? execFileSync;
  const readPackageJson =
    options.readPackageJson ??
    (() => JSON.parse(fs.readFileSync("package.json", "utf8")));

  if (env.GITHUB_REPOSITORY) {
    return env.GITHUB_REPOSITORY;
  }

  try {
    return execFile("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
      encoding: "utf8",
    }).trim();
  } catch {}

  try {
    const remoteUrl = execFile("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
    }).trim();
    const remoteSlug = parseGitHubRepositorySlug(remoteUrl);
    if (remoteSlug) {
      return remoteSlug;
    }
  } catch {}

  const packageJson = readPackageJson();
  const repositoryUrl =
    typeof packageJson.repository === "string"
      ? packageJson.repository
      : packageJson.repository?.url;
  const packageSlug = parseGitHubRepositorySlug(repositoryUrl);

  if (!packageSlug) {
    throw new Error(
      "Unable to determine repository slug. Pass --repo <owner/name> or configure gh auth.",
    );
  }

  return packageSlug;
}

function fetchIssues({ repo, label, state, limit }) {
  try {
    const output = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--repo",
        repo,
        "--label",
        label,
        "--state",
        state,
        "--limit",
        String(limit),
        "--json",
        "number,title,body,labels,url",
      ],
      { encoding: "utf8" },
    );

    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `Unable to load issues from GitHub CLI. Ensure gh is installed and authenticated. ${error.message}`,
    );
  }
}

const entryScriptPath = process.argv[1]
  ? fs.realpathSync(process.argv[1])
  : null;

if (entryScriptPath === fileURLToPath(import.meta.url)) {
  main();
}
