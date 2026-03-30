# State Watchlist Example

## Prompt
"Screen all Wyoming banks and build a watchlist"

## Expected Behavior

1. **Universe:** Searches for `STALP:WY AND ACTIVE:1`, returns all active Wyoming institutions.
2. **Screening:** Runs risk signals, peer health, and snapshot comparison in parallel.
3. **Triage:** Classifies institutions into Escalate/Monitor/No Immediate Concern.
4. **Follow-through:** Top 3 escalated institutions get detailed analysis.
5. **Report:** 5-section surveillance report with ranked watchlist.

## Key Validation Points
- Universe count matches active WY institutions.
- Every Escalate/Monitor institution has explicit driver text.
- Date basis stated in the report header.
- Proxy disclaimer present in caveats.
