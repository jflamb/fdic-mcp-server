import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("docs site review v2 follow-up", () => {
  it("keeps section navigation descriptive without introducing a heading before the page h1", () => {
    const sectionNav = readRepoFile("docs/_includes/section-nav.html");

    expect(sectionNav).toContain('<p class="section-nav__title">');
    expect(sectionNav).not.toContain("<h2>");
  });

  it("marks desktop and mobile page toc containers as navigation landmarks", () => {
    const pageToc = readRepoFile("docs/_includes/page-toc.html");
    const mobilePageToc = readRepoFile("docs/_includes/mobile-page-toc.html");

    expect(pageToc).toContain('<nav class="page-toc" aria-label="On this page"');
    expect(mobilePageToc).toContain('<nav class="mobile-page-toc" aria-label="On this page"');
  });

  it("keeps the mobile nav toggle labeled and the search dialog focus-managed", () => {
    const layout = readRepoFile("docs/_layouts/default.html");
    const docsScript = readRepoFile("docs/assets/js/docs.js");

    expect(layout).toContain('aria-label="Site navigation"');
    expect(docsScript).toContain('panel.addEventListener("keydown"');
    expect(docsScript).toContain('results.dataset.loading = isLoading ? "true" : "false"');
  });

  it("removes the redundant getting started read-next block and keeps print cleanup styles", () => {
    const gettingStarted = readRepoFile("docs/getting-started.md");
    const docsCss = readRepoFile("docs/assets/css/docs.css");

    expect(gettingStarted).not.toContain("## What To Read Next");
    expect(docsCss).toContain("@media print");
    expect(docsCss).toContain(".prev-next");
    expect(docsCss).toContain(".site-footer");
  });
});
