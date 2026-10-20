import { LOCK_WINDOW_MS, LoginRateLimiter, MAX_TRACKED_KEYS } from './login-rate-limiter.js';

const t0 = new Date('2026-01-01T12:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

function fail(limiter: LoginRateLimiter, key: string, times: number, now: Date = t0) {
  for (let i = 0; i < times; i++) limiter.recordFailure(key, now);
}

describe('LoginRateLimiter', () => {
  it('does not block before the 5th failure', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, 'a@example.com', 4);
    expect(limiter.retryAfterSeconds('a@example.com', t0)).toBe(0);
  });

  it('blocks after 5 failures and reports the remaining seconds', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, 'a@example.com', 5);
    expect(limiter.retryAfterSeconds('a@example.com', at(60 * 1000))).toBe(840);
  });

  it('unblocks when the 15-minute window expires', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, 'a@example.com', 5);
    const later = at(LOCK_WINDOW_MS);
    expect(limiter.retryAfterSeconds('a@example.com', later)).toBe(0);

    fail(limiter, 'a@example.com', 4, later);
    expect(limiter.retryAfterSeconds('a@example.com', later)).toBe(0);
    limiter.recordFailure('a@example.com', later);
    expect(limiter.retryAfterSeconds('a@example.com', later)).toBeGreaterThan(0);
  });

  it('reset clears the counter', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, 'a@example.com', 5);
    limiter.reset('a@example.com');
    expect(limiter.retryAfterSeconds('a@example.com', t0)).toBe(0);
  });

  it('normalizes the key', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, ' Admin@Example.com ', 3);
    fail(limiter, 'admin@example.com', 2);
    expect(limiter.retryAfterSeconds('ADMIN@example.com', t0)).toBeGreaterThan(0);
  });

  it('keeps keys independent', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, 'a@example.com', 5);
    expect(limiter.retryAfterSeconds('b@example.com', t0)).toBe(0);
  });

  it('never tracks more than MAX_TRACKED_KEYS keys', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < MAX_TRACKED_KEYS + 50; i++) {
      limiter.recordFailure(`user-${i}@example.com`, t0);
    }
    expect(limiter.size).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });
});
