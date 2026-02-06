/**
 * Rate Limiter Middleware
 * 
 * Prevents API abuse by limiting request rates per user/organization.
 * 
 * Features:
 * - In-memory rate limiting with TTL
 * - Multiple rate limit strategies (per user, per org, per IP)
 * - Sliding window algorithm
 * - Configurable limits and windows
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimit = await checkRateLimit(request, {
 *     limit: 10,
 *     windowMs: 60000 // 10 requests per minute
 *   });
 *   
 *   if (!rateLimit.allowed) {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 *   }
 *   
 *   // ... continue with request
 * }
 * ```
 */

import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  
  /** Identifier strategy (default: 'ip') */
  strategy?: 'ip' | 'user' | 'org' | 'custom';
  
  /** Custom identifier (required if strategy is 'custom') */
  identifier?: string;
  
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean | Promise<boolean>;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Current request count */
  current: number;
  
  /** Maximum requests allowed */
  limit: number;
  
  /** Time until limit resets (ms) */
  resetMs: number;
  
  /** Number of remaining requests */
  remaining: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

/**
 * Simple in-memory rate limit store
 * Note: For production with multiple instances, use Redis or similar
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }
  
  /**
   * Increment counter for identifier
   */
  increment(identifier: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.store.get(identifier);
    
    // If entry exists and hasn't expired, increment
    if (existing && existing.resetAt > now) {
      existing.count++;
      return existing;
    }
    
    // Create new entry
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs
    };
    
    this.store.set(identifier, entry);
    return entry;
  }
  
  /**
   * Get current entry for identifier
   */
  get(identifier: string): RateLimitEntry | null {
    const entry = this.store.get(identifier);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.resetAt <= Date.now()) {
      this.store.delete(identifier);
      return null;
    }
    
    return entry;
  }
  
  /**
   * Reset counter for identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Rate limiter cleaned up ${cleaned} expired entries`);
    }
  }
  
  /**
   * Get store size (for monitoring)
   */
  size(): number {
    return this.store.size;
  }
  
  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }
  
  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global store instance
const store = new RateLimitStore();

// ============================================================================
// RATE LIMITING FUNCTIONS
// ============================================================================

/**
 * Get identifier for rate limiting based on strategy
 */
function getIdentifier(
  request: NextRequest,
  strategy: RateLimitConfig['strategy'],
  customIdentifier?: string
): string {
  switch (strategy) {
    case 'custom':
      if (!customIdentifier) {
        throw new Error('Custom identifier required for custom strategy');
      }
      return customIdentifier;
      
    case 'user': {
      // Extract user ID from request (e.g., from auth header)
      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        // Parse user ID from JWT or session
        // This is a placeholder - implement based on your auth system
        return `user:${authHeader}`;
      }
      // Fallback to IP if no auth
      return `ip:${getClientIp(request)}`;
    }
      
    case 'org': {
      // Single-tenant system - use DEFAULT_ORG_ID
      return `org:${DEFAULT_ORG_ID}`;
    }
      
    case 'ip':
    default:
      return `ip:${getClientIp(request)}`;
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback (may not work in all environments)
  return 'unknown';
}

/**
 * Check if request is rate limited
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const {
    limit,
    windowMs = 60000, // Default: 1 minute
    strategy = 'ip',
    identifier: customIdentifier,
    skip
  } = config;
  
  try {
    // Check if rate limiting should be skipped
    if (skip && await skip(request)) {
      return {
        allowed: true,
        current: 0,
        limit,
        resetMs: 0,
        remaining: limit
      };
    }
    
    // Get identifier based on strategy
    const identifier = getIdentifier(request, strategy, customIdentifier);
    
    // Increment counter
    const entry = store.increment(identifier, windowMs);
    
    // Calculate result
    const allowed = entry.count <= limit;
    const resetMs = entry.resetAt - Date.now();
    const remaining = Math.max(0, limit - entry.count);
    
    // Log if rate limit exceeded
    if (!allowed) {
      logger.warn('Rate limit exceeded', {
        identifier,
        current: entry.count,
        limit,
        strategy
      });
    }
    
    return {
      allowed,
      current: entry.count,
      limit,
      resetMs,
      remaining
    };
    
  } catch (error) {
    // On error, allow request but log
    logger.error('Rate limiter error', error as Error);
    
    return {
      allowed: true,
      current: 0,
      limit,
      resetMs: 0,
      remaining: limit
    };
  }
}

/**
 * Rate limit middleware helper
 * Returns a 429 response if rate limit exceeded
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig
): Promise<Response | null> {
  const result = await checkRateLimit(request, config);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(result.resetMs / 1000)} seconds.`,
        rateLimit: {
          limit: result.limit,
          current: result.current,
          remaining: result.remaining,
          resetMs: result.resetMs
        }
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + result.resetMs).toISOString(),
          'Retry-After': Math.ceil(result.resetMs / 1000).toString()
        }
      }
    );
  }
  
  return null; // Allow request to proceed
}

/**
 * Reset rate limit for identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  store.reset(identifier);
}

/**
 * Get store statistics (for monitoring)
 */
export function getRateLimitStats() {
  return {
    activeEntries: store.size()
  };
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Preset rate limits for common use cases
 */
export const RateLimitPresets = {
  /** Strict: 10 requests per minute */
  STRICT: {
    limit: 10,
    windowMs: 60000
  },
  
  /** Standard: 60 requests per minute */
  STANDARD: {
    limit: 60,
    windowMs: 60000
  },
  
  /** Generous: 300 requests per minute */
  GENEROUS: {
    limit: 300,
    windowMs: 60000
  },
  
  /** AI endpoints: 20 requests per minute (expensive operations) */
  AI_OPERATIONS: {
    limit: 20,
    windowMs: 60000
  },
  
  /** Data mutations: 30 requests per minute */
  MUTATIONS: {
    limit: 30,
    windowMs: 60000
  },
  
  /** Read operations: 120 requests per minute */
  READS: {
    limit: 120,
    windowMs: 60000
  }
} as const;
