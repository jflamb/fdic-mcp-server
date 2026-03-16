import { FDIC_ENDPOINT_METADATA } from "../fdicEndpointMetadata.js";

const FIELD_OVERRIDES = {
  financials: {
    NETNIM: {
      name: "NETNIM",
      title: "Net Interest Margin",
      description:
        "Supplemental field used by this server for peer-group and analysis workflows.",
      type: "number",
      filterable: true,
      sortable: true,
      output: true,
    },
  },
} as const;

function parseCommaSeparatedFields(value: string): string[] {
  return value
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
}

function quoteFieldList(fields: string[]): string {
  return fields.map((field) => `'${field}'`).join(", ");
}

export function getEndpointMetadata(endpoint: string) {
  const baseMetadata = FDIC_ENDPOINT_METADATA[endpoint];
  if (!baseMetadata) {
    return undefined;
  }

  const overrides = FIELD_OVERRIDES[endpoint as keyof typeof FIELD_OVERRIDES];
  if (!overrides) {
    return baseMetadata;
  }

  return {
    ...baseMetadata,
    fields: {
      ...baseMetadata.fields,
      ...overrides,
    } as typeof baseMetadata.fields,
    sortFields: [
      ...new Set([...baseMetadata.sortFields, ...Object.keys(overrides)]),
    ],
  };
}

export function listEndpointMetadata() {
  return Object.keys(FDIC_ENDPOINT_METADATA)
    .sort()
    .map((endpoint) => getEndpointMetadata(endpoint))
    .filter((metadata): metadata is NonNullable<typeof metadata> => metadata !== undefined);
}

export function validateEndpointQueryParams(
  endpoint: string,
  params: { fields?: string; sort_by?: string },
): void {
  const metadata = getEndpointMetadata(endpoint);
  if (!metadata) {
    return;
  }

  if (params.fields) {
    const requestedFields = parseCommaSeparatedFields(params.fields);
    const invalidFields = requestedFields.filter(
      (field) => metadata.fields[field] === undefined,
    );

    if (invalidFields.length > 0) {
      throw new Error(
        `Invalid field ${quoteFieldList(invalidFields)} for endpoint ${endpoint}. ` +
          `Use the endpoint-specific field catalog for ${endpoint}.`,
      );
    }
  }

  if (params.sort_by && metadata.fields[params.sort_by] === undefined) {
    throw new Error(
      `Invalid sort_by field '${params.sort_by}' for endpoint ${endpoint}. ` +
        `Use a sortable field defined for ${endpoint}.`,
    );
  }
}
