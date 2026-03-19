# Docs IA Redesign & Section Nav Visual Refresh

**Date:** 2026-03-18

## Problem

The "Use the Server" section holds 7 pages spanning setup, prompting, examples, troubleshooting, and an interactive demo. The section nav tab row is overcrowded, and its card-style header (eyebrow + title + description) competes with the page header for visual hierarchy. "Try It" is a thin page that duplicates the site-wide chat launcher.

## Design Decisions

### 1. Information Architecture

Split "Use the Server" into two top-level sections. Top nav changes from 3 to 4 items:

| Before              | After              |
|---------------------|--------------------|
| Home                | Home               |
| Use the Server      | Setup              |
| Project & Support   | Prompting          |
|                     | Project & Support  |

**Setup section:**
- Getting Started
- Client Setup
- Troubleshooting

**Prompting section:**
- Prompting Guide
- Usage Examples

**Removed from tab nav:**
- "Use the Server" hub page — content redistributed into new section hubs
- "Try It" — becomes a CTA card on hub pages; page stays deployed but exits navigation
- "Overview" tabs — removed from all sections; breadcrumbs provide this context
- Tool Reference — standalone page linked from prompting hub and usage examples, not in tabs

**Project & Support** — unchanged.

### 2. Section Nav Visual Changes

Strip the section nav component to just the tab row:
- Remove eyebrow ("IN THIS SECTION"), title, and description
- Remove card container (gradient background, border, extra padding)
- Tabs sit directly between breadcrumbs and page header

Soften inactive tab styling:
- Inactive tabs: text-only, no background or inset shadow, `color: var(--muted)` with hover transition
- Active tab: keeps solid pill treatment via the animated indicator

Tighten vertical spacing:
- Reduce gap between breadcrumbs, tabs, and page header so they read as one wayfinding block

### 3. "Try It" CTA

- Remove from section nav
- Add CTA card on homepage and both new hub pages pointing to the chat launcher
- Page remains deployed (no broken links) but is no longer in navigation

### 4. Hub Pages

Each new section gets a hub page:
- **Setup hub** — intro, card links to Getting Started / Client Setup / Troubleshooting, "Try It" CTA
- **Prompting hub** — intro, card links to Prompting Guide / Usage Examples, link to Tool Reference, "Try It" CTA

Content sourced from the existing user-guide.md hub page.
