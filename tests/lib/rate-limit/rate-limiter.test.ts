/**
 * Unit Tests: src/lib/rate-limit/rate-limiter.ts
 *
 * Validates checkRateLimit and rateLimitMiddleware behaviour against a fully
 * mocked cacheService so that no Redis or in-memory state leaks between cases.
 *
 * Strategy: jest.mock() replaces the module so imports never hit Redis.
 *           jest.spyOn() is used in beforeEach to obtain a properly-typed
 *           mock handle with the full jest.Mock API (mockResolvedValueOnce etc).
 *           This pattern is required because babel-jest does not hoist
 *           jest.fn() calls made inside jest.mock() factory closures.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Replace the module so its imports never reach the real Redis implementation.
// The object shape must match what the module under test destructures so that
// the import bindings resolve correctly.
// ---------------------------------------------------------------------------

jest.mock('@/lib/cache/redis-service', () => ({
  cacheService: {
    // Placeholder — replaced per-test with jest.spyOn in beforeEach.
    incrementWithTTL: (_key: string, _ttl: number): Promise<number> => Promise.resolve(0),
  },
  CacheKeys: {
    rateLimit: (clientId: string, path: string) => `rate-limit:${clientId}:${path}`,
  },
}));

// Import the module under test and the mocked dependency after jest.mock() is
// registered so the module registry gives us the mocked version.
import { checkRateLimit, rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { cacheService } from '@/lib/cache/redis-service';

// ---------------------------------------------------------------------------
// Shared request factory
// ---------------------------------------------------------------------------

function makeMockRequest(url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
}

// ============================================================================
// checkRateLimit
// ============================================================================

describe('checkRateLimit', () => {
  let spy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    spy = jest.spyOn(cacheService, 'incrementWithTTL');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('returns allowed:true when the request count is under the default limit', async () => {
    // First request in the window — count is 1, well under the default max of 100.
    spy.mockResolvedValueOnce(1);

    const result = await checkRateLimit(makeMockRequest());

    expect(result.allowed).toBe(true);
  });

  it('returns allowed:false when the request count exceeds the default 100-request limit', async () => {
    // 101st request — one over the default max of 100.
    spy.mockResolvedValueOnce(101);

    const result = await checkRateLimit(makeMockRequest());

    expect(result.allowed).toBe(false);
  });

  it('returns the correct remaining count for an under-limit request', async () => {
    // 40th request against the default 100-request window.
    spy.mockResolvedValueOnce(40);

    const result = await checkRateLimit(makeMockRequest());

    // remaining = maxRequests(100) - count(40) = 60
    expect(result.remaining).toBe(60);
  });

  it('returns remaining:0 when the limit is exceeded', async () => {
    spy.mockResolvedValueOnce(101);

    const result = await checkRateLimit(makeMockRequest());

    expect(result.remaining).toBe(0);
  });

  it('applies the endpoint-specific limit for /api/auth/register (max 3)', async () => {
    // Count of 4 must be rejected under the /api/auth/register max of 3.
    spy.mockResolvedValueOnce(4);

    const request = makeMockRequest('http://localhost/api/auth/register');
    const result = await checkRateLimit(request, '/api/auth/register');

    expect(result.allowed).toBe(false);
  });

  it('allows a request at exactly the /api/auth/register limit (count === max)', async () => {
    // Count of 3 equals the max — still within budget.
    spy.mockResolvedValueOnce(3);

    const request = makeMockRequest('http://localhost/api/auth/register');
    const result = await checkRateLimit(request, '/api/auth/register');

    expect(result.allowed).toBe(true);
  });

  it('falls back to the default 100/min config for an unknown endpoint', async () => {
    // 50 requests on an unrecognised path must be allowed.
    spy.mockResolvedValueOnce(50);

    const request = makeMockRequest('http://localhost/api/unknown-endpoint');
    const result = await checkRateLimit(request, '/api/unknown-endpoint');

    expect(result.allowed).toBe(true);
    // remaining = 100 - 50 = 50
    expect(result.remaining).toBe(50);
  });

  it('includes a resetAt timestamp in the future', async () => {
    spy.mockResolvedValueOnce(1);

    const before = Date.now();
    const result = await checkRateLimit(makeMockRequest());

    expect(result.resetAt).toBeGreaterThan(before);
  });
});

// ============================================================================
// rateLimitMiddleware
// ============================================================================

describe('rateLimitMiddleware', () => {
  let spy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    spy = jest.spyOn(cacheService, 'incrementWithTTL');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('returns null when the request is within the rate limit', async () => {
    spy.mockResolvedValueOnce(1);

    const response = await rateLimitMiddleware(makeMockRequest());

    expect(response).toBeNull();
  });

  it('returns a 429 NextResponse when the rate limit is exceeded', async () => {
    spy.mockResolvedValueOnce(101);

    const response = await rateLimitMiddleware(makeMockRequest());

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
  });

  it('sets X-RateLimit-Remaining header to 0 on a rate-limited response', async () => {
    spy.mockResolvedValueOnce(101);

    const response = await rateLimitMiddleware(makeMockRequest());

    expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('sets a Retry-After header on a rate-limited response', async () => {
    spy.mockResolvedValueOnce(101);

    const response = await rateLimitMiddleware(makeMockRequest());

    const retryAfter = response?.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    // Retry-After must be a positive integer string.
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it('includes a retryAfter field in the 429 response body', async () => {
    spy.mockResolvedValueOnce(101);

    const response = await rateLimitMiddleware(makeMockRequest());

    const body = (await response?.json()) as {
      success: boolean;
      error: string;
      retryAfter: number;
    };

    expect(body).toHaveProperty('retryAfter');
    expect(typeof body.retryAfter).toBe('number');
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('includes success:false and an error message in the 429 response body', async () => {
    spy.mockResolvedValueOnce(101);

    const response = await rateLimitMiddleware(makeMockRequest());

    const body = (await response?.json()) as {
      success: boolean;
      error: string;
      retryAfter: number;
    };

    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });
});
