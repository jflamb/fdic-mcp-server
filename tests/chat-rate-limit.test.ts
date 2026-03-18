import { describe, expect, it, vi } from "vitest";

import { RateLimiter } from "../src/chatRateLimit.js";

describe("RateLimiter", () => {
  it("allows requests under the threshold", () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });

    expect(limiter.check("1.2.3.4", 1)).toBe(true);
    expect(limiter.check("1.2.3.4", 2)).toBe(true);
    expect(limiter.check("1.2.3.4", 3)).toBe(true);
  });

  it("rejects requests over the threshold", () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });

    limiter.check("1.2.3.4", 1);
    limiter.check("1.2.3.4", 2);
    limiter.check("1.2.3.4", 3);

    expect(limiter.check("1.2.3.4", 4)).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });

    expect(limiter.check("1.2.3.4", 1)).toBe(true);
    expect(limiter.check("1.2.3.4", 2)).toBe(false);
    expect(limiter.check("5.6.7.8", 2)).toBe(true);
  });

  it("allows requests again after the sliding window expires", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });

    expect(limiter.check("1.2.3.4", 1)).toBe(true);
    expect(limiter.check("1.2.3.4", 2)).toBe(true);
    expect(limiter.check("1.2.3.4", 3)).toBe(false);
    expect(limiter.check("1.2.3.4", 60_005)).toBe(true);

    vi.useRealTimers();
  });
});
