# Graceful Degradation Policy

Extensions must degrade gracefully when data or tools are unavailable.

## Three Outcome States

Distinguish these in output — they have different meanings and must never be collapsed:

| State | Meaning | Correct Representation |
|---|---|---|
| **No data** | The API returned zero records for this metric | "No data available for [metric]" |
| **Not applicable** | The metric structurally does not apply | "Not applicable — [reason]" |
| **Tool failure** | The tool returned an error or timed out | "Tool error — [tool name]" |

## Tier-Based Degradation

- **Hard dependency fails:** Stop. Report the error. Do not produce partial output.
- **Soft dependency fails:** Omit the section. Note the omission explicitly.
- **Context dependency fails:** Silently omit or note briefly. Preserve all analytical results.

## Rules

1. Never use "n/a" as a catch-all that merges all three outcome states.
2. Never render empty placeholder sections for omitted content — omit entirely.
3. When a soft dependency fails, the remaining output must still form a coherent narrative.
