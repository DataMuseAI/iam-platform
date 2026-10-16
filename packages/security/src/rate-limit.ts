/**
 * High-performance sliding-window in-memory rate limiter (SEC-IAM-04).
 * Enforces per-IP and per-client throughput limits without external dependencies.
 */
export class MemoryRateLimiter {
  private windows: Map<string, { count: number; resetAt: number }> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly defaultWindowMs: number = 60_000,
    public readonly defaultMax: number = 100
  ) {
    this.cleanupTimer = setInterval(() => this.prune(), 30_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Evaluates request against rate limit quota.
   * @param key Unique client/route identifier (e.g., "ip:127.0.0.1:/v1/decisions/check")
   * @param max Maximum requests in window (defaults to instance configuration)
   * @param windowMs Window duration in milliseconds (defaults to instance configuration)
   */
  public check(
    key: string,
    max = this.defaultMax,
    windowMs = this.defaultWindowMs
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterSec: number;
  } {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(0, max - 1),
        resetAt,
        retryAfterSec: Math.ceil(windowMs / 1000)
      };
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfterSec
      };
    }

    entry.count += 1;
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return {
      allowed: true,
      remaining: Math.max(0, max - entry.count),
      resetAt: entry.resetAt,
      retryAfterSec
    };
  }

  /**
   * Prunes expired window entries to prevent memory leak under high distinct-key traffic.
   */
  public prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      if (now > entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Clears all rate limit windows (useful for testing).
   */
  public reset(): void {
    this.windows.clear();
  }

  /**
   * Cleans up background interval timer.
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }
}
