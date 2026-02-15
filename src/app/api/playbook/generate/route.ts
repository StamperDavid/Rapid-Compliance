/**
 * Playbook Generation API Endpoint
 * 
 * POST /api/playbook/generate
 * 
 * Generates a playbook by extracting patterns from conversation intelligence data.
 * Rate limited to prevent abuse and control AI costs.
 * 
 * FEATURES:
 * - Rate limiting (5 requests per minute per organization)
 * - Input validation with Zod
 * - Error handling with proper status codes
 * - Response caching (1 hour TTL)
 * - Signal Bus integration
 * 
 * @module api/playbook/generate
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generatePlaybook } from '@/lib/playbook/playbook-engine';
import type { GeneratePlaybookRequest, GeneratePlaybookResponse } from '@/lib/playbook/types';
import { validateGeneratePlaybookRequest } from '@/lib/playbook/validation';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { ZodError } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// Use the actual response type for caching
type PlaybookGenerationResult = GeneratePlaybookResponse;

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // Lower for expensive playbook generation

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Check if request is rate limited
 */
function checkRateLimit(): { allowed: boolean; resetAt: number; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(PLATFORM_ID);

  // No entry or window expired
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(PLATFORM_ID, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true, resetAt: now + RATE_LIMIT_WINDOW, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  // Within window
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetAt: entry.resetAt, remaining: 0 };
  }

  // Increment count
  entry.count++;
  return { allowed: true, resetAt: entry.resetAt, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry {
  data: PlaybookGenerationResult;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cached response
 */
function getCachedResponse(key: string): PlaybookGenerationResult | null {
  const entry = responseCache.get(key);
  if (!entry) { return null; }

  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set cached response
 */
function setCachedResponse(key: string, data: PlaybookGenerationResult): void {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

/**
 * Generate cache key for playbook generation request
 */
function getCacheKey(request: GeneratePlaybookRequest): string {
  const parts = [
    PLATFORM_ID,
    request.category,
    request.conversationType,
    (request.sourceConversationIds ?? []).slice(0, 5).join(','),
  ];
  return `playbook_${parts.join('_')}`;
}

// ============================================================================
// VALIDATION HELPER
// ============================================================================

function parsePlaybookRequestOrError(body: unknown): GeneratePlaybookRequest | NextResponse {
  try {
    return validateGeneratePlaybookRequest(body) as GeneratePlaybookRequest;
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('Invalid playbook generation request', { errors: JSON.stringify(error.errors) });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: error.errors,
        },
        { status: 400 }
      );
    }
    throw error;
  }
}

function isNextResponse(value: GeneratePlaybookRequest | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/playbook/generate
 * 
 * Generate a playbook from conversation intelligence data
 * 
 * REQUEST BODY:
 * {
 *   name: string,
 *   description?: string,
 *   category: PlaybookCategory,
 *   conversationType: ConversationType,
 *   sourceConversationIds?: string[],
 *   topPerformerIds?: string[],
 *   minPerformanceScore?: number,
 *   dateRange?: {
 *     startDate: Date | string,
 *     endDate: Date | string
 *   },
 *   includePatterns?: boolean,
 *   includeTalkTracks?: boolean,
 *   includeObjectionResponses?: boolean,
 *   includeBestPractices?: boolean,
 *   autoActivate?: boolean
 * }
 * 
 * RESPONSE:
 * {
 *   success: boolean,
 *   playbook: Playbook,
 *   extractionResult: PatternExtractionResult,
 *   metadata: {
 *     generatedAt: Date,
 *     processingTime: number,
 *     aiModel: string,
 *     confidence: number
 *   },
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 1. Parse request body
    const body: unknown = await request.json();

    // 2. Validate request
    const parseResult = parsePlaybookRequestOrError(body);
    if (isNextResponse(parseResult)) {
      return parseResult;
    }
    const validatedRequest: GeneratePlaybookRequest = parseResult;

    // 3. Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      logger.warn('Rate limit exceeded for playbook generation', {
        retryAfter,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          },
        }
      );
    }

    // 4. Check cache (unless forceRefresh specified)
    const cacheKey = getCacheKey(validatedRequest);
    if (!validatedRequest.autoActivate) { // Don't cache if auto-activating
      const cachedResponse = getCachedResponse(cacheKey);
      if (cachedResponse) {
        logger.info('Returning cached playbook generation result', {
          cacheKey,
        });

        return NextResponse.json(cachedResponse, {
          headers: {
            'X-Cache': 'HIT',
            'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          },
        });
      }
    }

    // 5. Generate playbook
    logger.info('Generating playbook', {
      name: validatedRequest.name,
      category: validatedRequest.category,
    });

    const result = await generatePlaybook(validatedRequest, {}, authResult.user.uid);

    // 6. Cache successful response
    if (result.success && !validatedRequest.autoActivate) {
      setCachedResponse(cacheKey, result);
    }

    const processingTime = Date.now() - startTime;

    // 7. Log success
    logger.info('Playbook generation completed', {
      playbookId: result.playbook?.id,
      success: result.success,
      processingTime,
      patterns: result.extractionResult?.patterns?.length || 0,
      talkTracks: result.extractionResult?.talkTracks?.length || 0,
    });
    
    // 8. Return response
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
      headers: {
        'X-Cache': 'MISS',
        'X-Processing-Time': processingTime.toString(),
        'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Playbook generation failed', error instanceof Error ? error : new Error(String(error)), {
      processingTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/playbook/generate
 *
 * Returns API documentation
 */
export function GET() {
  return NextResponse.json({
    endpoint: '/api/playbook/generate',
    method: 'POST',
    description: 'Generate a playbook by extracting patterns from conversation intelligence data',
    rateLimit: {
      requests: MAX_REQUESTS_PER_WINDOW,
      window: '1 minute',
    },
    caching: {
      enabled: true,
      ttl: '1 hour',
    },
    requestBody: {
      name: 'string (required)',
      description: 'string (optional)',
      category: 'PlaybookCategory (required)',
      conversationType: 'ConversationType (required)',
      sourceConversationIds: 'string[] (optional)',
      topPerformerIds: 'string[] (optional)',
      minPerformanceScore: 'number (optional)',
      dateRange: 'DateRange (optional)',
      includePatterns: 'boolean (optional, default: true)',
      includeTalkTracks: 'boolean (optional, default: true)',
      includeObjectionResponses: 'boolean (optional, default: true)',
      includeBestPractices: 'boolean (optional, default: true)',
      autoActivate: 'boolean (optional, default: false)',
    },
    response: {
      success: 'boolean',
      playbook: 'Playbook',
      extractionResult: 'PatternExtractionResult',
      metadata: {
        generatedAt: 'Date',
        processingTime: 'number (ms)',
        aiModel: 'string',
        confidence: 'number (0-100)',
      },
      error: 'string (if failed)',
    },
    examples: {
      request: {
        name: 'Discovery Call Playbook',
        category: 'discovery',
        conversationType: 'discovery_call',
        minPerformanceScore: 80,
        includePatterns: true,
        includeTalkTracks: true,
        autoActivate: false,
      },
    },
  });
}
