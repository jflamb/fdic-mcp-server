# Tool Schema Listing Fix Plan

Issue: #80

## Problem

`fdic_compare_bank_snapshots` and `fdic_peer_group_analysis` validate correctly at runtime, but their advertised MCP `tools/list` schemas are empty. Clients such as Claude Desktop therefore show no parameters for these tools.

## Root Cause

Both tools define their input schemas as `z.object(...).superRefine(...)`. In the MCP SDK version used here, tool listing normalizes only plain object schemas before converting them to JSON Schema. The `superRefine()` wrapper produces a `ZodEffects`, so the SDK falls back to an empty object schema during `tools/list`.

## Constraints

- Keep the MCP-advertised schema as a plain object schema so clients can render parameters.
- Preserve the existing cross-field validation behavior at runtime.
- Keep the fix local to the affected tools and tests.

## Plan

1. Split each affected tool's schema into:
   - a plain object schema for `registerTool(... inputSchema: ...)`
   - an explicit runtime validator for cross-field constraints previously enforced by `superRefine()`
2. Run the runtime validator at the start of each tool handler and return the existing tool-error shape on invalid combinations.
3. Extend HTTP MCP tests to verify:
   - `tools/list` includes key properties for both tools
   - invalid cross-field arguments still produce an error result
4. Validate with targeted tests, typecheck, and build.
