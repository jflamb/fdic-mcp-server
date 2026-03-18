# Docs Frontend Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bugs, accessibility gaps, CSS hygiene issues, robustness problems, and minor polish across the docs site's three frontend assets.

**Architecture:** Incremental in-place edits to `docs/assets/css/docs.css`, `docs/assets/js/docs.js`, and `docs/assets/js/chatbot.js`. No new files, no build changes, no HTML template changes.

**Tech Stack:** Vanilla CSS, vanilla JS (ES6+), Jekyll static site

**Design doc:** `docs/plans/2026-03-18-docs-frontend-cleanup-design.md`

---

### Task 1: Fix bugs (Tier 1)

**Files:**
- Modify: `docs/assets/css/docs.css:772` (undefined `--pine` variable)
- Modify: `docs/assets/css/docs.css:469` (base pre overflow)

**Step 1: Fix undefined `--pine` variable**

In `docs/assets/css/docs.css`, find line 772:

```css
.chatbot-demo__message--assistant .chatbot-demo__bubble a {
  color: var(--pine);
}
```

Replace `var(--pine)` with `var(--accent-deep)`.

**Step 2: Fix base pre overflow-x**

In `docs/assets/css/docs.css`, find line 469 inside the `.doc-content pre, .doc-content .highlight pre` rule:

```css
  overflow-x: hidden;
```

Change to:

```css
  overflow-x: auto;
```

**Step 3: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "fix: resolve undefined --pine variable and base pre overflow clipping"
```

---

### Task 2: Accessibility — reduced motion (Tier 2a)

**Files:**
- Modify: `docs/assets/css/docs.css:85-93`

**Step 1: Expand the `prefers-reduced-motion` media query**

Find the existing block at line 85:

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .top-nav__indicator {
    transition: none;
  }
}
```

Replace with:

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The universal rule subsumes the `.top-nav__indicator` rule, so remove it.

**Step 2: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "fix(a11y): disable all animations and transitions for prefers-reduced-motion"
```

---

### Task 3: Accessibility — focus fallback and webkit prefix (Tier 2b, 2c)

**Files:**
- Modify: `docs/assets/css/docs.css:103` (webkit prefix — site header)
- Modify: `docs/assets/css/docs.css:573` (webkit prefix — chatbot overlay)
- Modify: `docs/assets/css/docs.css:1598` (webkit prefix — mobile nav)
- Modify: `docs/assets/css/docs.css:909-924` (focus fallback)

**Step 1: Add `-webkit-backdrop-filter` at site header (line 103)**

Find:

```css
  backdrop-filter: blur(18px);
```

Replace with:

```css
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
```

**Step 2: Add `-webkit-backdrop-filter` at chatbot overlay backdrop (line 573)**

Find:

```css
  backdrop-filter: blur(12px);
```

Replace with:

```css
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
```

**Step 3: Add `-webkit-backdrop-filter` at mobile nav (line 1598)**

Find:

```css
  backdrop-filter: blur(10px);
