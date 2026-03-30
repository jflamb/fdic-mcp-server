# Basic Failure Forensics Example

## Prompt
"Analyze the failure of Silicon Valley Bank"

## Expected Behavior

1. **Resolution:** Searches for "Silicon Valley Bank", resolves to CERT 24735.
2. **Failure confirmation:** Retrieves failure record (FAILDATE: 2023-03-10).
3. **Date derivation:** last_repdte = 20221231, lookback_start = 20201231.
4. **Financial timeline:** Fetches quarterly data Q4 2020–Q4 2022.
5. **Risk signals:** Detects signals at Q4 2022.
6. **Report:** 8-section forensic report with [Observed]/[Inferred]/[Unknown] labeling.

## Composition in Action
The `fdic-skill-builder` persona enforces three-outcome-state discipline and prevents tool behavior assumptions. The `fdic-core-mcp` and `fdic-analysis-mcp` tool bundles supply all required data access.
