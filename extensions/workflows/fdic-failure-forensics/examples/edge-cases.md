# Edge Cases for Failure Forensics

## Non-Failed Institution
**Prompt:** "Analyze the failure of JPMorgan Chase"
**Expected:** Hard-stop after Step 2 — no failure record. Suggest deep-dive workflow.

## Ambiguous Name
**Prompt:** "Analyze the failure of First National Bank"
**Expected:** Disambiguation list presented, waits for confirmation before proceeding.

## No Risk Signals Detected
**Expected:** Report explicitly states this as a forensic finding — not a gap to apologize for.
