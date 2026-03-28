---
name: fdic-mcp-server-conventions
description: Development conventions and patterns for fdic-mcp-server. TypeScript Express project with mixed commits.
---

# Fdic Mcp Server Conventions

> Generated from [jflamb/fdic-mcp-server](https://github.com/jflamb/fdic-mcp-server) on 2026-03-21

## Overview

This skill teaches Claude the development patterns and conventions used in fdic-mcp-server.

## Tech Stack

- **Primary Language**: TypeScript
- **Framework**: Express
- **Architecture**: type-based module organization
- **Test Location**: separate
- **Test Framework**: vitest

## When to Use This Skill

Activate this skill when:
- Making changes to this repository
- Adding new features following established patterns
- Writing tests that match project conventions
- Creating commits with proper message format

## Commit Conventions

Follow these commit message conventions based on 165 analyzed commits.

### Commit Style: Mixed Style

### Prefixes Used

- `fix`
- `docs`
- `feat`
- `refactor`

### Message Guidelines

- Average message length: ~49 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
chore: gitignore generated release data files
```

*Commit message example*

```text
fix: align send button bottom position with launcher button
```

*Commit message example*

```text
test: update section nav test for lightweight tab row design
```

*Commit message example*

```text
docs: add commit message quality norms to AGENTS.md
```

*Commit message example*

```text
style: add release notes date and link styling
```

*Commit message example*

```text
fix: enlarge chatbot button icons and align send button with launcher
```

*Commit message example*

```text
docs: remove old manual release note pages and nav section
```

*Commit message example*

```text
docs: rework release notes page to render inline changelog
```

## Architecture

### Project Structure: Single Package

This project uses **type-based** module organization.

### Source Layout

```
src/
├── resources/
├── schemas/
├── services/
├── tools/
```

### Entry Points

- `src/index.ts`

### Configuration Files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-cloud-run.yml`
- `.github/workflows/pages.yml`
- `.github/workflows/publish.yml`
- `Dockerfile`
- `package.json`
- `playwright.config.ts`
- `tsconfig.json`
- `vitest.config.ts`

### Guidelines

- Group code by type (components, services, utils)
- Keep related functionality in the same type folder
- Avoid circular dependencies between type folders

## Code Style

### Language: TypeScript

### Naming Conventions

| Element | Convention |
|---------|------------|
| Files | camelCase |
| Functions | camelCase |
| Classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |

### Import Style: Relative Imports

### Export Style: Named Exports


*Preferred import style*

```typescript
// Use relative imports
import { Button } from '../components/Button'
import { useAuth } from './hooks/useAuth'
```

*Preferred export style*

```typescript
// Use named exports
export function calculateTotal() { ... }
export const TAX_RATE = 0.1
export interface Order { ... }
```

## Testing

### Test Framework: vitest

### File Pattern: `*.test.ts`

### Test Types

- **Unit tests**: Test individual functions and components in isolation
- **Integration tests**: Test interactions between multiple components/services
- **E2e tests**: Test complete user flows through the application

### Mocking: vi.mock


*Test file structure*

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFunction', () => {
  it('should return expected result', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

## Error Handling

### Error Handling Style: Try-Catch Blocks

This project uses **custom error classes** for specific error types.


*Standard error handling pattern*

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('User-friendly message')
}
```

## Common Workflows

These workflows were detected from analyzing commit patterns.

### Feature Development

Standard feature implementation workflow

**Frequency**: ~11 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Files typically involved**:
- `src/schemas/*`
- `src/tools/*`
- `src/tools/shared/*`
- `**/*.test.*`

**Example commit sequence**:
```
fix: simplify chatbot launcher and convert panel to full-height drawer (#187)
fix: align chatbot send button with launcher FAB and update eyebrow text (#188)
docs: add frontend cleanup design document
```

### Refactoring

Code refactoring and cleanup workflow

**Frequency**: ~5 times per month

**Steps**:
1. Ensure tests pass before refactor
2. Refactor code structure
3. Verify tests still pass

**Files typically involved**:
- `src/**/*`

**Example commit sequence**:
```
fix: address documentation site design review issues and improvements (#190)
feat: improve MCP tool usability — defaults, validation, and documentation (#192)
docs: move maintainer docs into reference (#193)
```

### Docs Site Content Structure Update

Restructures documentation site content, navigation, and hub pages to reflect new information architecture or major content changes.

**Frequency**: ~2 times per month

**Steps**:
1. Edit docs/_data/navigation.yml to update navigation structure.
2. Add or update hub pages in docs/ (e.g., setup.md, prompting.md).
3. Update front matter in multiple docs/*.md files to reflect new sections.
4. Add redirect layouts or update old URLs as needed.
5. Update docs/index.md and related landing pages.

**Files typically involved**:
- `docs/_data/navigation.yml`
- `docs/*.md`
- `docs/_layouts/redirect.html`
- `docs/index.md`

**Example commit sequence**:
```
Edit docs/_data/navigation.yml to update navigation structure.
Add or update hub pages in docs/ (e.g., setup.md, prompting.md).
Update front matter in multiple docs/*.md files to reflect new sections.
Add redirect layouts or update old URLs as needed.
Update docs/index.md and related landing pages.
```

### Docs Site Css Style Polish

Makes iterative improvements to the documentation site's CSS for spacing, alignment, accessibility, and visual consistency.

**Frequency**: ~6 times per month

**Steps**:
1. Edit docs/assets/css/docs.css to adjust spacing, margins, padding, font weights, or colors.
2. Optionally update related HTML includes or layouts for new class usage.
3. Test visual changes in browser and dark/light modes.

**Files typically involved**:
- `docs/assets/css/docs.css`
- `docs/_includes/*.html`
- `docs/_layouts/*.html`

**Example commit sequence**:
```
Edit docs/assets/css/docs.css to adjust spacing, margins, padding, font weights, or colors.
Optionally update related HTML includes or layouts for new class usage.
Test visual changes in browser and dark/light modes.
```

### Docs Site Feature Implementation Plan

Adds or updates design docs and implementation plans for upcoming documentation site features or redesigns.

**Frequency**: ~3 times per month

**Steps**:
1. Create or update a markdown file in docs/plans/ describing the design or implementation steps.
2. Commit with a message referencing the feature or redesign.

**Files typically involved**:
- `docs/plans/*.md`

**Example commit sequence**:
```
Create or update a markdown file in docs/plans/ describing the design or implementation steps.
Commit with a message referencing the feature or redesign.
```

### Tool Schema And Validation Enhancement

Improves or extends the schemas, validation, and documentation for API tools, often in response to new requirements or usability improvements.

**Frequency**: ~2 times per month

**Steps**:
1. Edit src/schemas/*.ts and/or src/tools/*.ts to update types, validation, or defaults.
2. Edit or add tests in tests/*.test.ts to cover new validation or defaults.
3. Update inline documentation/comments and tool descriptions.

**Files typically involved**:
- `src/schemas/*.ts`
- `src/tools/*.ts`
- `tests/*.test.ts`

**Example commit sequence**:
```
Edit src/schemas/*.ts and/or src/tools/*.ts to update types, validation, or defaults.
Edit or add tests in tests/*.test.ts to cover new validation or defaults.
Update inline documentation/comments and tool descriptions.
```

### Docs Site Js Feature Or Bugfix

Implements new features or bugfixes in the documentation site's JavaScript assets, often for UI polish, accessibility, or robustness.

**Frequency**: ~4 times per month

**Steps**:
1. Edit docs/assets/js/docs.js and/or docs/assets/js/chatbot.js to add or fix features.
2. Optionally update related CSS or HTML includes.
3. Test changes in browser and automated tests.

**Files typically involved**:
- `docs/assets/js/docs.js`
- `docs/assets/js/chatbot.js`
- `docs/assets/css/docs.css`

**Example commit sequence**:
```
Edit docs/assets/js/docs.js and/or docs/assets/js/chatbot.js to add or fix features.
Optionally update related CSS or HTML includes.
Test changes in browser and automated tests.
```


## Best Practices

Based on analysis of the codebase, follow these practices:

### Do

- Write tests using vitest
- Follow *.test.ts naming pattern
- Use camelCase for file names
- Prefer named exports

### Don't

- Don't skip tests for new features
- Don't deviate from established patterns without discussion

---

*This skill was auto-generated by [ECC Tools](https://ecc.tools). Review and customize as needed for your team.*
