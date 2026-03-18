interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  check(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const timestamps = this.hits.get(key) ?? [];
    const recent = timestamps.filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
