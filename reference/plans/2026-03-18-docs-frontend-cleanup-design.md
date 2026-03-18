# Docs Frontend Cleanup — Design

**Date:** 2026-03-18
**Status:** Approved
**Approach:** A — Incremental in-place fixes (no new files, no architectural changes)

## Summary

Full sweep of the documentation site's frontend (CSS, JS) to fix bugs, close accessibility gaps, clean up CSS hygiene, improve robustness, and apply minor polish. All changes are edits to the existing three asset files: `docs.css`, `docs.js`, and `chatbot.js`.

## Tier 1: Bugs

### 1a. Undefined `--pine` variable (docs.css:772)

`var(--pine)` is referenced but never declared in `:root` or the dark mode block. Links inside assistant chat bubbles get no explicit color in browsers that don't inherit.

**Fix:** Replace `var(--pine)` with `var(--accent-deep)`, matching the link color used everywhere else on the site.

### 1b. Base pre overflow-x (docs.css:469)

The base `.doc-content pre` rule has `overflow-x: hidden`, which clips long lines outside of `.code-block` wrappers (e.g., in highlight blocks that JS doesn't enhance). The `.code-block pre` override already uses `auto`.

**Fix:** Change the base rule from `overflow-x: hidden` to `overflow-x: auto`.

## Tier 2: Accessibility

### 2a. Incomplete `prefers-reduced-motion` (docs.css:85-93)

Currently only disables `scroll-behavior` and the nav indicator transition. Chatbot loading animation, search pulse, and all hover/focus transitions still run.

**Fix:** Add a universal rule inside the existing `prefers-reduced-motion` block:

```css
*,
*::before,
*::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

Standard pattern (Andy Bell's CSS reset). Kills all motion without breaking layout-dependent properties.

### 2b. No `:focus` fallback for `:focus-visible` (docs.css:909-924)

Older browsers (Safari <15.4) don't support `:focus-visible`. Keyboard users on those browsers get no visible focus ring.

**Fix:** Add a `:focus` rule with the same gold outline for the same selectors, placed *before* the `:focus-visible` rule. Then add a `:focus:not(:focus-visible)` rule that removes the outline, so mouse clicks on modern browsers don't show the ring.

### 2c. Missing `-webkit-backdrop-filter` prefix (docs.css:103, 573, 1598)

`backdrop-filter` still needs the `-webkit-` prefix for Safari versions < 18.

**Fix:** Add `-webkit-backdrop-filter` alongside each `backdrop-filter` declaration at all three locations (site header, chatbot overlay backdrop, mobile nav).

## Tier 3: CSS Hygiene

### 3a. Add missing design tokens to `:root`

Two patterns are repeated throughout without tokens:

- `border-radius: 999px` — 12+ occurrences for pill shapes. Add `--radius-pill: 999px`.
- Transition durations `160ms` and `240ms` hardcoded throughout. Add `--duration-fast: 160ms` and `--duration-smooth: 240ms`.

Replace occurrences across the file. Makes values greppable and centrally tunable.

### 3b. Consolidate duplicated button base styles

`.chatbot-overlay__close` (line 618-629) duplicates much of the shared button rule at lines 206-229. Same `appearance: none`, `border: 0`, `border-radius`, `font: inherit`, `font-weight: 700`, `cursor: pointer`.

**Fix:** Add `.chatbot-overlay__close` to the shared selector group at line 206. Keep only the overrides (background color, min-height, padding) in the specific rule.

### 3c. Consolidate eyebrow text styles

`.chatbot-overlay__eyebrow` (lines 599-606) has the same font-size, weight, letter-spacing, transform, and color as the shared eyebrow group at lines 317-328, differing only in margin.

**Fix:** Add `.chatbot-overlay__eyebrow` to the shared selector group. Keep only the margin override in its own rule.

### 3d. Standardize focus-visible selectors

The focus-visible rule at lines 909-924 is missing several interactive elements: `.chatbot-launcher`, `.chatbot-overlay__close`, `.chatbot-demo__prompt`, `.chatbot-demo__send`, `.chatbot-demo__composer textarea`, `.chatbot-inline-open`, `.card`, `.brand`.

**Fix:** Add these selectors to the existing `:focus-visible` rule (and the new `:focus` fallback from 2b).

## Tier 4: Robustness

### 4a. Debounce window resize handler (docs.js:161)

`moveIndicator` fires on every resize frame, doing `getBoundingClientRect()` each time.

**Fix:** Wrap in the existing `debounce` utility with 100ms delay.

### 4b. Debounce mobile nav resize handler (docs.js:278-282)

Same issue — fires on every frame to check `window.innerWidth > 760`.

**Fix:** Same debounce pattern, 100ms.

### 4c. Use `textContent` for search result titles (docs.js:419)

`title.innerHTML = item.meta.title || item.url` — defense-in-depth fix. Titles shouldn't contain HTML markup. Leave `excerpt.innerHTML` alone since pagefind returns `<mark>` tags for highlighting.

**Fix:** Change to `title.textContent`.

### 4d. Reset search status on dialog close (docs.js:342-347)

"Searching..." status persists if dialog is closed mid-search and reopened.

**Fix:** Reset `status.textContent` and clear `results.innerHTML` in the `close()` function.

### 4e. Guard `sessionStorage` writes (chatbot.js:198)

`storeThread` writes without try/catch. Can throw in private browsing when storage is full.

**Fix:** Wrap the `setItem` call in try/catch, matching the existing pattern in `readStoredThread`.

## Tier 5: Minor Polish

### 5a. Name magic numbers in docs.js

Extract inline constants to named variables at the top of the file:

- `1800` (line 57) → `COPY_FEEDBACK_MS`
- `120` (line 437) → `SEARCH_DEBOUNCE_MS`
- `760` (line 279) → `MOBILE_BREAKPOINT`

### 5b. Comment heading level shift (chatbot.js:103)

`Math.min(headingMatch[1].length + 1, 6)` shifts headings down one level to maintain semantic hierarchy in chat bubbles. Correct but non-obvious.

**Fix:** Add inline comment explaining the +1 shift.

### 5c. Hide chatbot from print (docs.css print media query)

Print stylesheet hides header, nav, TOC but not `.chatbot-shell`.

**Fix:** Add `.chatbot-shell` to the `display: none !important` rule at line 1662.

## Files Changed

| File | Tiers |
|------|-------|
| `docs/assets/css/docs.css` | 1, 2, 3, 5 |
| `docs/assets/js/docs.js` | 4, 5 |
| `docs/assets/js/chatbot.js` | 4, 5 |

## Scope Boundaries

- No new files created
- No build tooling changes
- No HTML template changes
- No architectural restructuring
- CSS stays in a single file; JS stays in two files
