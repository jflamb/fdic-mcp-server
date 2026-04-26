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
    "description": "Use this when the user knows an exact FDIC Certificate Number and needs one institution profile. To discover a CERT first, call fdic_search_institutions or the ChatGPT-compatible search tool.",
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
    "description": "Search for details on failed FDIC-insured financial institutions.\n\nReturns data on bank failures including failure date, resolution type, estimated cost to the FDIC Deposit Insurance Fund, and acquiring institution info.\n\nCommon filter examples:\n  - By state: STALP:CA (two-letter state code)\n  - By year range: FAILDATE:[2008-01-01 TO 2010-12-31]\n  - Recent failures: FAILDATE:[2020-01-01 TO *]\n  - By resolution type: RESTYPE:PAYOFF or RESTYPE:\"PURCHASE AND ASSUMPTION\"\n  - Large failures by cost: COST:[100000 TO *]  (cost in $thousands)\n  - By name: NAME:\"Washington Mutual\"\n\nResolution types (RESTYPE):\n  PAYOFF = depositors paid directly, no acquirer\n  PURCHASE AND ASSUMPTION = acquirer buys assets and assumes deposits\n  PAYOUT = variant of payoff with insured-deposit transfer\n\nKey returned fields:\n  - CERT: FDIC Certificate Number\n  - NAME: Institution name\n  - CITY, STALP (two-letter state code), STNAME (full state name): Location\n  - FAILDATE: Date of failure (YYYY-MM-DD)\n  - SAVR: Savings association flag (SA) or bank (BK)\n  - RESTYPE: Resolution type (see above)\n  - QBFASSET: Total assets at failure ($thousands)\n  - COST: Estimated cost to FDIC Deposit Insurance Fund ($thousands)\n\nArgs:\n  - filters (string, optional): ElasticSearch query filter\n  - fields (string, optional): Comma-separated field names\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by (e.g., FAILDATE, COST)\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and failure records.",
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
    "description": "Retrieve failure details for a specific institution by FDIC Certificate Number.\n\nUse this when you know the CERT of a failed institution to get its specific failure record.\n\nArgs:\n  - cert (number): FDIC Certificate Number of the failed institution\n  - fields (string, optional): Comma-separated list of fields to return\n\nReturns detailed failure information suitable for concise summaries, with structured fields available for exact values when needed.",
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
    "description": "Search quarterly financial (Call Report) data for FDIC-insured institutions. Covers over 1,100 financial variables reported quarterly.\n\nReturns balance sheet, income statement, capital, and performance ratio data from FDIC Call Reports.\n\nCommon filter examples:\n  - Financials for a specific bank: CERT:3511\n  - By report date: REPDTE:20231231\n  - High-profit banks in Q4 2023: REPDTE:20231231 AND ROA:[1.5 TO *]\n  - Large banks most recent: ASSET:[10000000 TO *]\n  - Negative net income: NETINC:[* TO 0]\n\nKey returned fields:\n  - CERT: FDIC Certificate Number\n  - REPDTE: Report Date — the last day of the quarterly reporting period (YYYYMMDD)\n  - ASSET: Total assets ($thousands)\n  - DEP: Total deposits ($thousands)\n  - DEPDOM: Domestic deposits ($thousands)\n  - INTINC: Total interest income ($thousands)\n  - EINTEXP: Total interest expense ($thousands)\n  - NETINC: Net income ($thousands)\n  - ROA: Return on assets (%)\n  - ROE: Return on equity (%)\n  - NETNIM: Net interest margin (%)\n\nArgs:\n  - cert (number, optional): Filter by institution CERT number\n  - repdte (string, optional): Report Date in YYYYMMDD format (quarter-end dates: 0331, 0630, 0930, 1231)\n  - filters (string, optional): Additional ElasticSearch query filters\n  - fields (string, optional): Comma-separated field names (the full set has 1,100+ fields)\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'DESC' recommended for most recent first)\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and quarterly financial records.",
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
          "description": "Filter by Report Date (REPDTE) in YYYYMMDD format. FDIC data is published quarterly on call report dates: March 31, June 30, September 30, and December 31. Example: 20231231 for Q4 2023. If omitted, returns all available dates (sorted most recent first by default)."
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
    "description": "Search aggregate financial and structure summary data subtotaled by year for FDIC-insured institutions.\n\nReturns annual snapshots of key financial metrics — useful for tracking an institution's growth over time.\n\nCommon filter examples:\n  - Annual history for a bank: CERT:3511\n  - Specific year: YEAR:2022\n  - Year range: YEAR:[2010 TO 2020]\n  - Large banks in 2022: YEAR:2022 AND ASSET:[10000000 TO *]\n  - Profitable in 2023: YEAR:2023 AND ROE:[10 TO *]\n\nKey returned fields:\n  - CERT: FDIC Certificate Number\n  - YEAR: Report year\n  - ASSET: Total assets ($thousands)\n  - DEP: Total deposits ($thousands)\n  - NETINC: Net income ($thousands)\n  - ROA: Return on assets (%)\n  - ROE: Return on equity (%)\n  - OFFICES: Number of branch offices\n  - REPDTE: Report Date — the last day of the reporting period (YYYYMMDD)\n\nArgs:\n  - cert (number, optional): Filter by institution CERT number\n  - year (number, optional): Filter by specific year (1934-present)\n  - filters (string, optional): Additional ElasticSearch query filters\n  - fields (string, optional): Comma-separated field names\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by (e.g., YEAR, ASSET)\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and annual summary records.",
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
    "description": "Search for branch locations of FDIC-insured financial institutions.\n\nReturns branch/office data including address, city, state, coordinates, branch type, and establishment date.\n\nCommon filter examples:\n  - All branches of a bank: CERT:3511\n  - By state: STALP:TX (two-letter state code)\n  - By city: CITY:\"Austin\"\n  - Main offices only: BRNUM:0\n  - By county: COUNTY:\"Travis\"\n  - Active branches only: ENDEFYMD:[9999-01-01 TO *]  (sentinel date 9999-12-31 means still open)\n  - By metro area (CBSA): CBSA_METRO_NAME:\"New York-Newark-Jersey City\"\n\nBranch service types (BRSERTYP):\n  11 = Full service brick and mortar\n  12 = Full service retail\n  21 = Limited service administrative\n  22 = Limited service military\n  23 = Limited service drive-through\n  24 = Limited service loan production\n  25 = Limited service consumer/trust\n  26 = Limited service Internet/mobile\n  29 = Limited service other\n\nKey returned fields:\n  - CERT: FDIC Certificate Number\n  - UNINAME: Institution name\n  - NAMEFULL: Full branch name\n  - ADDRESS, CITY, STALP (two-letter state code), ZIP: Branch address\n  - COUNTY: County name\n  - BRNUM: Branch number (0 = main office)\n  - BRSERTYP: Branch service type code (see above)\n  - LATITUDE, LONGITUDE: Geographic coordinates\n  - ESTYMD: Branch established date (YYYY-MM-DD)\n  - ENDEFYMD: Branch end date (9999-12-31 if still active)\n\nArgs:\n  - cert (number, optional): Filter by institution CERT number\n  - filters (string, optional): Additional ElasticSearch query filters\n  - fields (string, optional): Comma-separated field names\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and branch location records.",
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
    "description": "Search for structural change events for FDIC-insured financial institutions.\n\nReturns records on mergers, acquisitions, name changes, charter conversions, failures, and other significant structural events.\n\nCommon filter examples:\n  - History for a specific bank: CERT:3511\n  - Mergers: TYPE:merger\n  - Failures: TYPE:failure\n  - Name changes: CHANGECODE:CO\n  - By date range: PROCDATE:[2008-01-01 TO 2009-12-31]\n  - By state: PSTALP:CA (two-letter state code)\n\nEvent types (TYPE):\n  merger = institution was merged into another\n  failure = institution failed\n  assistance = received FDIC assistance transaction\n  insurance = insurance-related event (new coverage, termination)\n\nCommon change codes (CHANGECODE):\n  CO = name change\n  CR = charter conversion\n  DC = deposit assumption change\n  MA = merger/acquisition (absorbed by another institution)\n  NI = new institution insured\n  TC = trust company conversion\n\nKey returned fields:\n  - CERT: FDIC Certificate Number\n  - INSTNAME: Institution name\n  - CLASS: Charter class at time of change\n  - PCITY, PSTALP: Location (city, two-letter state code)\n  - PROCDATE: Processing date of the change (YYYY-MM-DD)\n  - EFFDATE: Effective date of the change (YYYY-MM-DD)\n  - ENDEFYMD: End effective date\n  - PCERT: Predecessor/successor CERT (for mergers)\n  - TYPE: Type of structural change (see above)\n  - CHANGECODE: Code for type of change (see above)\n  - CHANGECODE_DESC: Human-readable description of the change code\n  - INSDATE: Insurance date\n\nArgs:\n  - cert (number, optional): Filter by institution CERT number\n  - filters (string, optional): ElasticSearch query filters\n  - fields (string, optional): Comma-separated field names\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by (e.g., PROCDATE)\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and event records.",
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
    "description": "Search annual Summary of Deposits (SOD) data for individual bank branches.\n\nThe SOD report provides annual deposit data at the branch level, showing deposit balances for each office of every FDIC-insured institution as of June 30 each year.\n\nCommon filter examples:\n  - All branches for a bank: CERT:3511\n  - SOD for specific year: YEAR:2022\n  - Branches in a state: STALPBR:CA\n  - Branches in a city: CITYBR:\"Austin\"\n  - High-deposit branches: DEPSUMBR:[1000000 TO *]\n  - By metro area (MSA code): MSABR:19100\n\nKey returned fields:\n  - YEAR: Report year (as of June 30)\n  - CERT: FDIC Certificate Number\n  - BRNUM: Branch number (0 = main office)\n  - NAMEFULL: Branch or institution name\n  - ADDRESBR, CITYBR, STALPBR, ZIPBR: Branch address\n  - DEPSUMBR: Total deposits at branch ($thousands)\n  - MSABR: Metropolitan Statistical Area code (numeric; 0 = non-MSA)\n  - LATITUDE, LONGITUDE: Coordinates\n\nArgs:\n  - cert (number, optional): Filter by institution CERT number\n  - year (number, optional): SOD report year (1994-present)\n  - filters (string, optional): Additional ElasticSearch query filters\n  - fields (string, optional): Comma-separated field names\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by (e.g., DEPSUMBR, YEAR)\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and deposit records.",
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
    "description": "Search BankFind demographics data for FDIC-insured institutions.\n\nReturns quarterly demographic and market-structure attributes such as office counts, territory assignments, metro classification, county/country codes, and selected geographic reference data.\n\nCommon filter examples:\n  - Demographics for a specific bank: CERT:3511\n  - By report date: REPDTE:20251231\n  - Institutions in metro areas: METRO:1\n  - Institutions with out-of-state offices: OFFSTATE:[1 TO *]\n  - Minority status date present: MNRTYDTE:[19000101 TO 99991231]\n\nKey returned fields:\n  - CERT: FDIC Certificate Number\n  - REPDTE: Report Date — the last day of the quarterly reporting period (YYYYMMDD)\n  - QTRNO: Quarter number\n  - OFFTOT: Total offices\n  - OFFSTATE: Offices in other states\n  - OFFNDOM: Offices in non-domestic territories\n  - OFFOTH: Other offices\n  - OFFSOD: Offices included in Summary of Deposits\n  - METRO, MICRO: Metro/micro area flags\n  - CBSANAME, CSA: Core-based statistical area data\n  - FDICTERR, RISKTERR: FDIC and risk territory assignments\n  - SIMS_LAT, SIMS_LONG: Geographic coordinates\n\nArgs:\n  - cert (number, optional): Filter by institution CERT number\n  - repdte (string, optional): Report Date in YYYYMMDD format (quarter-end dates: 0331, 0630, 0930, 1231)\n  - filters (string, optional): Additional ElasticSearch query filters\n  - fields (string, optional): Comma-separated field names\n  - limit (number): Records to return (default: 20)\n  - offset (number): Pagination offset (default: 0)\n  - sort_by (string, optional): Field to sort by\n  - sort_order ('ASC'|'DESC'): Sort direction (default: 'ASC')\n\nPrefer concise human-readable summaries or tables when answering users. Structured fields are available for totals, pagination, and demographic records.",
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
          "description": "Filter by Report Date (REPDTE) in YYYYMMDD format. FDIC data is published quarterly on: March 31, June 30, September 30, and December 31. Example: 20251231 for Q4 2025. If omitted, returns all available dates."
        }
      },
      "additionalProperties": false
    }
  }
}
```
