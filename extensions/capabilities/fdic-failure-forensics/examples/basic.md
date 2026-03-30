# Basic Failure Forensics Example

## Prompt
"Analyze the failure of Silicon Valley Bank"

## Expected Behavior

1. **Resolution:** Searches for "Silicon Valley Bank", resolves to CERT 24735.
2. **Failure confirmation:** Retrieves failure record (FAILDATE: 2023-03-10, RESTYPE: PURCHASE AND ASSUMPTION).
3. **Date derivation:** last_repdte = 20221231, lookback_start = 20201231 (8 quarters).
4. **Financial timeline:** Fetches quarterly data from Q4 2020 through Q4 2022.
5. **Risk signals:** Detects signals at Q4 2022 (securities concentration, rate risk proxy).
6. **Report:** Produces 8-section forensic report with [Observed]/[Inferred]/[Unknown] labeling.

## Key Validation Points
- Report must include the temporal gap caveat (Q4 2022 report vs. March 2023 failure).
- Securities concentration should appear as an observed metric.
- Deposit run velocity should be tagged [Unknown from public data].
- No supervisory impersonation language.
