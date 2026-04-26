<!-- ⚠️ GENERATED FILE — DO NOT EDIT MANUALLY
     Source: extensions/tools/fdic-core-mcp/
     Generator: scripts/extensions/build-adapters.mjs
     Edit the canonical extension definition and re-run: npm run extensions:build -->

# FDIC Core MCP Tools

> **Kind:** Tool (OpenAI Connector)

Core FDIC BankFind data retrieval tool bundle. Provides institution lookup, financial data, failure records, locations, history, branch deposits, demographics, and financial summaries. Required by all FDIC analysis workflows.

## Tools Exposed

- `fdic_search_institutions`
- `fdic_get_institution`
- `fdic_search_failures`
- `fdic_get_institution_failure`
- `fdic_search_financials`
- `fdic_search_summary`
- `fdic_search_locations`
- `fdic_search_history`
- `fdic_search_sod`
- `fdic_search_demographics`

## Function Definitions

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_institutions",
    "description": "Use this when the user needs FDIC-insured institution search results by name, state, CERT, asset size, charter class, or regulatory status. Returns institution profile rows with pagination; use fdic://schemas/institutions for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_get_institution",
    "description": "Use this when the user knows an exact FDIC Certificate Number and needs one institution profile. To discover a CERT first, call fdic_search_institutions or fdic_search.",
    "parameters": {
      "type": "object",
      "properties": {
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "FDIC Certificate Number — the unique identifier for an institution"
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of fields to return"
        }
      },
      "required": [
        "cert"
      ],
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_failures",
    "description": "Use this when the user wants details on failed FDIC-insured institutions filtered by name, state, date range, resolution type, or cost. Returns failure records with pagination; see fdic://schemas/failures for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_get_institution_failure",
    "description": "Use this when the user knows the CERT of a failed institution and needs its specific failure record. Returns failure details (date, resolution type, cost, acquirer); responds with `found: false` if the institution did not fail.",
    "parameters": {
      "type": "object",
      "properties": {
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "FDIC Certificate Number — the unique identifier for an institution"
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of fields to return"
        }
      },
      "required": [
        "cert"
      ],
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_financials",
    "description": "Use this when the user wants quarterly Call Report data (balance sheet, income, capital, performance ratios) for FDIC-insured institutions. Filter by CERT and/or REPDTE plus optional ElasticSearch filters. See fdic://schemas/financials for the full 1,100+ field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "DESC",
          "description": "Sort direction: DESC (descending, default for most recent first) or ASC (ascending)"
        },
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Filter by FDIC Certificate Number to get financials for a specific institution"
        },
        "repdte": {
          "type": "string",
          "description": "Filter by Report Date (REPDTE) in YYYYMMDD format (quarter-end: 0331, 0630, 0930, 1231). If omitted, returns all available dates (sorted most recent first)."
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_summary",
    "description": "Use this when the user wants annual financial-summary snapshots (assets, deposits, ROA, ROE, offices) for FDIC-insured institutions, filtered by CERT and/or year. See fdic://schemas/summary for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        },
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Filter by FDIC Certificate Number"
        },
        "year": {
          "type": "integer",
          "minimum": 1934,
          "description": "Filter by specific year (e.g., 2022)"
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_locations",
    "description": "Use this when the user wants branch/office locations for FDIC-insured institutions, filtered by CERT, state, city, county, metro area, or branch type. Returns address, coordinates, branch number, and service-type rows; see fdic://schemas/locations for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        },
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Filter by FDIC Certificate Number to get all branches of a specific institution"
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_history",
    "description": "Use this when the user wants structural-change events (mergers, acquisitions, name changes, charter conversions, failures) for FDIC-insured institutions, filtered by CERT, type, change code, date range, or state. See fdic://schemas/history for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        },
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Filter by FDIC Certificate Number to get history for a specific institution"
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_sod",
    "description": "Use this when the user wants annual branch-level deposit data (SOD, as of June 30 each year) — branch deposits, MSAs, geographic distribution. Filter by CERT and/or year. See fdic://schemas/sod for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        },
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Filter by FDIC Certificate Number"
        },
        "year": {
          "type": "integer",
          "minimum": 1994,
          "description": "Filter by specific year (1994-present). SOD data is annual."
        }
      },
      "additionalProperties": false
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "fdic_search_demographics",
    "description": "Use this when the user wants quarterly demographic and market-structure attributes (office counts, metro classification, county/territory codes, geographic reference data) for FDIC-insured institutions. Filter by CERT and/or REPDTE. See fdic://schemas/demographics for the full field catalog.",
    "parameters": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "string",
          "description": "FDIC API filter using ElasticSearch query string syntax. Combine conditions with AND/OR, use quotes for multi-word values, and [min TO max] for ranges (* = unbounded). Common fields: NAME (institution name), STNAME (state name), STALP (two-letter state code), CERT (certificate number), ASSET (total assets in $thousands), ACTIVE (1=active, 0=inactive). Examples: STNAME:\"California\", ACTIVE:1 AND ASSET:[1000000 TO *], NAME:\"Chase\""
        },
        "fields": {
          "type": "string",
          "description": "Comma-separated list of FDIC field names to return. Leave empty to return all fields. Field names are ALL_CAPS (e.g., NAME, CERT, ASSET, DEP, STALP). Example: NAME,CERT,ASSET,DEP,STALP"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000,
          "default": 20,
          "description": "Maximum number of records to return (1-10000, default: 20)"
        },
        "offset": {
          "type": "integer",
          "minimum": 0,
          "default": 0,
          "description": "Number of records to skip for pagination (default: 0)"
        },
        "sort_by": {
          "type": "string",
          "description": "Field name to sort results by. Example: ASSET, NAME, FAILDATE"
        },
        "sort_order": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "default": "ASC",
          "description": "Sort direction: ASC (ascending) or DESC (descending)"
        },
        "cert": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Filter by FDIC Certificate Number"
        },
        "repdte": {
          "type": "string",
          "description": "Filter by Report Date (REPDTE) in YYYYMMDD format (quarter-end: 0331, 0630, 0930, 1231)."
        }
      },
      "additionalProperties": false
    }
  }
}
```
