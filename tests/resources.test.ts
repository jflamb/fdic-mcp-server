import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/index.js";

async function connectClientAndServer() {
  const client = new Client({
    name: "fdic-mcp-server-test-client",
    version: "0.0.0-test",
  });
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

describe("schema resources", () => {
  let current:
    | {
        client: Client;
        server: ReturnType<typeof createServer>;
      }
    | undefined;

  afterEach(async () => {
    await current?.client.close();
    await current?.server.close();
    current = undefined;
  });

  it("lists schema resources over an in-memory MCP connection", async () => {
    current = await connectClientAndServer();

    const result = await current.client.listResources();
    const uris = result.resources.map((resource) => resource.uri);

    expect(uris).toContain("fdic://schemas/index");
    expect(uris).toContain("fdic://schemas/history");
    expect(uris).toContain("fdic://schemas/failures");
  });

  it("reads the schema index resource over an in-memory MCP connection", async () => {
    current = await connectClientAndServer();

    const result = await current.client.readResource({
      uri: "fdic://schemas/index",
    });
    const parsed = JSON.parse(result.contents[0].text ?? "{}");

    expect(parsed.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: "institutions",
          uri: "fdic://schemas/institutions",
        }),
        expect.objectContaining({
          endpoint: "demographics",
          uri: "fdic://schemas/demographics",
        }),
      ]),
    );
  });
});
