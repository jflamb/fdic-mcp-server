import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("docs site review v2 follow-up", () => {
  it("keeps section navigation as a lightweight tab row without headings", () => {
    const sectionNav = readRepoFile("docs/_includes/section-nav.html");

    expect(sectionNav).toContain('<nav class="section-nav"');
    expect(sectionNav).toContain('class="section-nav__links"');
    expect(sectionNav).not.toContain("<h2>");
    expect(sectionNav).not.toContain("<h3>");
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

  it("loads the chatbot launcher from the shared layout and keeps the fallback page", () => {
    const layout = readRepoFile("docs/_layouts/default.html");
    const tryItPage = readRepoFile("docs/try-it.md");
    const chatbotScript = readRepoFile("docs/assets/js/chatbot.js");

    expect(layout).toContain("data-chat-endpoint=\"https://bankfind.jflamb.com/chat\"");
    expect(layout).toContain("/assets/js/chatbot.js");
    expect(tryItPage).toContain("data-chatbot-open");
    expect(tryItPage).toContain("press <code>?</code>");
    expect(chatbotScript).toContain("data-chatbot-launcher");
    expect(chatbotScript).toContain("Open the FDIC BankFind chat demo");
    expect(chatbotScript).toContain("Rate limit reached");
    expect(chatbotScript).toContain("sanitizeHref");
    expect(chatbotScript).toContain("startsWith(\"```\")");
  });
});
