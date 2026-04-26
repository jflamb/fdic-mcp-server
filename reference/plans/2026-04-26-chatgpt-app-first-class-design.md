# First-Class ChatGPT App Design Proposal

**Date:** 2026-04-26
**Status:** Proposed
**Branch:** TBD (implementation branch)

## Summary

Evolve `fdic-mcp-server` from a strong tool-only MCP server into a first-class ChatGPT app by adding a citation-friendly `search`/`fetch` discovery layer, one focused ChatGPT UI resource, clearer app-oriented tool metadata, and a documented ChatGPT development/test loop.

The existing server already has the right foundation: streamable HTTP at `/mcp`, read-only/idempotent FDIC tools, structured MCP results, schema resources, Cloud Run hosting, and ChatGPT Developer Mode setup docs. This proposal keeps those contracts intact and layers app behavior on top instead of replacing the current tool suite.

## App Classification

**Current archetype:** `tool-only`

The server exposes FDIC data and analysis tools but does not yet expose a ChatGPT app UI.

**Target archetype:** `interactive-decoupled`

Data tools remain reusable and model-visible. A small number of render-oriented app tools attach UI resources and return dashboard-ready `structuredContent`. The widget renders from tool results and can call follow-up tools through the MCP Apps bridge without making the core FDIC tools UI-dependent.

## Goals

- Make the server eligible for ChatGPT company knowledge and deep research style retrieval by adding exact-shape `search` and `fetch` tools.
- Add one high-value ChatGPT widget that demonstrates why this is an app, not just a connector.
- Preserve all existing FDIC tool names, input schemas, `content`, and `structuredContent` shapes unless a later issue explicitly coordinates a breaking change.
- Improve model tool selection by tightening descriptors and adding invocation status metadata for long-running analysis.
- Document and test the ChatGPT-specific local loop: MCP Inspector, HTTPS tunnel, Developer Mode app refresh, and production submission readiness.

## Non-Goals

- Replace the existing FDIC-specific tools with generic `search`/`fetch`.
- Add authentication. The FDIC BankFind API is public and this server should continue to work without credentials.
- Add mutating tools. All app capabilities in this proposal are read-only.
- Build a full financial analysis product UI in the first pass. The first widget should be useful, focused, and reviewable.
- Change Cloud Run topology except where app metadata or static widget assets require small additions.

## Source Guidance

This design is based on current Apps SDK guidance:

