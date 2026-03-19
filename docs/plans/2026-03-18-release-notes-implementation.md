# Release Notes Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the stale release notes page with an auto-populated changelog showing the last 10 GitHub releases inline, and update working norms to ensure meaningful commit data.

**Architecture:** Extend the existing `scripts/generate-docs-release-data.mjs` to fetch the last 10 releases into a `docs/_data/releases.json` array. Rework the Jekyll release notes page to render this array as a compact changelog. Remove old manual version pages and their navigation entries. Add commit message quality norms to AGENTS.md.

**Tech Stack:** Node.js (build script), Jekyll/Liquid (template), GitHub REST API

---

### Task 1: Extend the build script to fetch multiple releases

**Files:**
- Modify: `scripts/generate-docs-release-data.mjs`
- Create: `docs/_data/releases.json`

**Step 1: Add a `fetchReleases` function**

Add this function after the existing `fetchLatestRelease` function in `scripts/generate-docs-release-data.mjs`:

```javascript
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

    return releases.map((release) => ({
      tag_name: release.tag_name,
      version: release.tag_name.replace(/^v/, ""),
      display_name: `Version ${release.tag_name.replace(/^v/, "")}`,
      url: release.html_url,
      published_at: release.published_at,
      body: release.body || "",
      summary: summarizeReleaseBody(release.body),
    }));
  } catch (error) {
    console.warn(`Failed to fetch releases list: ${error.message}`);
    return [];
  }
}
```

**Step 2: Update `main()` to write releases.json**

Update the `main()` function to also call `fetchReleases` and write the result:

```javascript
async function main() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const repo = getRepositorySlug(packageJson);
  const latestRelease =
    (await fetchLatestRelease(repo)) ??
    getLatestReleaseFromGit(repo) ??
    getLatestReleaseFromPackage(repo, packageJson.version);

  const releases = await fetchReleases(repo);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(latestRelease, null, 2)}\n`);

  const releasesPath = path.join(path.dirname(outputPath), "releases.json");
  await writeFile(releasesPath, `${JSON.stringify(releases, null, 2)}\n`);

  console.log(
    `Wrote docs latest release data for ${latestRelease.tag_name} to ${outputPath}`,
  );
  console.log(
    `Wrote ${releases.length} releases to ${releasesPath}`,
  );
}
```

**Step 3: Run the script locally to verify**

Run: `node scripts/generate-docs-release-data.mjs`
Expected: Both `docs/_data/latest_release.json` and `docs/_data/releases.json` are written. The releases file should contain an array of up to 10 release objects.

**Step 4: Commit**

```bash
git add scripts/generate-docs-release-data.mjs docs/_data/releases.json
git commit -m "feat: generate releases.json with last 10 GitHub releases for docs"
```

---

### Task 2: Rework the release notes page template

**Files:**
- Modify: `docs/release-notes/index.md`

**Step 1: Rewrite the page content**

Replace the entire content of `docs/release-notes/index.md` with:

```markdown
---
title: Release Notes
nav_group: project
kicker: Project Info
summary: Versioned release history for the server, including feature additions and notable behavior changes.
breadcrumbs:
  - title: Overview
    url: /
  - title: Project Info
    url: /project-information/
---
{% assign releases = site.data.releases %}
{% assign latest = site.data.latest_release %}

Releases are generated automatically by [semantic-release](https://github.com/semantic-release/semantic-release) from conventional commits. The current release is [{{ latest.tag_name }}]({{ latest.url }}).

{% for release in releases %}
## {{ release.display_name }}

<span class="release-date">{{ release.published_at | date: "%B %-d, %Y" }}</span>

{{ release.body | markdownify }}

[View on GitHub]({{ release.url }}){: .release-link }

{% endfor %}

{% if releases.size == 0 %}
Release data was unavailable during the last docs build. See the [GitHub Releases page](https://github.com/jflamb/fdic-mcp-server/releases) for the full history.
{% endif %}

[View all releases on GitHub](https://github.com/jflamb/fdic-mcp-server/releases){: .release-link }
```

**Step 2: Commit**

```bash
git add docs/release-notes/index.md
git commit -m "docs: rework release notes page to render inline changelog"
```

---

### Task 3: Add minimal CSS for release notes

**Files:**
- Modify: `docs/assets/css/docs.css`

**Step 1: Add release-specific styles**

Add these styles after the `.doc-callout` rules (around line 1150):

```css
.release-date {
  display: inline-block;
  margin-bottom: 0.75rem;
  font-size: 0.88rem;
  color: var(--muted);
}

.release-link {
  font-size: 0.88rem;
  color: var(--accent);
}
```

**Step 2: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "style: add release notes date and link styling"
```

---

### Task 4: Remove old manual release note pages and navigation

**Files:**
- Delete: `docs/release-notes/v1.1.0.md`
- Delete: `docs/release-notes/v1.1.1.md`
- Delete: `docs/release-notes/v1.1.2.md`
- Delete: `docs/release-notes/v1.1.3.md`
- Modify: `docs/_data/navigation.yml:56-70`

**Step 1: Delete the old version pages**

```bash
rm docs/release-notes/v1.1.0.md docs/release-notes/v1.1.1.md docs/release-notes/v1.1.2.md docs/release-notes/v1.1.3.md
```

**Step 2: Remove the release_notes section from navigation.yml**

Remove lines 56–70 from `docs/_data/navigation.yml` (the entire `release_notes:` section block). The release notes page remains accessible via the `project` section items list at line 54-55.

After removal, `navigation.yml` should end at line 55:

```yaml
      - title: Release Notes
        url: /release-notes/
```

**Step 3: Commit**

```bash
git add -u docs/release-notes/ docs/_data/navigation.yml
git commit -m "docs: remove old manual release note pages and nav section"
```

---

### Task 5: Update AGENTS.md with commit message quality norms

**Files:**
- Modify: `AGENTS.md:85-87`

**Step 1: Expand the conventional commit guidance**

After the existing bullet on line 86 ("Use conventional commit messages..."), add these bullets:

```markdown
- Write commit subjects that describe the user-facing change, not the implementation detail. "feat: add peer group benchmarking tool" is better than "feat: add new tool." "fix: correct deposit ranking for tied institutions" is better than "fix: update sort logic."
- Include a commit body when the subject alone is ambiguous or when the change has non-obvious implications. The body should explain why the change was made, not repeat what the diff shows.
- These norms matter because semantic-release derives the published changelog from commit messages. Better commits produce better release notes without manual curation.
```

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add commit message quality norms to AGENTS.md"
```

---

### Task 6: Validate the full build

**Step 1: Run the docs release data script**

Run: `node scripts/generate-docs-release-data.mjs`
Expected: Both data files written without errors.

**Step 2: Run the standard validation suite**

Run: `npm run typecheck && npm test && npm run build`
Expected: All pass — this change doesn't touch server code.

**Step 3: Verify releases.json content**

Check that `docs/_data/releases.json` is a non-empty array with the expected fields (`tag_name`, `version`, `body`, `published_at`, `url`).

**Step 4: Commit any final adjustments and push**

```bash
git push origin main
```
