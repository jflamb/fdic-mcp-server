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

export class ConcurrentLimiter {
  private readonly maxConcurrent: number;
  private readonly active = new Map<string, number>();

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  acquire(key: string): (() => void) | undefined {
    const current = this.active.get(key) ?? 0;
    if (current >= this.maxConcurrent) {
      return undefined;
    }

    this.active.set(key, current + 1);

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;

      const latest = this.active.get(key) ?? 0;
      if (latest <= 1) {
        this.active.delete(key);
        return;
      }

      this.active.set(key, latest - 1);
    };
  }
}
