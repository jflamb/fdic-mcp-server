# IA Redesign & Section Nav Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split "Use the Server" into Setup and Prompting top-level sections, strip the section nav to a lightweight tab row, and move "Try It" to a CTA card.

**Architecture:** Navigation is driven by `docs/_data/navigation.yml` (primary nav + sections). Each page declares its `nav_group` in front matter. The section nav, breadcrumbs, and prev/next links all derive from the navigation data. CSS lives in `docs/assets/css/docs.css`, JS in `docs/assets/js/docs.js`.

**Tech Stack:** Jekyll, Liquid templates, vanilla CSS/JS

---

### Task 1: Update navigation.yml — restructure IA

**Files:**
- Modify: `docs/_data/navigation.yml`

**Step 1: Replace the navigation data**

Replace the entire file with:

```yaml
primary:
  - key: overview
    title: Home
    url: /
  - key: setup
    title: Setup
    url: /setup/
  - key: prompting
    title: Prompting
    url: /prompting/
  - key: project
    title: Project & Support
    url: /project-information/

sections:
  overview:
    title: Home
    items:
      - title: BankFind MCP Server
        short_title: Home
        url: /
  setup:
    title: Setup
    items:
      - title: Getting Started
        url: /getting-started/
      - title: Client Setup
        url: /clients/
      - title: Troubleshooting And FAQ
        short_title: Troubleshooting
        url: /troubleshooting/
  prompting:
    title: Prompting
    items:
      - title: Prompting Guide
        url: /prompting-guide/
      - title: Usage Examples
        url: /usage-examples/
  project:
    title: Project & Support
    items:
      - title: Project & Support
        short_title: Overview
        url: /project-information/
      - title: MCP Host Compatibility Matrix
        short_title: Compatibility
        url: /compatibility-matrix/
      - title: Support
        url: /support/
      - title: Contributing
        url: /contributing/
      - title: Security
        url: /security/
      - title: Release Notes
        url: /release-notes/
  release_notes:
    title: Release Notes
    parent: project
    items:
      - title: Release Notes
        short_title: Overview
        url: /release-notes/
      - title: Version 1.1.3
        url: /release-notes/v1.1.3/
      - title: Version 1.1.2
        url: /release-notes/v1.1.2/
      - title: Version 1.1.1
        url: /release-notes/v1.1.1/
      - title: Version 1.1.0
        url: /release-notes/v1.1.0/
```

Note: No "Overview" hub entries in the setup or prompting sections — the hub pages use a different URL (`/setup/`, `/prompting/`) and are not tab items. The tabs only contain the content pages.

**Step 2: Commit**

```bash
git add docs/_data/navigation.yml
git commit -m "refactor: restructure navigation — split user section into setup and prompting"
```

---

### Task 2: Create Setup hub page

**Files:**
- Create: `docs/setup.md`

**Step 1: Create the hub page**

```markdown
---
title: Setup
nav_group: setup
kicker: Get Connected
summary: Install, configure, and troubleshoot the BankFind MCP Server in your MCP host.
breadcrumbs:
  - title: Overview
    url: /
---

Get the server running in your MCP host, then use the troubleshooting guide if anything goes wrong.

<div class="card-grid">
  <a class="card" href="{{ '/getting-started/' | relative_url }}">
    <span class="card__eyebrow">Start Here</span>
    <h3>Getting Started</h3>
    <p>Start with a hosted MCP URL when your host supports it, or use the local install path when it does not.</p>
  </a>
  <a class="card" href="{{ '/clients/' | relative_url }}">
    <span class="card__eyebrow">Connect</span>
    <h3>Client Setup</h3>
    <p>Host-specific setup notes for Claude Desktop, ChatGPT, Gemini CLI, and GitHub Copilot CLI.</p>
  </a>
  <a class="card" href="{{ '/troubleshooting/' | relative_url }}">
    <span class="card__eyebrow">Fix Issues</span>
    <h3>Troubleshooting And FAQ</h3>
    <p>Resolve startup, transport, and dataset-selection issues before opening a support request.</p>
  </a>
</div>

<section class="doc-callout doc-callout--hero">
  <p class="doc-callout__eyebrow">Try It</p>
  <h2>Test the server from the docs</h2>
  <p>
    Use the floating chat button in the lower-right corner or press <code>?</code> to open the hosted demo assistant without leaving this page.
  </p>
  <p>
    <button type="button" class="chatbot-inline-open" data-chatbot-open>Open The Chat Launcher</button>
  </p>
</section>
```

