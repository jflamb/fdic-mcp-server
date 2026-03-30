# FDIC CERT Identity Rules

The `CERT` field is the stable institution identifier across all FDIC datasets.

## Resolution Rules

1. **Ambiguous name resolution is unresolved until CERT is confirmed.** If a search returns multiple candidates, the institution is not yet identified. Do not pass names downstream — wait until the user has confirmed a specific CERT.

2. **CERT-first lookups:** When a CERT is provided directly, use `fdic_search_institutions` with `filters: "CERT:<cert>"` to confirm identity.

3. **Name-based lookups:** Search with `filters: "NAME:\"<name>\""`. If multiple candidates, present a disambiguation list and wait for user confirmation.

4. **Inactive institution handling:** Always check the `ACTIVE` field. If `ACTIVE: 0`:
   - Warn the user explicitly before proceeding.
   - Derive the historical `repdte` from the institution's `REPDTE` field.
   - SOD data may be absent for the last year — degrade gracefully.
   - Do not treat absence of recent financial data as an error.

5. **Zero results:** Stop and ask the user to refine their search or provide a CERT number.
