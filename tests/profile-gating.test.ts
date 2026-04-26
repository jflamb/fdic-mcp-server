import { describe, it, expect, vi } from "vitest";

vi.mock("axios", () => {
  const create = vi.fn().mockReturnValue({ get: vi.fn() });
  class MockAxiosError extends Error {}
  return { default: { create }, AxiosError: MockAxiosError };
});

import { createServer, resolveProfile } from "../src/index.js";

interface RegisteredTool {
  name: string;
}

function listToolNames(server: ReturnType<typeof createServer>): string[] {
  // McpServer keeps registered tools on `_registeredTools`.
  const internal = server as unknown as {
    _registeredTools: Record<string, RegisteredTool>;
  };
  return Object.keys(internal._registeredTools);
}

describe("FDIC_MCP_PROFILE gating", () => {
  it("default profile registers core, analysis, and ChatGPT tools plus aliases", () => {
    const server = createServer();
    const names = listToolNames(server);
    expect(names).toContain("fdic_search_institutions");
    expect(names).toContain("fdic_analyze_bank_health");
    expect(names).toContain("search");
    expect(names).toContain("fetch");
    expect(names).toContain("fdic_search");
    expect(names).toContain("fdic_fetch");
    expect(names).toContain("fdic_show_bank_deep_dive");
  });

  it("`core` profile drops analysis and chatgpt tools", () => {
    const server = createServer({ profile: "core" });
    const names = listToolNames(server);
    expect(names).toContain("fdic_search_institutions");
    expect(names).not.toContain("fdic_analyze_bank_health");
    expect(names).not.toContain("search");
    expect(names).not.toContain("fdic_search");
    expect(names).not.toContain("fdic_show_bank_deep_dive");
  });

  it("`core,analysis` profile keeps the FDIC suite but drops ChatGPT tools", () => {
    const server = createServer({ profile: "core,analysis" });
    const names = listToolNames(server);
    expect(names).toContain("fdic_search_institutions");
    expect(names).toContain("fdic_analyze_bank_health");
    expect(names).not.toContain("search");
    expect(names).not.toContain("fetch");
    expect(names).not.toContain("fdic_search");
    expect(names).not.toContain("fdic_show_bank_deep_dive");
  });

  it("`core,chatgpt-aliases` registers fdic_search/fdic_fetch but skips the un-prefixed ChatGPT names", () => {
    const server = createServer({ profile: "core,chatgpt-aliases" });
    const names = listToolNames(server);
    expect(names).toContain("fdic_search_institutions");
    expect(names).toContain("fdic_search");
    expect(names).toContain("fdic_fetch");
    expect(names).not.toContain("search");
    expect(names).not.toContain("fetch");
  });

  it("`chatgpt` profile registers ChatGPT canonical names plus aliases", () => {
    const server = createServer({ profile: "chatgpt" });
    const names = listToolNames(server);
    expect(names).toContain("search");
    expect(names).toContain("fetch");
    expect(names).toContain("fdic_search");
    expect(names).toContain("fdic_fetch");
    expect(names).toContain("fdic_show_bank_deep_dive");
    expect(names).not.toContain("fdic_search_institutions");
    expect(names).not.toContain("fdic_analyze_bank_health");
  });
});

describe("resolveProfile", () => {
  it("treats undefined as `all`", () => {
    expect(resolveProfile(undefined).core).toBe(true);
    expect(resolveProfile(undefined).chatgptCanonical).toBe(true);
  });

  it("respects an explicit `all` token", () => {
    const profile = resolveProfile("all");
    expect(profile.core).toBe(true);
    expect(profile.analysis).toBe(true);
    expect(profile.chatgptCanonical).toBe(true);
    expect(profile.chatgptAliases).toBe(true);
  });

  it("parses comma-separated tokens", () => {
    const profile = resolveProfile("core,analysis");
    expect(profile.core).toBe(true);
    expect(profile.analysis).toBe(true);
    expect(profile.chatgptCanonical).toBe(false);
    expect(profile.chatgptAliases).toBe(false);
  });

  it("can drop just the canonical ChatGPT names while keeping aliases", () => {
    const profile = resolveProfile("core,chatgpt-aliases");
    expect(profile.chatgptCanonical).toBe(false);
    expect(profile.chatgptAliases).toBe(true);
  });
});
