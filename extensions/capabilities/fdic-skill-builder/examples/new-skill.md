# New Skill Example

## Prompt
"Build an FDIC extension for market share analysis in a specific MSA"

## Expected Behavior

1. **Contract verification:** Probes `fdic_market_share_analysis` and `fdic_search_sod` with known-good inputs.
2. **Data rules:** Identifies SOD as annual data (YEAR format), financials as quarterly (REPDTE).
3. **Dependency tiers:** `fdic_market_share_analysis` = Hard, `fdic_search_sod` = Context.
4. **Implementation:** Writes extension manifest, instructions, examples, and eval fixtures.
5. **Validation:** Runs typecheck, tests, and smoke test.
6. **Documentation:** Updates relevant docs.

## Key Validation Points
- The extension must not mix SOD and financial date bases without explicit labeling.
- Hard dependencies must have server-fix gates.
- Three outcome states must be handled distinctly.
