import { describe, expect, it } from "vitest";

import { isBlockedIp, parseBlockedIpRules } from "../src/requestIdentity.js";

describe("IP block rules", () => {
  it("matches exact IPv4 and IPv6 addresses", () => {
    const rules = parseBlockedIpRules("203.0.113.10 2605:a601:8119:1800::1");

    expect(isBlockedIp("203.0.113.10", rules)).toBe(true);
    expect(isBlockedIp("203.0.113.11", rules)).toBe(false);
    expect(isBlockedIp("2605:a601:8119:1800::1", rules)).toBe(true);
    expect(isBlockedIp("2605:a601:8119:1800::2", rules)).toBe(false);
  });

  it("matches IPv4 and IPv6 CIDR ranges", () => {
    const rules = parseBlockedIpRules(
      "203.0.113.0/24,2605:a601:8119:1800::/64",
    );

    expect(isBlockedIp("203.0.113.10", rules)).toBe(true);
    expect(isBlockedIp("203.0.114.10", rules)).toBe(false);
    expect(
      isBlockedIp("2605:a601:8119:1800:b10e:b915:d83c:13e1", rules),
    ).toBe(true);
    expect(
      isBlockedIp("2605:a601:8119:1801:b10e:b915:d83c:13e1", rules),
    ).toBe(false);
  });

  it("rejects invalid blocklist entries", () => {
    expect(() => parseBlockedIpRules("not-an-ip")).toThrow(
      "Invalid MCP_BLOCKED_IPS entry: not-an-ip",
    );
    expect(() => parseBlockedIpRules("203.0.113.0/33")).toThrow(
      "Invalid MCP_BLOCKED_IPS prefix: 203.0.113.0/33",
    );
  });
});