**Step 2: Commit**

```bash
git add docs/setup.md
git commit -m "docs: add setup hub page"
```

---

### Task 3: Create Prompting hub page

**Files:**
- Create: `docs/prompting.md`

**Step 1: Create the hub page**

```markdown
---
title: Prompting
nav_group: prompting
kicker: Use It Well
summary: Write effective prompts for FDIC data queries, comparisons, and peer analysis.
breadcrumbs:
  - title: Overview
    url: /
---

Learn the prompt patterns that produce reliable results, then use the examples as starting points for your own queries.

<div class="card-grid">
  <a class="card" href="{{ '/prompting-guide/' | relative_url }}">
    <span class="card__eyebrow">Patterns</span>
    <h3>Prompting Guide</h3>
    <p>Prompt patterns that work well with FDIC data, dates, and comparison questions.</p>
  </a>
  <a class="card" href="{{ '/usage-examples/' | relative_url }}">
    <span class="card__eyebrow">Examples</span>
    <h3>Usage Examples</h3>
    <p>Copyable prompts and expected answer shapes for institution search, comparisons, and peer analysis.</p>
  </a>
  <a class="card" href="{{ '/tool-reference/' | relative_url }}">
    <span class="card__eyebrow">Reference</span>
    <h3>Tool Reference</h3>
    <p>Pick the right search, lookup, comparison, or peer-analysis tool before you start prompting.</p>
  </a>
</div>

<section class="doc-callout doc-callout--hero">
  <p class="doc-callout__eyebrow">Try It</p>
  <h2>Test prompts from the docs</h2>
  <p>
    Use the floating chat button in the lower-right corner or press <code>?</code> to open the hosted demo assistant without leaving this page.
  </p>
  <p>
    <button type="button" class="chatbot-inline-open" data-chatbot-open>Open The Chat Launcher</button>
  </p>
</section>
```

**Step 2: Commit**

```bash
git add docs/prompting.md
git commit -m "docs: add prompting hub page"
```

---

### Task 4: Update page front matter — nav_group and breadcrumbs

**Files:**
- Modify: `docs/getting-started.md` (lines 1-11)
- Modify: `docs/clients.md` (lines 1-11)
- Modify: `docs/troubleshooting.md` (lines 1-11)
- Modify: `docs/prompting-guide.md` (lines 1-11)
- Modify: `docs/usage-examples.md` (lines 1-11)
- Modify: `docs/tool-reference.md` (lines 1-11)
- Modify: `docs/try-it.md` (lines 1-12)

**Step 1: Update getting-started.md front matter**

Change `nav_group: user` to `nav_group: setup`, `kicker: User Docs` to `kicker: Setup`, and breadcrumbs to point to Setup:

```yaml
---
title: Getting Started
nav_group: setup
kicker: Setup
summary: Start with a hosted MCP URL when your host supports it, or use the local install path when you need a stdio server on your own machine.
breadcrumbs:
  - title: Overview
    url: /
  - title: Setup
    url: /setup/
---
```

**Step 2: Update clients.md front matter**

```yaml
---
title: Client Setup
nav_group: setup
kicker: Setup
summary: Configure the server in Claude Desktop, ChatGPT, Gemini CLI, or GitHub Copilot CLI, with transport-specific caveats called out.
breadcrumbs:
  - title: Overview
    url: /
  - title: Setup
    url: /setup/
---
```

**Step 3: Update troubleshooting.md front matter**

```yaml
---
title: Troubleshooting And FAQ
nav_group: setup
kicker: Setup
summary: Common setup failures, transport mismatches, dataset confusion, and prompt issues, with fast checks before escalation.
breadcrumbs:
  - title: Overview
    url: /
  - title: Setup
    url: /setup/
---
```