```

Replace with:

```css
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
```

**Step 4: Add `:focus` fallback before the `:focus-visible` rule**

Find the existing `:focus-visible` block (around line 909). Add TWO new rule blocks immediately BEFORE it.

First, the `:focus` fallback (for older browsers that don't support `:focus-visible`):

```css
.copy-button:focus,
.search-button:focus,
.nav-toggle:focus,
.mobile-nav__close:focus,
.search-dialog__close:focus,
.search-dialog__input:focus,
.section-nav__links a:focus,
.top-nav a:focus,
.prev-next__link:focus,
.search-result:focus,
.mobile-page-toc summary:focus,
.page-toc a:focus,
.mobile-page-toc a:focus,
.chatbot-launcher:focus,
.chatbot-overlay__close:focus,
.chatbot-demo__prompt:focus,
.chatbot-demo__send:focus,
.chatbot-demo__composer textarea:focus,
.chatbot-inline-open:focus,
.card:focus,
.brand:focus {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

Then, the `:focus:not(:focus-visible)` reset (hides the ring on mouse click in browsers that DO support `:focus-visible`):

```css
.copy-button:focus:not(:focus-visible),
.search-button:focus:not(:focus-visible),
.nav-toggle:focus:not(:focus-visible),
.mobile-nav__close:focus:not(:focus-visible),
.search-dialog__close:focus:not(:focus-visible),
.search-dialog__input:focus:not(:focus-visible),
.section-nav__links a:focus:not(:focus-visible),
.top-nav a:focus:not(:focus-visible),
.prev-next__link:focus:not(:focus-visible),
.search-result:focus:not(:focus-visible),
.mobile-page-toc summary:focus:not(:focus-visible),
.page-toc a:focus:not(:focus-visible),
.mobile-page-toc a:focus:not(:focus-visible),
.chatbot-launcher:focus:not(:focus-visible),
.chatbot-overlay__close:focus:not(:focus-visible),
.chatbot-demo__prompt:focus:not(:focus-visible),
.chatbot-demo__send:focus:not(:focus-visible),
.chatbot-demo__composer textarea:focus:not(:focus-visible),
.chatbot-inline-open:focus:not(:focus-visible),
.card:focus:not(:focus-visible),
.brand:focus:not(:focus-visible) {
  outline: none;
}
```

**Step 5: Update the existing `:focus-visible` rule to include the new selectors**

Replace the existing `:focus-visible` block with:

```css
.copy-button:focus-visible,
.search-button:focus-visible,
.nav-toggle:focus-visible,
.mobile-nav__close:focus-visible,
.search-dialog__close:focus-visible,
.search-dialog__input:focus-visible,
.section-nav__links a:focus-visible,
.top-nav a:focus-visible,
.prev-next__link:focus-visible,
.search-result:focus-visible,
.mobile-page-toc summary:focus-visible,
.page-toc a:focus-visible,
.mobile-page-toc a:focus-visible,
.chatbot-launcher:focus-visible,
.chatbot-overlay__close:focus-visible,
.chatbot-demo__prompt:focus-visible,
.chatbot-demo__send:focus-visible,
.chatbot-demo__composer textarea:focus-visible,
.chatbot-inline-open:focus-visible,
.card:focus-visible,
.brand:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

**Step 6: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "fix(a11y): add webkit backdrop-filter prefix and focus fallback for older browsers"
```

---

### Task 4: CSS hygiene — design tokens (Tier 3a)

**Files:**
- Modify: `docs/assets/css/docs.css:1-31` (`:root` tokens)
- Modify: `docs/assets/css/docs.css` (all occurrences of `999px`, `160ms`, `240ms`)

**Step 1: Add new tokens to `:root`**

In the `:root` block, after `--radius-sm: 12px;` (line 25), add:

```css
  --radius-pill: 999px;
  --duration-fast: 160ms;
  --duration-smooth: 240ms;
```

**Step 2: Replace all `border-radius: 999px` with `var(--radius-pill)`**

Use find-and-replace across the file. The occurrences are in:
- `.skip-link` (line 73)
- `.top-nav a` (line 162)
- `.top-nav__indicator` (line 191)
- `.search-button, .nav-toggle, .mobile-nav__close, .search-dialog__close` (line 212)
- `.search-button__hint` (line 241)
- `.section-nav__links a` (line 359)
- `.chatbot-inline-open` (line 507)
- `.chatbot-launcher` (line 531)
- `.chatbot-overlay__close` (line 621)
- `.chatbot-demo__send` (line 812)
- `.chatbot-demo__loading span` (line 847)
- `.copy-button` (line 894)
- `.search-result__meta` (line 1358)

Replace all `border-radius: 999px` with `border-radius: var(--radius-pill)`.

**Step 3: Replace `160ms` transition durations with `var(--duration-fast)`**

Replace occurrences throughout the file. These are in transition shorthand values like `transition: transform 160ms ease`. Replace the `160ms` portion with `var(--duration-fast)`.

Key locations:
- `.skip-link` transition (line 78)
- `.top-nav a` transition (line 165)
- `.search-button, .nav-toggle...` transition (line 219)
- `.top-nav__indicator` opacity transition (line 203)
- `.chatbot-launcher` transition (line 536)
- `.chatbot-overlay__close` — none currently, skip
- `.chatbot-demo__prompt` transition (line 651)
- `.card` transition (line 1016)
- `.chatbot-open .chatbot-launcher` transition (line 560)

Note: The `120ms` value on line 560 (`.chatbot-open .chatbot-launcher`) is intentionally different — leave it.

**Step 4: Replace `240ms` transition durations with `var(--duration-smooth)`**

The `.top-nav__indicator` transition (lines 200-202) uses `240ms` for transform, width, and height. Replace those with `var(--duration-smooth)`.

**Step 5: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "refactor(css): extract --radius-pill, --duration-fast, --duration-smooth tokens"
```

---

### Task 5: CSS hygiene — consolidate duplicates (Tier 3b, 3c)

**Files:**
- Modify: `docs/assets/css/docs.css:206-229` (shared button rule)
- Modify: `docs/assets/css/docs.css:618-629` (chatbot close button)
- Modify: `docs/assets/css/docs.css:317-328` (shared eyebrow rule)
- Modify: `docs/assets/css/docs.css:599-606` (chatbot eyebrow)

**Step 1: Add `.chatbot-overlay__close` to the shared button selector**

Find the selector group at line 206:

```css
.search-button,
.nav-toggle,
.mobile-nav__close,
.search-dialog__close {
```

Add `.chatbot-overlay__close` to it:

```css
.search-button,
.nav-toggle,
.mobile-nav__close,
.search-dialog__close,
.chatbot-overlay__close {
```

**Step 2: Also add `.chatbot-overlay__close` to the hover selector group**

Find the hover rule at line 222:

```css
.search-button:hover,
.nav-toggle:hover,
.mobile-nav__close:hover,
.search-dialog__close:hover {
```

Add:

```css
.search-button:hover,
.nav-toggle:hover,
.mobile-nav__close:hover,
.search-dialog__close:hover,
.chatbot-overlay__close:hover {
```

**Step 3: Reduce `.chatbot-overlay__close` to overrides only**

Replace the full `.chatbot-overlay__close` rule (around line 618) from:

```css
.chatbot-overlay__close {
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: rgba(16, 34, 29, 0.08);
  color: var(--ink);
  min-height: 2.6rem;
  padding: 0 0.9rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
```

To just the overrides (properties that differ from the shared rule):

```css
.chatbot-overlay__close {
  background: rgba(16, 34, 29, 0.08);
  color: var(--ink);
  min-height: 2.6rem;
  padding: 0 0.9rem;
}
```

**Step 4: Add `.chatbot-overlay__eyebrow` to the shared eyebrow selector**

Find the eyebrow selector group at line 317:

```css
.section-nav__eyebrow,
.page-toc__eyebrow,
.search-dialog__eyebrow,
.mobile-nav__eyebrow,
.doc-callout__eyebrow {
```

Add `.chatbot-overlay__eyebrow`:

```css
.section-nav__eyebrow,
.page-toc__eyebrow,
.search-dialog__eyebrow,
.mobile-nav__eyebrow,
.doc-callout__eyebrow,
.chatbot-overlay__eyebrow {
```

**Step 5: Reduce `.chatbot-overlay__eyebrow` to margin override only**

Replace the full `.chatbot-overlay__eyebrow` rule (around line 599) from:

```css
.chatbot-overlay__eyebrow {
  margin: 0 0 0.2rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}
```

To just:

```css
.chatbot-overlay__eyebrow {
  margin: 0 0 0.2rem;
}
```

Note: The shared eyebrow has `font-size: 0.76rem` vs the original `0.75rem`. This 0.01rem difference is imperceptible — accept the shared value.

**Step 6: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "refactor(css): consolidate duplicate button and eyebrow styles"
```

---

### Task 6: CSS polish — print and dark mode token (Tier 3a addendum, 5c)

**Files:**
- Modify: `docs/assets/css/docs.css` (print media query, dark mode tokens)

**Step 1: Add `.chatbot-shell` to print hide rule**

Find the print `display: none` rule (around line 1662):

```css
  .skip-link,
  .site-header,
  .section-nav,
  .page-toc,
  .mobile-page-toc,
  .prev-next,
  .site-footer,
  .search-dialog {
    display: none !important;
  }
```

Add `.chatbot-shell`:

```css
  .skip-link,
  .site-header,
  .section-nav,
  .page-toc,
  .mobile-page-toc,
  .prev-next,
  .site-footer,
  .search-dialog,
  .chatbot-shell {
    display: none !important;
  }
```

**Step 2: Add new tokens to dark mode `:root`**

The dark mode `:root` block doesn't need overrides for `--radius-pill` or duration tokens (they're the same in both themes), so no changes needed here. Skip.

**Step 3: Commit**

```bash
git add docs/assets/css/docs.css
git commit -m "fix: hide chatbot shell in print stylesheet"
```

---

### Task 7: JS robustness — docs.js (Tier 4a, 4b, 4c, 4d, 5a)

**Files:**
- Modify: `docs/assets/js/docs.js`

**Step 1: Add named constants at the top of docs.js**

After the existing `SEARCH_SCRIPT_PATH` constant (line 1), add:

```js
const COPY_FEEDBACK_MS = 1800;
const SEARCH_DEBOUNCE_MS = 120;
const RESIZE_DEBOUNCE_MS = 100;
const MOBILE_BREAKPOINT = 760;
```

**Step 2: Replace magic number in copy button feedback (line 57)**

Find:

```js
      }, 1800);
```

Replace with:

```js
      }, COPY_FEEDBACK_MS);
```

**Step 3: Debounce the window resize handler in initPrimaryNavIndicator (line 161)**

Find:

```js
    window.addEventListener("resize", () => moveIndicator(pinnedLink, true));
```

Replace with:

```js
    window.addEventListener("resize", debounce(() => moveIndicator(pinnedLink, true), RESIZE_DEBOUNCE_MS));
```

**Step 4: Debounce the mobile nav resize handler (line 278)**

Find:

```js
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      setOpen(false);
    }
  });
```

Replace with:

```js
  window.addEventListener("resize", debounce(() => {
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      setOpen(false);
    }
  }, RESIZE_DEBOUNCE_MS));
```

**Step 5: Use textContent for search result titles (line 419)**

Find:

```js
        title.innerHTML = item.meta.title || item.url;
```

Replace with:

```js
        title.textContent = item.meta.title || item.url;
```

**Step 6: Reset search status on dialog close (line 342-347)**

Find the `close` function:

```js
  const close = () => {
    dialog.hidden = true;
    document.body.style.overflow = "";
    setSearchLoading(false);
    activeTrigger?.focus();
  };
```

Replace with:

```js
  const close = () => {
    dialog.hidden = true;
    document.body.style.overflow = "";
    setSearchLoading(false);
    status.textContent = "Start typing to search the documentation.";
    results.innerHTML = "";
    activeTrigger?.focus();
  };
```

**Step 7: Replace search debounce magic number (line 437)**

Find:

```js
  }, 120);
```

Replace with:

```js
  }, SEARCH_DEBOUNCE_MS);
```

**Step 8: Commit**

```bash
git add docs/assets/js/docs.js
git commit -m "fix: debounce resize handlers, harden search, extract named constants in docs.js"
```

---

### Task 8: JS robustness — chatbot.js (Tier 4e, 5b)

**Files:**
- Modify: `docs/assets/js/chatbot.js:103` (heading comment)
- Modify: `docs/assets/js/chatbot.js:197-199` (guard sessionStorage write)

**Step 1: Add comment to heading level shift (line 103)**

Find:

```js
      const level = Math.min(headingMatch[1].length + 1, 6);
```

Replace with:

```js
      // Shift heading level down by 1 (h1→h2, etc.) to preserve semantic hierarchy inside chat bubbles
      const level = Math.min(headingMatch[1].length + 1, 6);
```

**Step 2: Guard sessionStorage write in storeThread (line 197-199)**

Find:

```js
const storeThread = (messages) => {
  window.sessionStorage.setItem(CHATBOT_THREAD_KEY, JSON.stringify(messages));
};
```

Replace with:

```js
const storeThread = (messages) => {
  try {
    window.sessionStorage.setItem(CHATBOT_THREAD_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage may be unavailable or full in private browsing
  }
};
```

**Step 3: Commit**

```bash
git add docs/assets/js/chatbot.js
git commit -m "fix: guard sessionStorage write and document heading level shift in chatbot.js"
```

---

### Task 9: Verify all changes

**Step 1: Review the full diff since starting**

```bash
git diff HEAD~8 --stat
```

Verify only three files changed: `docs/assets/css/docs.css`, `docs/assets/js/docs.js`, `docs/assets/js/chatbot.js`.

**Step 2: Spot-check the CSS is valid**

Open `docs/assets/css/docs.css` and verify:
- No unclosed braces
- `var(--pine)` no longer appears anywhere
- `var(--radius-pill)` appears where `999px` used to be
- `var(--duration-fast)` and `var(--duration-smooth)` appear in transition values
- The `:focus`, `:focus:not(:focus-visible)`, and `:focus-visible` rules are in order
- `-webkit-backdrop-filter` appears before `backdrop-filter` in 3 locations
- `.chatbot-shell` is in the print hide rule

**Step 3: Spot-check the JS is valid**

Open `docs/assets/js/docs.js` and verify:
- Named constants at top
- `debounce(` wraps both resize handlers
- `title.textContent` instead of `title.innerHTML`
- `close()` resets status text and clears results

Open `docs/assets/js/chatbot.js` and verify:
- Comment above heading level line
- `storeThread` has try/catch

**Step 4: Build the Jekyll site locally (if available)**

```bash
cd docs && bundle exec jekyll build 2>&1 | tail -5
```

If Jekyll is not installed, skip — the changes are CSS/JS only and don't affect the build pipeline.
