# State Watchlist Example

## Prompt
"Screen all Wyoming banks and build a watchlist"

## Expected Behavior
1. Universe: all active WY institutions via `fdic_search_institutions`.
2. Parallel screening: risk signals, peer health, snapshot comparison.
3. Triage: Escalate/Monitor/No Immediate Concern classification.
4. Follow-through: top 3 escalated institutions get detailed analysis.
5. Report: 5-section surveillance report.

## Composition in Action
The `fdic-skill-builder` persona enforces that every Escalate/Monitor entry has explicit driver text (not opaque scores). The `fdic-analysis-mcp` tool bundle provides all analytical tools needed for follow-through.