**Step 4: Update prompting-guide.md front matter**

```yaml
---
title: Prompting Guide
nav_group: prompting
kicker: Prompting
summary: Write prompts that state the right data type, date basis, geography, and comparison logic so the model can answer reliably.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---
```

**Step 5: Update usage-examples.md front matter**

```yaml
---
title: Usage Examples
nav_group: prompting
kicker: Prompting
summary: Copyable prompts for institution search, financial retrieval, snapshot comparison, and peer analysis, plus what a good answer should cover.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---
```

**Step 6: Update tool-reference.md front matter**

Tool Reference is standalone (not in any section tab row), so set `nav_group: prompting` for search indexing but do not add it to the sections in navigation.yml:

```yaml
---
title: Tool Reference
nav_group: prompting
kicker: Reference
summary: Decide which MCP tool to use based on whether you need raw records, direct lookups, cross-period comparisons, or peer benchmarking.
breadcrumbs:
  - title: Overview
    url: /
  - title: Prompting
    url: /prompting/
---
```

**Step 7: Update try-it.md front matter**

Remove from section nav by clearing `nav_group` (keep the page deployed for existing links):

```yaml
---
title: Try It
kicker: Interactive Demo
summary: Open the site-wide chat launcher from the lower-right corner or by pressing `?` anywhere in the docs.
breadcrumbs:
  - title: Overview
    url: /
body_class: page-try-it
---
```

**Step 8: Commit**

```bash
git add docs/getting-started.md docs/clients.md docs/troubleshooting.md docs/prompting-guide.md docs/usage-examples.md docs/tool-reference.md docs/try-it.md
git commit -m "refactor: update page front matter for new IA sections"
```

---

### Task 5: Update homepage card links

**Files:**
- Modify: `docs/index.md`

**Step 1: Update the "Browse by need" card grid**

Replace the card that links to `/user-guide/` with two cards pointing to the new hubs. The card linking to `/tool-reference/` stays. Replace lines 66-82:

```html
<div class="card-grid">
  <a class="card" href="{{ '/setup/' | relative_url }}">
    <span class="card__eyebrow">Setup</span>
    <h3>Install and configure</h3>
    <p>Installation, client setup for popular MCP hosts, and troubleshooting.</p>
  </a>
  <a class="card" href="{{ '/prompting/' | relative_url }}">
    <span class="card__eyebrow">Prompting</span>
    <h3>Write effective prompts</h3>
    <p>Prompt patterns, copyable examples, and guidance on dates, metrics, and dataset boundaries.</p>
  </a>
  <a class="card" href="{{ '/tool-reference/' | relative_url }}">
    <span class="card__eyebrow">Choose Tools</span>
    <h3>Find the right MCP tool</h3>
    <p>Pick the right search, lookup, comparison, or peer-analysis tool before you start prompting.</p>
  </a>
  <a class="card" href="{{ '/project-information/' | relative_url }}">
    <span class="card__eyebrow">Project &amp; Support</span>
    <h3>Compatibility, releases, and support</h3>
    <p>Release notes, support expectations, compatibility guidance, contribution workflow, and security reporting.</p>
  </a>
</div>
```

**Step 2: Commit**

```bash
git add docs/index.md
git commit -m "docs: update homepage cards for new IA structure"
```

---

### Task 6: Strip section nav to tab row only

**Files:**
- Modify: `docs/_includes/section-nav.html`

**Step 1: Remove the header block, keep only the tab links**

Replace the entire file with:

```html
{% assign current_section_key = nil %}
{% assign current_section = nil %}
{% for section_entry in site.data.navigation.sections %}
  {% assign section_key = section_entry[0] %}
  {% assign section_data = section_entry[1] %}
  {% for item in section_data.items %}
    {% if item.url == page.url %}
      {% assign current_section_key = section_key %}
      {% assign current_section = section_data %}
    {% endif %}
  {% endfor %}
{% endfor %}

{% if current_section and current_section.items.size > 1 %}
<nav class="section-nav" aria-label="{{ current_section.title }} pages">
  <div class="section-nav__links">
    {% for item in current_section.items %}
    <a href="{{ item.url | relative_url }}"{% if item.url == page.url %} class="is-active" aria-current="page"{% endif %}>
      {{ item.short_title | default: item.title }}
    </a>
    {% endfor %}
  </div>
</nav>
{% endif %}
```

