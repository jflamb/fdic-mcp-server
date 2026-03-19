import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const outputPath = process.env.DOCS_LATEST_RELEASE_OUTPUT
  ? path.resolve(process.env.DOCS_LATEST_RELEASE_OUTPUT)
  : path.join(repoRoot, "docs", "_data", "latest_release.json");

const releasesPath = path.join(path.dirname(outputPath), "releases.json");

async function main() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const repo = getRepositorySlug(packageJson);
  const latestRelease =
    (await fetchLatestRelease(repo)) ??
    getLatestReleaseFromGit(repo) ??
    getLatestReleaseFromPackage(repo, packageJson.version);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(latestRelease, null, 2)}\n`);

  console.log(
    `Wrote docs latest release data for ${latestRelease.tag_name} to ${outputPath}`,
  );

  const releases = await fetchReleases(repo);
  await writeFile(releasesPath, `${JSON.stringify(releases, null, 2)}\n`);
  console.log(
    `Wrote ${releases.length} releases to ${releasesPath}`,
  );
}

function getRepositorySlug(packageJson) {
  const repositoryUrl =
    typeof packageJson.repository === "string"
      ? packageJson.repository
      : packageJson.repository?.url;

  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  if (!repositoryUrl) {
    throw new Error("Unable to determine repository slug for docs release data.");
  }

  const normalized = repositoryUrl
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");

  const match = normalized.match(/github\.com\/([^/]+\/[^/]+)$/);

  if (!match) {
    throw new Error(`Unsupported repository URL: ${repositoryUrl}`);
  }

  return match[1];
}

async function fetchLatestRelease(repo) {
  const apiBaseUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const url = `${apiBaseUrl}/repos/${repo}/releases/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fdic-mcp-server-docs-release-data",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const release = await response.json();

    return mapRelease({
      source: "github",
      tagName: release.tag_name,
      url: release.html_url,
      publishedAt: release.published_at,
      summary: summarizeReleaseBody(release.body),
      releaseName: release.name,
    });
  } catch (error) {
    console.warn(`Falling back from GitHub release API: ${error.message}`);
    return null;
  }
}

async function fetchReleases(repo, count = 10) {
  const apiBaseUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const url = `${apiBaseUrl}/repos/${repo}/releases?per_page=${count}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fdic-mcp-server-docs-release-data",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const releases = await response.json();

    return releases.map((release) => {
      const version = release.tag_name.replace(/^v/, "");
      return {
        tag_name: release.tag_name,
        version,
        display_name: `Version ${version}`,
        url: release.html_url,
        published_at: release.published_at,
        body: release.body || "",
        summary: summarizeReleaseBody(release.body),
      };
    });
  } catch (error) {
    console.warn(`Failed to fetch releases list: ${error.message}`);
    return [];
  }
}

function getLatestReleaseFromGit(repo) {
  try {
    const output = execFileSync(
      "git",
      ["tag", "--list", "v*", "--sort=-version:refname"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const tagName = output
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    if (!tagName) {
      return null;
    }

    return mapRelease({
      source: "git",
      tagName,
      url: `https://github.com/${repo}/releases/tag/${tagName}`,
      summary: `Published release ${tagName} from the repository tags.`,
    });
  } catch (error) {
    console.warn(`Falling back from git tags: ${error.message}`);
    return null;
  }
}

function getLatestReleaseFromPackage(repo, version) {
  const tagName = version.startsWith("v") ? version : `v${version}`;

  return mapRelease({
    source: "package",
    tagName,
    url: `https://github.com/${repo}/releases/latest`,
    summary: `Latest release data was unavailable during the docs build. See GitHub Releases for ${tagName}.`,
  });
}

function mapRelease({ source, tagName, url, publishedAt = null, summary, releaseName = null }) {
  const version = tagName.replace(/^v/, "");

  return {
    source,
    tag_name: tagName,
    version,
    display_name: `Version ${version}`,
    release_name: releaseName || tagName,
    url,
    published_at: publishedAt,
    summary,
  };
}

function summarizeReleaseBody(body) {
  if (!body) {
    return "See the GitHub release notes for the latest published changes.";
  }

  const sectionSummary = summarizeReleaseSections(body);

  if (sectionSummary) {
    return sectionSummary;
  }

  const firstParagraph = body
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part && !part.startsWith("#"));

  if (!firstParagraph) {
    return "See the GitHub release notes for the latest published changes.";
  }

  return stripMarkdown(firstParagraph).slice(0, 220);
}

function summarizeReleaseSections(body) {
  const lines = body.split("\n");
  let currentHeading = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("### ")) {
      currentHeading = stripMarkdown(line.slice(4));
      continue;
    }

    if (!currentHeading || !line.startsWith("* ")) {
      continue;
    }

    const bullet = stripMarkdown(line.slice(2))
      .replace(/\(\[[^)]+\]\)\s*$/, "")
      .replace(/\s+\([a-f0-9]{7,}\)\s*$/, "")
      .trim();

    if (!bullet) {
      continue;
    }

    const headingPrefix = (
      currentHeading.endsWith("s") ? currentHeading : `${currentHeading}s`
    ).toLowerCase();

    return `${headingPrefix} in the latest published release, including ${bullet}.`
      .replace(/\s+/g, " ")
      .slice(0, 220);
  }

  return null;
}

function stripMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

await main();
