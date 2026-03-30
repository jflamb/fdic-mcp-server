# Edge Cases for Failure Forensics

## Non-Failed Institution
**Prompt:** "Analyze the failure of JPMorgan Chase"
**Expected:** Hard-stop after Step 2 — no failure record exists. Suggest using a deep-dive workflow instead.

## Very Old Failure
**Prompt:** "Analyze the failure of Washington Mutual"
**Expected:** Resolves to CERT 32633. Failure date 2008-09-25. Lookback window may have sparse data. Report should note any data gaps.

## Ambiguous Name
**Prompt:** "Analyze the failure of First National Bank"
**Expected:** Multiple candidates returned. Disambiguation list presented. Waits for user confirmation before proceeding.

## No Risk Signals Detected
**Prompt:** (Any failure where the proxy model doesn't detect warning signals at the last reported quarter)
**Expected:** Report explicitly states this as a forensic finding — the failure was driven by factors not visible in quarterly Call Report data.