Key changes:
- Remove `section-nav__header` (eyebrow, title, description)
- Remove `section-nav__links-wrap` wrapper (no longer needed without the header)
- Change from `<section>` to `<nav>` since it's purely navigation now

**Step 2: Commit**

```bash
git add docs/_includes/section-nav.html
git commit -m "refactor: strip section nav to lightweight tab row"
```

---

### Task 7: Update section nav CSS — remove card styling, soften tabs

**Files:**
- Modify: `docs/assets/css/docs.css`

**Step 1: Replace the `.section-nav` container styles**

Find the `.section-nav` block (around line 356) and replace:

```css
.section-nav {
  margin-bottom: 1.25rem;
  padding: 1rem 1.1rem 1.15rem;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, rgba(13, 122, 102, 0.08), rgba(207, 154, 53, 0.1));
  border: 1px solid rgba(13, 122, 102, 0.08);
}
```

With:

```css
.section-nav {
  margin-bottom: 0.75rem;
}
```

**Step 2: Remove `.section-nav__header` rules**

Delete the `.section-nav__header` rule (around line 364):

```css
.section-nav__header {
  margin-bottom: 0.9rem;
}
```

**Step 3: Remove `.section-nav__links-wrap` rules**

Delete the `.section-nav__links-wrap` block (around line 394):

```css
.section-nav__links-wrap {
  position: relative;
  max-width: 100%;
  overflow-x: clip;
}
```

**Step 4: Update `.section-nav__links a` — soften inactive tabs**

Replace the base link styles (background, box-shadow) with text-only inactive styling:

```css
.section-nav__links a {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-pill);
  color: var(--muted);
  text-decoration: none;
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease;
}

.section-nav__links a:hover {
  color: var(--ink-soft);
}

.section-nav__links a:hover,
.section-nav__links a.is-active {
  color: var(--surface-strong);
  background: var(--ink);
}
```

**Step 5: Update the `.section-nav--animated` rules**

```css
.section-nav--animated .section-nav__links a {
  background: transparent;
}

.section-nav--animated .section-nav__links a:hover {
  color: var(--ink-soft);
}

.section-nav--animated .section-nav__links a.is-active {
  color: var(--surface-strong);
}
```

**Step 6: Remove the mobile `.section-nav__links-wrap::after` fade gradient**

In the `@media (max-width: 960px)` block, remove the `.section-nav__links-wrap::after` rule and the mobile `.section-nav` padding override. Keep the `.section-nav__links` horizontal scroll rules but update the selector since `.section-nav__links-wrap` is gone:

```css
@media (max-width: 960px) {
  .section-nav__links {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 0.15rem;
  }

  .section-nav__links a {
    flex: 0 0 auto;
  }
}
```

Remove the mobile `.section-nav` padding rule from `@media (max-width: 760px)`.

**Step 7: Update dark mode overrides**

Remove the `.section-nav__links-wrap::after` dark mode overrides (both `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` versions).

Update the dark mode `.section-nav__links a` overrides to only set color (no background needed for inactive text-only tabs):

In the `prefers-color-scheme` block:
```css
  :root:not([data-theme="light"]) .section-nav__links a:hover,
  :root:not([data-theme="light"]) .section-nav__links a.is-active {
    background: var(--ink);
    color: var(--surface-strong);
  }

  :root:not([data-theme="light"]) .section-nav--animated .section-nav__links a {
    background: transparent;
  }

  :root:not([data-theme="light"]) .section-nav__indicator {
    background: var(--ink);
  }
```

