# Example: Building a New FDIC Extension

## Prompt
"Build an FDIC extension for market share analysis in a specific MSA"

## Expected Behavior

1. **Contract verification:** Probes `fdic_market_share_analysis` and `fdic_search_sod` with CERT 57.
2. **Data rules:** Identifies SOD as annual (YEAR format), financials as quarterly (REPDTE).
3. **Dependency tiers:** `fdic_market_share_analysis` = Hard, `fdic_search_sod` = Context.
4. **Extension kind:** This is a `workflow` — it has ordered steps and produces a structured report.
5. **Manifest:** Creates `extensions/workflows/fdic-market-share/workflow.json`.
6. **Validation:** Runs typecheck, tests, and smoke test.
7. **Documentation:** Updates relevant docs.

## Key Rules Demonstrated
- No extension content before Phase 1 completes.
- SOD and financial date bases labeled separately in output.
- Three outcome states handled distinctly.
