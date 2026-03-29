# Live Reliability Checks Runbook

This document covers the two scheduled reliability workflows that monitor the health of the FDIC MCP server's dependency on the upstream FDIC BankFind API. Both run automatically in GitHub Actions and require no secrets.

## Overview

| Check | Schedule | Workflow file | What it monitors |
|-------|----------|--------------|-----------------|
| Schema drift | Weekly, Monday 06:17 UTC | `.github/workflows/fdic-schema-drift.yml` | Whether FDIC has changed the API documentation or field catalog |
| Live smoke | Nightly, 07:43 UTC | `.github/workflows/fdic-live-smoke.yml` | Whether tool calls against the real FDIC API still work end-to-end |

Both can also be triggered manually via **Actions → workflow → Run workflow** in the GitHub UI.

---

## Schema Drift Detection

### What it checks

The workflow regenerates `src/fdicEndpointMetadata.ts` from the live FDIC API documentation at `https://api.fdic.gov/banks/docs`, then diffs the result against the committed version. A mismatch means the upstream field catalog has changed.

### How it works

1. Snapshots the committed `src/fdicEndpointMetadata.ts`.
2. Runs `npm run fdic-schema:sync` to regenerate from upstream.
3. Compares committed vs regenerated with `diff -u`.
4. If drift exists: computes diff stats, uploads the diff as an artifact, opens or comments on a GitHub issue with the `fdic-schema-drift` label, and fails the workflow.

### Common failure modes

| Pattern in the diff | Likely cause | Severity |
|---------------------|-------------|----------|
| New fields added, existing fields unchanged | FDIC expanded the endpoint | **Low** — commit the update |
| Field descriptions or titles changed | FDIC updated documentation text | **Low** — commit the update |
| Field renamed or removed | FDIC restructured the endpoint | **Medium** — check tool field references |
| Wholesale changes across many endpoints | FDIC major documentation revision | **High** — coordinate a migration |
| Script fails to fetch (HTTP error) | FDIC docs endpoint temporarily down | **Transient** — re-run manually later |

### Reproduce locally

```bash
# Save the current state
cp src/fdicEndpointMetadata.ts /tmp/fdicEndpointMetadata.before.ts

# Regenerate from upstream
npm run fdic-schema:sync

# Compare
diff -u /tmp/fdicEndpointMetadata.before.ts src/fdicEndpointMetadata.ts
```

### Remediation

1. **Low severity (new fields or text changes):** Run `npm run fdic-schema:sync`, commit the result, run `npm test` to confirm nothing breaks.
2. **Medium severity (renamed/removed fields):** Search the codebase for uses of the affected field names (`grep -r FIELD_NAME src/ tests/`). Update tool logic, schemas, and tests before committing the new metadata.
3. **High severity (wholesale reshape):** Open a tracking issue, assess the scope across all tools, and plan a coordinated migration.

After resolution, close the `fdic-schema-drift` issue.

---

## Live Smoke Tests

### What they check

Two test files exercise the real FDIC BankFind API:

- **`tests/live/fdic-upstream-live.test.ts`** — Calls FDIC endpoints directly via `queryEndpoint()` (no MCP overhead). Validates that the upstream API is reachable, the response envelope has the expected shape, and key fields are present.
- **`tests/live/mcp-live-smoke.test.ts`** — Initializes a full MCP HTTP session and calls tools end-to-end. Validates the complete path from argument parsing through FDIC API call to MCP response shaping.

Tests use stable inputs: Bank of America (CERT 3511) and Q4 2023 (`20231231`). Assertions check structure and key-field presence, not exact counts or rankings.

### How it works

1. Builds the server (`npm run build`).
2. Runs `npm run test:live` (uses `vitest.live.config.ts`, 30-second timeout per test).
3. On failure: generates a GitHub Actions job summary with failed test details, a triage table, and a reproduce-locally command. Uploads full test output as an artifact.

### Common failure modes

| Failure pattern | Likely layer | Next step |
|----------------|-------------|-----------|
| All upstream tests fail, MCP tests also fail | FDIC API outage or rate limit | Re-run after 1 hour; check `https://api.fdic.gov` directly |
| Upstream tests pass, MCP tests fail | Server integration bug | Reproduce locally with `npm run build && npm run test:live` |
| One endpoint fails, others pass | Endpoint-specific FDIC issue | Check if the specific endpoint responds at `api.fdic.gov` |
| `structuredContent` shape mismatch | Contract drift | Compare expected fields in test with actual tool output |
| Timeout or `ECONNREFUSED` | Network or infra issue | Transient — re-run the workflow manually |
| Consistent nightly failure for 2+ days | Likely a real upstream change | Investigate whether schema drift is also firing |

### Reproduce locally

```bash
npm run build && npm run test:live
```

To run a single test file:

```bash
npx vitest run --config vitest.live.config.ts tests/live/fdic-upstream-live.test.ts
npx vitest run --config vitest.live.config.ts tests/live/mcp-live-smoke.test.ts
```

### Upstream vs regression decision

- **If schema drift also fired** around the same time: the upstream API changed. Fix the schema drift first, then re-run live smoke tests.
- **If schema drift is green but smoke tests fail**: either a transient FDIC issue (re-run) or a server regression (check recent commits).
- **If a new commit introduced the failure**: bisect using `git log --oneline` and `npm run test:live` to identify the breaking change.

### When to take action

- **Single nightly failure:** Check the job summary. If it looks like a timeout or rate limit, no action needed — wait for the next run.
- **Two or more consecutive failures:** Investigate. Either the upstream API changed or a server regression landed.
- **All tests fail simultaneously:** Likely an FDIC outage. Verify at `https://api.fdic.gov/api/financials?filters=CERT:3511&limit=1` before investigating the server.

---

## Related files

| File | Purpose |
|------|---------|
| `.github/workflows/fdic-schema-drift.yml` | Schema drift workflow |
| `.github/workflows/fdic-live-smoke.yml` | Live smoke workflow |
| `scripts/sync-fdic-endpoint-metadata.mjs` | Metadata regeneration script |
| `src/fdicEndpointMetadata.ts` | Generated FDIC field metadata (committed) |
| `tests/live/fdic-upstream-live.test.ts` | Direct FDIC upstream connectivity tests |
| `tests/live/mcp-live-smoke.test.ts` | Full MCP tool-path smoke tests |
| `vitest.live.config.ts` | Vitest config for live test suite |