In the `[data-theme="dark"]` block:
```css
[data-theme="dark"] .section-nav__links a:hover,
[data-theme="dark"] .section-nav__links a.is-active {
  background: var(--ink);
  color: var(--surface-strong);
}

[data-theme="dark"] .section-nav--animated .section-nav__links a {
  background: transparent;
}

[data-theme="dark"] .section-nav__indicator {
  background: var(--ink);
}
```

Remove `[data-theme="dark"] .section-nav__links a` from the bulk dark-background rule (lines ~1956-1965) since inactive tabs are now text-only and don't need a background override.

**Step 8: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "style: strip section nav to lightweight tab row with text-only inactive tabs"
```

---

### Task 8: Update section nav JS — adjust for removed wrapper

**Files:**
- Modify: `docs/assets/js/docs.js`

**Step 1: Update `initSectionNavIndicator`**

The function currently queries `.section-nav__links` inside the section. Since we removed `.section-nav__links-wrap`, the `.section-nav__links` div is now a direct child of `.section-nav`. The JS already queries `.section-nav__links` so this should work without changes, but verify that:

1. `section.querySelector(".section-nav__links")` still finds the container
2. The indicator positioning works without the intermediate wrapper

If `.section-nav__links-wrap` was the `position: relative` ancestor used for indicator positioning, move `position: relative` to `.section-nav__links` in CSS (it's already there from the earlier change).

**Step 2: Test locally**

Run: `cd docs && bundle exec jekyll serve`

Verify:
- Tab indicator appears on the active tab
- Indicator slides to hovered tabs
- Indicator returns to active tab on mouse leave
- Works in both light and dark mode

**Step 3: Commit (if any JS changes needed)**

```bash
git add docs/assets/js/docs.js
git commit -m "fix: update section nav indicator for simplified markup"
```

---

### Task 9: Remove old user-guide hub page

**Files:**
- Modify: `docs/user-guide.md`

**Step 1: Convert to a redirect**

The old `/user-guide/` URL may be bookmarked or linked externally. Convert it to a redirect to `/setup/` using Jekyll's redirect plugin or a meta refresh. Since Jekyll redirects depend on plugin support, use a simple page that redirects:

```markdown
---
title: Use the Server
redirect_to: /setup/
sitemap: false
---

This page has moved. If you are not redirected, go to [Setup]({{ '/setup/' | relative_url }}).
```

Check if the site uses `jekyll-redirect-from` plugin. If not, use a layout-free meta refresh approach or simply update the page content to point users to the new sections.

**Step 2: Commit**

```bash
git add docs/user-guide.md
git commit -m "docs: redirect old user-guide hub to setup"
```

---

### Task 10: Verify and test locally

**Step 1: Run Jekyll locally**

```bash
cd docs && bundle exec jekyll serve
```

**Step 2: Verify the following**

- [ ] Top nav shows: Home, Setup, Prompting, Project & Support
- [ ] Top nav indicator animates between the 4 items
- [ ] Setup hub (`/setup/`) shows card grid with 3 cards + Try It CTA
- [ ] Prompting hub (`/prompting/`) shows card grid with 3 cards + Try It CTA
- [ ] Getting Started, Client Setup, Troubleshooting pages show "Setup" tab row with 3 tabs
- [ ] Prompting Guide, Usage Examples pages show "Prompting" tab row with 2 tabs
- [ ] Tab row has no header/card container — just pill buttons
- [ ] Tab indicator animates between tabs on hover
- [ ] Breadcrumbs show correct hierarchy (e.g., Overview / Setup / Getting Started)
- [ ] Prev/next links work within each section
- [ ] Tool Reference page has no tab row (standalone)
- [ ] Try It page has no tab row (standalone)
- [ ] `/user-guide/` redirects to `/setup/`
- [ ] Homepage cards link to new sections
- [ ] Dark mode: all tabs legible, indicator visible
- [ ] Mobile: tabs scroll horizontally, no layout breaks
- [ ] Search still works and returns results with correct section labels

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during local testing"
```

---

### Task 11: Final push

**Step 1: Push to remote**

```bash
git push origin main
```

**Step 2: Verify the deployed site**

Check https://jflamb.github.io/fdic-mcp-server/ after GitHub Pages rebuilds.
