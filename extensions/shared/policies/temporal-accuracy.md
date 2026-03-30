# Temporal Accuracy Policy

Extensions must produce temporally accurate output. Time-related ambiguity erodes trust.

## Rules

1. **Use exact dates.** Never write "recently" or "as of the latest period" without specifying the exact date.

2. **State date basis per section.** If output mixes quarterly financial data and annual SOD data, each section header must state its date basis.

3. **Staleness caveat.** If the effective report date is more than 120 days before the analysis date, include an explicit staleness warning.

4. **Quarter derivation.** When computing quarter-end dates from calendar dates:
   - Jan 1 – Mar 31 → `YYYYMMDD` ending `0331`
   - Apr 1 – Jun 30 → `YYYYMMDD` ending `0630`
   - Jul 1 – Sep 30 → `YYYYMMDD` ending `0930`
   - Oct 1 – Dec 31 → `YYYYMMDD` ending `1231`

5. **Cross-date-basis transparency.** Convert relative dates ("same quarter one year prior") to absolute dates in output.
