# Lessons

- For non-trivial repo work, avoid standalone plan markdown files; prefer grouping related issues in the implementation PR description so the reasoning lands in repo history, and use an umbrella issue only when PR-based grouping is not the better fit.

- When a user gives UX feedback on published docs, treat it as a concrete correction and capture the underlying rule here before closing the follow-up work.
- For docs landing pages, prioritize high-signal project status and starting points above lower-value summary blocks or decorative notes.
- For docs intended for copy-paste workflows, code blocks should offer an obvious copy affordance instead of assuming users will select text manually.
- When adding copy controls to code blocks, reserve space within the block for the control instead of adding an extra row that pushes content downward.
- On docs landing pages, prefer fewer, wider cards when those cards contain body copy; dense four-column layouts make the text harder to scan.
- When documenting onboarding, lead with the least-friction path that is genuinely available and position local terminal-based setup as the fallback.
- In end-user docs, do not imply that users must speak in API-native field formats like `YYYYMMDD` unless that is truly required; distinguish user-facing prompt style from tool-level parameter formats.
- When documenting MCP onboarding, distinguish clearly between hosted-URL connection flows and agentic local-install flows; do not imply that plain chat products can install a local npm package just because coding agents can.
- For non-trivial repo work, avoid standalone plan markdown files; prefer grouping related issues in the implementation PR description so the reasoning lands in repo history, and use an umbrella issue only when PR-based grouping is not the better fit.
- When a user asks to follow the repo workflow, complete the full change-management path rather than stopping at local edits: open or reference the issue, use a dedicated branch, commit the change, open the PR, watch checks, fix failures, and merge when green.
- When the repository has standing SOPs, document them explicitly in `AGENTS.md` instead of relying on adjacent bullets or implied behavior.
