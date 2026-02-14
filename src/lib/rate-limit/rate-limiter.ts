/**
 * Rate Limiting Service
 * Prevents abuse and DDoS attacks by limiting request frequency.
 * Uses Redis (via cacheService) when REDIS_URL is set for distributed rate limiting.
 * Falls back to in-memory cache when Redis is unavailable.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cacheService, CacheKeys } from '@/lib/cache/redis-service';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
};

// Per-endpoint rate limits (specific limits for high-traffic/sensitive endpoints)
const endpointLimits: Record<string, RateLimitConfig> = {
  // Email/SMS (expensive operations)
  '/api/email/send': { maxRequests: 50, windowMs: 60 * 1000 }, // 50 emails per minute
  '/api/sms/send': { maxRequests: 20, windowMs: 60 * 1000 }, // 20 SMS per minute
  '/api/email/campaigns': { maxRequests: 30, windowMs: 60 * 1000 },

  // Payment endpoints (fraud prevention)
  '/api/checkout/create-payment-intent': { maxRequests: 30, windowMs: 60 * 1000 },
  '/api/checkout/create-session': { maxRequests: 30, windowMs: 60 * 1000 },
  '/api/billing/subscribe': { maxRequests: 20, windowMs: 60 * 1000 },
  '/api/billing/webhook': { maxRequests: 500, windowMs: 60 * 1000 }, // Higher for Stripe webhooks

  // Admin endpoints (strict - privilege escalation risk)
  '/api/admin/users': { maxRequests: 30, windowMs: 60 * 1000 },
  '/api/admin/organizations': { maxRequests: 30, windowMs: 60 * 1000 },
  '/api/admin/verify': { maxRequests: 10, windowMs: 60 * 1000 }, // Brute force protection

  // AI/Heavy compute
  '/api/agent/chat': { maxRequests: 100, windowMs: 60 * 1000 },
  '/api/ai/generate-image': { maxRequests: 20, windowMs: 60 * 1000 }, // DALL-E 3 — expensive
  '/api/website/ai/generate': { maxRequests: 10, windowMs: 60 * 1000 }, // AI page generation — expensive
  '/api/leads/research': { maxRequests: 30, windowMs: 60 * 1000 },
  '/api/leads/enrich': { maxRequests: 50, windowMs: 60 * 1000 },

  // Workflow execution
  '/api/workflows/execute': { maxRequests: 200, windowMs: 60 * 1000 },
  '/api/workflows/triggers/schedule': { maxRequests: 10, windowMs: 60 * 1000 }, // Internal cron only
  '/api/workflows/webhooks': { maxRequests: 500, windowMs: 60 * 1000 }, // Higher for external webhooks

  // Search/Analytics (read-heavy)
  '/api/search': { maxRequests: 200, windowMs: 60 * 1000 },
  '/api/analytics/revenue': { maxRequests: 100, windowMs: 60 * 1000 },
  '/api/analytics/pipeline': { maxRequests: 100, windowMs: 60 * 1000 },

  // E-commerce
  '/api/ecommerce/orders': { maxRequests: 100, windowMs: 60 * 1000 },

  // Outbound sequences
  '/api/outbound/sequences': { maxRequests: 100, windowMs: 60 * 1000 },

  // OAuth integrations (moderate limits)
  '/api/integrations/google/callback': { maxRequests: 50, windowMs: 60 * 1000 },
  '/api/integrations/microsoft/auth': { maxRequests: 50, windowMs: 60 * 1000 },
  '/api/integrations/microsoft/callback': { maxRequests: 50, windowMs: 60 * 1000 },
  '/api/integrations/slack/auth': { maxRequests: 50, windowMs: 60 * 1000 },
  '/api/integrations/slack/callback': { maxRequests: 50, windowMs: 60 * 1000 },
  '/api/integrations/quickbooks/auth': { maxRequests: 50, windowMs: 60 * 1000 },
  '/api/integrations/quickbooks/callback': { maxRequests: 50, windowMs: 60 * 1000 },

  // Webhooks (high limits - legitimate traffic)
  '/api/webhooks/email': { maxRequests: 500, windowMs: 60 * 1000 },
  '/api/webhooks/gmail': { maxRequests: 500, windowMs: 60 * 1000 },
  '/api/webhooks/sms': { maxRequests: 500, windowMs: 60 * 1000 },

  // Tracking pixels (very high limit - email clients)
  '/api/email/track': { maxRequests: 1000, windowMs: 60 * 1000 },
  '/api/email/track/link': { maxRequests: 500, windowMs: 60 * 1000 },

  // Social media endpoints (moderate limits - external API rate limits apply)
  '/api/social/twitter/post': { maxRequests: 50, windowMs: 60 * 1000 }, // Twitter has strict limits
  '/api/social/schedule': { maxRequests: 100, windowMs: 60 * 1000 },
  '/api/social/queue': { maxRequests: 100, windowMs: 60 * 1000 },

  // Setup (strict - should be called rarely)
  '/api/setup/create-platform-org': { maxRequests: 5, windowMs: 60 * 1000 },

  // Health checks (high limit - monitoring)
  '/api/health': { maxRequests: 200, windowMs: 60 * 1000 },
  '/api/health/detailed': { maxRequests: 100, windowMs: 60 * 1000 },

  // Test endpoints (strict - should be disabled in prod)
  '/api/test/admin-status': { maxRequests: 10, windowMs: 60 * 1000 },
  '/api/test/outbound': { maxRequests: 10, windowMs: 60 * 1000 },

  // Cron jobs (very strict - internal only)
  '/api/cron/process-sequences': { maxRequests: 10, windowMs: 60 * 1000 },

  // Auth endpoints (brute force prevention)
  '/api/auth/login': { maxRequests: 5, windowMs: 60 * 1000 }, // 5 login attempts per minute
  '/api/auth/register': { maxRequests: 3, windowMs: 60 * 1000 },
};

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest): string {
  // Try to get user ID from auth token
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // In production, extract user ID from token
    // For now, use IP address as fallback
  }

  // Use IP address as identifier
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : (request.headers.get('x-real-ip') ?? 'unknown');

  return ip;
}

/**
 * Check if request should be rate limited.
 * Uses Redis via cacheService for distributed rate limiting.
 * TTL-based expiry handles cleanup automatically.
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const clientId = getClientId(request);
  const path = endpoint ?? new URL(request.url).pathname;

  // Get rate limit config for this endpoint
  const config = endpointLimits[path] || defaultConfig;

  const now = Date.now();
  const ttlSeconds = Math.ceil(config.windowMs / 1000);
  const key = CacheKeys.rateLimit(clientId, path);

  // Atomically increment and set TTL on first request in window
  const count = await cacheService.incrementWithTTL(key, ttlSeconds);

  if (count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + config.windowMs,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - count,
    resetAt: now + config.windowMs,
  };
}

/**
 * Rate limit middleware for API routes
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  endpoint?: string
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, endpoint);

  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': endpointLimits[endpoint ?? new URL(request.url).pathname]?.maxRequests.toString() || '100',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
          'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // Request allowed
}