- [Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
- [Build your ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui)
- [Define tools](https://developers.openai.com/apps-sdk/plan/tools)
- [Apps SDK reference](https://developers.openai.com/apps-sdk/reference)
- [Submit and maintain your app](https://developers.openai.com/apps-sdk/deploy/submission)
- [App submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)

Key design constraints from those docs:

- ChatGPT apps are composed of an MCP server, a widget/UI bundle, and model narration over `content` and `structuredContent`.
- New UI integrations should use the MCP Apps bridge by default; `window.openai` is optional and additive.
- Widget resources should use the MCP Apps UI MIME type and explicit `_meta.ui` metadata for resource URI, CSP, domain, and border hints.
- Company knowledge and deep research compatibility prefer exact `search` and `fetch` input signatures and citation-friendly result URLs.
- Tool descriptions should be concise, intent-oriented, and easy for the model to choose.

## Finding 1: Standard `search` And `fetch`

### Problem

The server has 23 FDIC-specific tools but no canonical `search` or `fetch`. That makes the app weaker for ChatGPT surfaces that expect retrieval-style MCP tools and canonical citation URLs.

### Proposed Design

Add a new module:

```text
src/tools/chatgptRetrieval.ts
```

Register two read-only tools:

```text
search
fetch
```

These names are intentionally generic because the compatibility check expects them.

### `search` Input

Exact shape:

```json
{
  "query": "string"
}
```

Use a single required query string. Do not expose FDIC filter syntax here; this layer should translate natural search text into a small set of citation results.

### `search` Output

Return exactly one MCP text content item whose text is a JSON-encoded object:

```json
{
  "results": [
    {
      "id": "institution:3511",
      "title": "Bank of America, National Association",
      "url": "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511"
    }
  ]
}
```

Also include matching `structuredContent` only if tests confirm it does not interfere with compatibility. The compatibility-safe baseline is the single JSON text content item.

### `fetch` Input

Exact shape:

```json
{
  "id": "string"
}
```

Accepted ID formats:

- `institution:<CERT>`
- `failure:<CERT>`
- `schema:<endpoint>`
- `branch:<stable-id>` for branch/location records

Branch IDs should use a native FDIC location identifier when one is available in the locations payload. If no single stable identifier is available, use a deterministic composite ID based on certificate number plus stable location fields, and keep the original lookup fields in `metadata` so `fetch` can reconstruct the record without ambiguity.

### `fetch` Output

Return exactly one MCP text content item whose text is a JSON-encoded object:

```json
{
  "id": "institution:3511",
  "title": "Bank of America, National Association",
  "text": "FDIC institution profile...",
  "url": "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511",
  "metadata": {
    "type": "institution",
    "cert": 3511,
    "source": "FDIC BankFind Suite"
  }
}
```

### Search Strategy

Start with deterministic FDIC queries:

1. If the query contains a CERT-like number, search institutions by `CERT:<number>`.
2. Search active and inactive institutions by `NAME:"..."` with conservative escaping.
3. Search failures by bank name if the query contains failure terms or no institution result is found.
4. Search branch/location records when the query mentions branches, offices, addresses, cities, counties, ZIP codes, or market presence.
5. Search schema docs when the query mentions fields, columns, endpoint names, Call Reports, SOD, or demographics.
6. Return at most 8 results in the first implementation so institution, failure, branch, and schema matches can coexist without drowning the model.

Do not call the FDIC API with unbounded or expensive broad queries. Favor precise name/CERT/schema lookup over generic keyword search.

### URL Policy

Preferred canonical URLs:

- Institution details: `https://banks.data.fdic.gov/bankfind-suite/bankfind/details/<CERT>`
- Failed bank details: `https://www.fdic.gov/bank-failures/failed-bank-list`
- Branch/location details: prefer an FDIC BankFind branch/location HTTPS URL if implementation verification identifies a stable deep link. Otherwise cite a project docs URL and include precise branch identity, address, and FDIC source metadata in the fetched text.
- Schema docs: project docs URL for tool/schema reference, or `fdic://schemas/<endpoint>` only if ChatGPT handles it acceptably for citations. Prefer HTTPS where possible.

### Tests

Add coverage in `tests/mcp-http.test.ts` or a focused retrieval test:

- `search` and `fetch` appear in `tools/list`.
- Both tools have `readOnlyHint: true`, `destructiveHint: false`, and `idempotentHint: true`.
- `search` input schema has exactly the expected `query` string parameter.
- `fetch` input schema has exactly the expected `id` string parameter.
- `search` returns one text content item containing JSON with `results`.
- `fetch` returns one text content item containing JSON with `id`, `title`, `text`, and `url`.
- Institution lookup by known CERT returns a stable citation URL.
- Branch/location search returns fetchable `branch:<stable-id>` results with address metadata.
- Unknown IDs return a clear tool error without throwing an unhandled exception.

## Finding 2: ChatGPT App UI Resource

### Problem

Current resources are FDIC schema JSON resources. There is no widget resource with the MCP Apps UI MIME type and no tool linked to a ChatGPT UI template.

### Proposed First Widget

Build a **Bank Deep Dive** widget.

This is the best first UI because it turns a common user intent into a scannable, app-native experience:

> "Show me an analyst-style view of this bank."

The widget should render:

- Institution identity and report date basis.
- Assets, deposits, offices, active/inactive status, regulator, and charter class.
- Public CAMELS-style proxy summary with explicit caveat that it is not an official rating.
- Component score tiles for capital, asset quality, earnings, liquidity, and sensitivity.
- Trend rows for the latest available quarters.
- Risk signals and data quality warnings.
- Suggested follow-up buttons such as "Compare peers", "Show branch footprint", and "Analyze funding".

### Architecture

Use a decoupled data/render pattern:

```text
User prompt
  -> ChatGPT calls fdic_show_bank_deep_dive
  -> server gathers data using existing shared engines
  -> server returns content + structuredContent + _meta.ui.resourceUri
  -> ChatGPT loads ui://widget/fdic-bank-deep-dive-v1.html
  -> widget renders from structuredContent
  -> widget may call follow-up tools through tools/call
```

### New Files

```text
src/resources/chatgptAppResources.ts
src/tools/chatgptBankDeepDive.ts
src/tools/shared/chatgptUrls.ts
web/chatgpt-bank-deep-dive/src/main.ts
web/chatgpt-bank-deep-dive/src/styles.css
web/chatgpt-bank-deep-dive/index.html
```

Use vanilla TypeScript for v1. The widget primarily renders structured financial data and follow-up buttons, so React is not necessary yet. This keeps dependencies low, makes embedded resource output straightforward, and still leaves room to migrate to React later if the dashboard grows into a richer multi-tab experience.

### Resource Registration

Register:

```text
ui://widget/fdic-bank-deep-dive-v1.html
```

Resource requirements:

- MIME type: `text/html;profile=mcp-app` or SDK constant from `@modelcontextprotocol/ext-apps/server`.
- `_meta.ui.prefersBorder: true`
- `_meta.ui.domain`: production app/widget origin when ready for submission.
- `_meta.ui.csp.connectDomains`: include the production MCP/API origin only if the widget fetches directly. Prefer no direct widget fetches in v1.
- `_meta.ui.csp.resourceDomains`: static asset/CDN origins if any.
- `_meta["openai/widgetDescription"]`: short model-visible summary, for example "Renders an FDIC bank deep-dive dashboard from public BankFind data."

### Widget Asset Strategy

Embed the compiled HTML, CSS, and JavaScript in the MCP resource for v1.

Reasons:

- ChatGPT loads the widget through the MCP resource contract, so embedded assets are the shortest path to a self-contained app.
- The current production service already hosts `/mcp`; embedded assets avoid adding a static-file route and public asset cache policy before it is needed.
- CSP is simpler because the widget does not need to fetch its own scripts or styles from another origin.
- Versioning remains explicit through the resource URI, for example `ui://widget/fdic-bank-deep-dive-v1.html`.

Serving static assets from the same domain is still a good later option if the widget bundle becomes large, needs shared images/fonts, or benefits from browser/CDN caching. That change should preserve the same resource URI versioning discipline and only relax CSP for the exact static asset origin.

### Tool Registration

Register:

```text
fdic_show_bank_deep_dive
```

Input:

```json
{
  "cert": 3511,
  "repdte": "20241231",
  "quarters": 8
}
```

Annotations:

```json
{
  "readOnlyHint": true,
  "destructiveHint": false,
  "idempotentHint": true,
  "openWorldHint": true
}
```

Descriptor `_meta`:

```json
{
  "ui": {
    "resourceUri": "ui://widget/fdic-bank-deep-dive-v1.html"
  },
  "openai/outputTemplate": "ui://widget/fdic-bank-deep-dive-v1.html",
  "openai/toolInvocation/invoking": "Building bank dashboard...",
  "openai/toolInvocation/invoked": "Bank dashboard ready"
}
```

### Output Shape

`structuredContent` should be compact and model-readable:

```json
{
  "institution": {
    "cert": 3511,
    "name": "Bank of America, National Association",
    "city": "Charlotte",
    "state": "NC",
    "active": true,
    "asset_thousands": 123,
    "deposit_thousands": 123,
    "report_date": "20241231"
  },
  "assessment": {
    "proxy_band": "satisfactory",
    "proxy_score": 2.1,
    "capital_category": "well_capitalized",
    "official_rating": false
  },
  "components": [],
  "trends": [],
  "risk_signals": [],
  "warnings": [],
  "sources": [
    {
      "title": "FDIC BankFind institution profile",
      "url": "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/3511"
    }
  ]
}
```

`_meta` can include larger lookup maps and full raw payload slices useful only to the widget.

### Widget Behavior

- Listen for `ui/notifications/tool-result`.
- Render from `structuredContent`.
- Keep UI state local unless it materially changes model context.
- Use `tools/call` for follow-up actions from buttons.
- Use `ui/message` for follow-up prompts that should be visible in the conversation.
- Avoid direct FDIC API calls from the widget in v1. The MCP server should remain the data boundary.

### Tests

- Resource appears in `resources/list`.
- Resource content uses the app MIME type.
- Resource includes `_meta.ui.csp`, `_meta.ui.prefersBorder`, and widget description metadata.
- `fdic_show_bank_deep_dive` descriptor includes `_meta.ui.resourceUri`.
- Tool returns dashboard-ready `structuredContent`.
- Widget bundle builds.
- Playwright or a lightweight DOM test verifies the widget renders a sample tool result without blank output.

## Finding 3: Tool Metadata And Descriptions

### Problem

Several tool descriptions are accurate but long. Long descriptors can make model selection noisier in ChatGPT because discovery is metadata-driven.

### Proposed Design

Add a metadata cleanup pass that preserves schemas and behavior while changing descriptions only.

Descriptor pattern:

```text
Use this when <specific user intent>. Returns <primary data/analysis>.

Inputs: <short mention of important args>.
Data basis: <quarterly/annual/SOD/public proxy caveat when relevant>.
```

Move long field lists and examples to:

- existing schema resources (`fdic://schemas/...`)
- `docs/tool-reference.md`
- targeted usage docs

### Priority Tools

Start with tools most likely to compete during model selection:

- `fdic_search_institutions`
- `fdic_get_institution`
- `fdic_search_financials`
- `fdic_search_sod`
- `fdic_analyze_bank_health`
- `fdic_peer_group_analysis`
- `fdic_detect_risk_signals`
- `fdic_compare_peer_health`

### Invocation Metadata

Add short status strings to tools that may take long enough for ChatGPT to benefit:

- `fdic_analyze_bank_health`
- `fdic_peer_group_analysis`
- `fdic_compare_peer_health`
- `fdic_detect_risk_signals`
- `fdic_analyze_credit_concentration`
- `fdic_analyze_funding_profile`
- `fdic_analyze_securities_portfolio`
- `fdic_franchise_footprint`
- `fdic_market_share_analysis`
- `fdic_holding_company_profile`
- `fdic_regional_context`

Example:

```json
{
  "openai/toolInvocation/invoking": "Analyzing bank health...",
  "openai/toolInvocation/invoked": "Health analysis ready"
}
```

### Tests

- Existing contract tests should continue to pass.
- Add a metadata snapshot test for representative tools if the SDK exposes descriptors in a stable way.
- Avoid asserting full prose where minor copy changes should not fail builds.

## Finding 4: ChatGPT Run And Test Checklist

### Problem

The docs include ChatGPT setup, but do not yet describe the app-specific validation path needed for first-class behavior.

### Proposed Docs Changes

Update:

```text
docs/clients.md
docs/setup.md
docs/troubleshooting.md
reference/cloud-run-deployment.md
```

Add a ChatGPT app validation section:

1. Build the repo:

   ```bash
   npm install
   npm run build
   ```

2. Start local HTTP:

   ```bash
   TRANSPORT=http PORT=3000 node dist/index.js
   ```

3. Inspect locally with MCP Inspector:

   ```text
   http://127.0.0.1:3000/mcp
   ```

4. Expose with HTTPS tunnel:

   ```bash
   ngrok http 3000
   ```

5. Connect ChatGPT Developer Mode to:

   ```text
   https://<tunnel-host>/mcp
   ```

6. Refresh app/tools after descriptor, schema, resource, or widget URI changes.

7. Exercise test prompts:

   - "Search for Bank of America and cite the result."
   - "Fetch institution:3511."
   - "Show a deep dive for CERT 3511."
   - "Compare this bank with peers."
   - "What data date basis are you using?"

8. Verify production:

   - hosted `/health` is healthy
   - hosted `/mcp` initializes
   - ChatGPT can list tools
   - widget renders in ChatGPT
   - error states are readable

### Submission Readiness Checklist

Add a submission checklist for future public launch:

- Verified OpenAI organization or individual identity.
- Stable public HTTPS endpoint.
- Unique app/widget domain.
- Privacy policy URL.
- Support URL/email.
- App name, description, icon, and screenshots.
- Test prompts and expected outcomes.
- Clear disclosure that health scoring is a public analytical proxy, not an official CAMELS rating.
- No misleading implication of FDIC or OpenAI endorsement.
- Logs and alerting for production errors and latency.

## Implementation Plan

### Phase 1: Retrieval Compatibility

- Add `src/tools/chatgptRetrieval.ts`.
- Add URL helper functions.
- Register `search` and `fetch` from `createServer()`.
- Keep `search` and `fetch` always on as part of the core read-only toolset.
- Include institution, failure, branch/location, and schema results in v1.
- Add tests for descriptors and exact output wrappers.
- Validate with `npm run typecheck`, `npm test`, and `npm run build`.

### Phase 2: First App Widget

- Add `@modelcontextprotocol/ext-apps` if the current SDK path does not expose equivalent helpers.
- Add widget resource registration.
- Add `fdic_show_bank_deep_dive`.
- Add a small embedded vanilla TypeScript widget bundle.
- Add resource/tool tests and widget render sanity tests.
- Validate with MCP Inspector.

### Phase 3: Metadata Cleanup

- Shorten priority tool descriptions.
- Add invocation status metadata to long-running analysis tools.
- Keep field catalogs in schema resources and docs.
- Add lightweight metadata tests.

### Phase 4: ChatGPT Documentation And Release Readiness

- Update docs with local/tunneled ChatGPT app validation.
- Add production/submission checklist.
- Add troubleshooting entries for stale tool descriptors, cached widget URIs, CSP failures, and tunnel origin issues.
- Run full repo validation.

## Acceptance Criteria

- `tools/list` includes `search`, `fetch`, and all existing FDIC tools.
- Existing FDIC tool contracts remain backward compatible.
- `search` and `fetch` match the expected input shapes and JSON text response wrappers.
- Search/fetch results include canonical HTTPS URLs where possible.
- At least one app UI resource is registered with the MCP Apps UI MIME type.
- At least one render tool links to that UI via `_meta.ui.resourceUri`.
- Widget renders a real bank dashboard from `structuredContent`.
- ChatGPT docs include MCP Inspector, HTTPS tunnel, Developer Mode refresh, and submission readiness guidance.
- `npm run typecheck`, `npm test`, and `npm run build` pass before PR.

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `search`/`fetch` output drifts from compatibility expectations | ChatGPT retrieval surfaces may ignore the app | Keep response wrappers exact and add contract tests |
| Widget scope grows too large | Delays first useful app experience | Ship a focused bank deep-dive v1, then add peer/footprint tabs later |
| Tool metadata changes accidentally alter contracts | Regression for existing MCP clients | Limit Phase 3 to descriptor prose and metadata; preserve names/schemas/results |
| FDIC canonical URLs are unstable or not deep-linkable | Weak citations | Prefer stable FDIC or project docs HTTPS URLs; document fallback policy |
| CSP/domain config blocks widget assets in ChatGPT | Widget fails to render | Add local Inspector checks and ChatGPT tunnel checks before PR completion |
| Public health proxy can be mistaken for official ratings | Compliance/trust issue | Put caveats in tool text, widget UI, docs, and submission materials |

## Resolved Design Decisions

- `search` includes institution, failure, branch/location, and schema results in v1.
- Failed-bank citations use `https://www.fdic.gov/bank-failures/failed-bank-list`.
- The v1 widget uses vanilla TypeScript because the first dashboard is data-rendering heavy and does not need React's component/runtime overhead.
- Widget assets are embedded in the MCP resource for v1. Static same-domain serving remains a later optimization if bundle size or caching needs justify it.
- `search` and `fetch` are always on as part of the core read-only toolset.

## Remaining Open Questions

- Which FDIC locations field is the best native stable branch identifier? If none is available, which deterministic composite should become the public `branch:<stable-id>` format?
- Does ChatGPT citation handling prefer the FDIC failed-bank list URL alone for every failure record, or should fetched failure text also include an anchor-like local identifier for the failed institution?

## Recommended First Issue Breakdown

1. **feat: add ChatGPT-compatible search and fetch tools**
2. **feat: add bank deep-dive ChatGPT widget**
3. **docs: add ChatGPT app validation guide**
4. **chore: optimize tool metadata for ChatGPT discovery**

The first issue is the highest leverage and should be implemented before the widget because it improves ChatGPT compatibility without introducing UI complexity.
