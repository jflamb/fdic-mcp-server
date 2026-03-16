import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  getEndpointMetadata,
  listEndpointMetadata,
} from "../services/fdicSchema.js";

const RESOURCE_SCHEME = "fdic";
const INDEX_URI = `${RESOURCE_SCHEME}://schemas/index`;

function getEndpointResourceUri(endpoint: string): string {
  return `${RESOURCE_SCHEME}://schemas/${endpoint}`;
}

export function registerSchemaResources(server: McpServer): void {
  const endpointMetadata = listEndpointMetadata();

  server.registerResource(
    "fdic-schema-index",
    INDEX_URI,
    {
      title: "FDIC Endpoint Schema Index",
      description:
        "Machine-readable index of endpoint field catalogs exposed by this MCP server.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: INDEX_URI,
          text: JSON.stringify(
            {
              resources: endpointMetadata.map((metadata) => ({
                endpoint: metadata.endpoint,
                title: metadata.title,
                uri: getEndpointResourceUri(metadata.endpoint),
                field_count: Object.keys(metadata.fields).length,
                source: metadata.source,
              })),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  for (const metadata of endpointMetadata) {
    const uri = getEndpointResourceUri(metadata.endpoint);

    server.registerResource(
      `fdic-schema-${metadata.endpoint}`,
      uri,
      {
        title: `${metadata.endpoint} field catalog`,
        description:
          `Machine-readable FDIC field metadata for the ${metadata.endpoint} endpoint.`,
        mimeType: "application/json",
      },
      async () => ({
        contents: [
          {
            uri,
            text: JSON.stringify(
              {
                endpoint: metadata.endpoint,
                title: metadata.title,
                description: metadata.description,
                source: metadata.source,
                sort_fields: metadata.sortFields,
                fields: metadata.fields,
              },
              null,
              2,
            ),
          },
        ],
      }),
    );
  }
}

export function getSchemaResourceUri(endpoint: string): string {
  if (!getEndpointMetadata(endpoint)) {
    throw new Error(`No schema metadata found for endpoint ${endpoint}.`);
  }

  return getEndpointResourceUri(endpoint);
}

export { INDEX_URI as FDIC_SCHEMA_INDEX_URI };
