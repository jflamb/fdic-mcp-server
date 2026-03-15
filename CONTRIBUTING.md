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

Install and validate:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run locally over stdio:

```bash
node dist/index.js
```

Run locally over HTTP:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

## Workflow

1. Create a focused branch from `main`.
2. Keep changes small and explicit.
3. Add or update tests when behavior, output shape, ranking, or error handling changes.
4. Run the full validation commands before opening a pull request.
5. Document any user-facing behavior changes in the docs or release notes.

## Pull Requests

Include:

- What changed
- Why it changed
- How it was validated
- Any follow-up risks or open questions

## Documentation Changes

If you change prompts, tool contracts, client setup guidance, or technical behavior, update the relevant pages under [docs/](./docs/index.md).

## Support

- Open a bug report or feature request in the GitHub issue tracker: <https://github.com/jflamb/fdic-mcp-server/issues>
- For documentation issues, include the page path and the specific gap or inaccuracy
