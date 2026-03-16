# Contributing

Thanks for contributing to `fdic-mcp-server`.

## Before You Start

- Read [README.md](./README.md) for the project overview.
- Read [AGENTS.md](./AGENTS.md) for repo-specific execution rules.
- Review the published docs entry point at [docs/index.md](./docs/index.md).

## Development Setup

Prerequisites:

- Node.js 18 or later
- npm

Recommended local versions:

- Node.js 20 or 22 for parity with CI

Install and validate:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run directly from TypeScript during development:

```bash
npm run dev
```

Run locally over stdio:

```bash
node dist/index.js
```

Run locally over HTTP:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

Container note:

- Local HTTP examples default to port `3000`.
- The production Docker and Cloud Run runtime default to port `8080`.

## Node Version Policy

- CI validates the project on Node.js 20 and 22.
- Release publishing workflows run on Node.js 22.
- The production Docker image also uses Node.js 22.

## Workflow

1. Create a focused branch from `main`.
2. Keep changes small and explicit.
3. Add or update tests when behavior, output shape, ranking, or error handling changes.
4. Use conventional commit messages for commits that will land on `main`, such as `fix: ...`, `feat: ...`, or `feat!: ...`.
5. Run the full validation commands before opening a pull request.
6. Document any user-facing behavior changes in the docs.

## Release Policy

- Releases are created automatically by `semantic-release` after the `CI` workflow succeeds for the latest commit on `main`.
- Do not manually bump `package.json` versions or create release tags by hand.
- Version bumps are derived from conventional commits:
  - `fix:` creates a patch release
  - `feat:` creates a minor release
  - `BREAKING CHANGE:` or `!` creates a major release
- Release automation publishes npm, GitHub Releases, GitHub Packages, and MCP Registry metadata from the same computed version.

## Pull Requests

Include:

- What changed
- Why it changed
- How it was validated
- Which conventional-commit level the merged commits imply if the release impact is not obvious
- Any follow-up risks or open questions

## Documentation Changes

If you change prompts, tool contracts, client setup guidance, or technical behavior, update the relevant pages under [docs/](./docs/index.md).

## Support

- Open a bug report or feature request in the GitHub issue tracker: <https://github.com/jflamb/fdic-mcp-server/issues>
- For documentation issues, include the page path and the specific gap or inaccuracy
