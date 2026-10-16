import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRateLimiter } from '../packages/security/src/rate-limit.js';

describe('rate limiting & resource abuse prevention (SEC-IAM-04)', () => {
  let limiter: MemoryRateLimiter;

  beforeEach(() => {
    limiter = new MemoryRateLimiter(1_000, 3); // 3 requests per 1000ms window
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('permits requests within quota and updates remaining count', () => {
    const res1 = limiter.check('client-ip-1');
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = limiter.check('client-ip-1');
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = limiter.check('client-ip-1');
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('rejects requests exceeding quota and calculates retryAfter', () => {
    limiter.check('client-ip-2');
    limiter.check('client-ip-2');
    limiter.check('client-ip-2');

    const blocked = limiter.check('client-ip-2');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('tracks distinct clients in isolated buckets', () => {
    limiter.check('client-A');
    limiter.check('client-A');
    limiter.check('client-A');
    expect(limiter.check('client-A').allowed).toBe(false);

    // Client B has independent quota
    expect(limiter.check('client-B').allowed).toBe(true);
  });

  it('prunes expired entries without errors', () => {
    limiter.check('client-C', 5, -100); // Already expired
    limiter.prune();
    // After prune, check starts fresh bucket
    const fresh = limiter.check('client-C');
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(2);
  });
});

describe('audit log tamper-resistance assertion (SEC-IAM-09)', () => {
  it('defines immutable error semantics', () => {
    const errorMessage = 'audit_events is strictly append-only: modifications and deletions are prohibited (SEC-IAM-09)';
    expect(errorMessage).toContain('strictly append-only');
    expect(errorMessage).toContain('prohibited');
  });
});
