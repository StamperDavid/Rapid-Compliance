/**
 * Conversation Analysis API Endpoint
 * 
 * POST /api/conversation/analyze
 * 
 * Analyzes a conversation or transcript and returns comprehensive insights.
 * Rate limited to prevent abuse and control AI costs.
 * 
 * FEATURES:
 * - Rate limiting (10 requests per minute per organization)
 * - Input validation with Zod
 * - Error handling with proper status codes
 * - Response caching (1 hour TTL)
 * - Signal Bus integration
 * 
 * @module api/conversation/analyze
 */

import { type NextRequest, NextResponse } from 'next/server';
import { analyzeConversation, analyzeTranscript } from '@/lib/conversation/conversation-engine';
import {
  validateAnalyzeConversationRequest,
  validateAnalyzeTranscriptRequest,
} from '@/lib/conversation/validation';
import { logger } from '@/lib/logger/logger';
import { ZodError } from 'zod';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

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
  data: unknown;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cached response
 */
function getCachedResponse(key: string): unknown {
  const entry = responseCache.get(key);
  if (!entry) {return null;}

  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set cached response
 */
function setCachedResponse(key: string, data: unknown): void {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

/** Cache key request interface */
interface CacheKeyRequest {
  conversationId?: string;
  transcript?: string;
}

/**
 * Generate cache key
 */
function getCacheKey(request: CacheKeyRequest): string {
  if (request.conversationId) {
    return `conv_${PLATFORM_ID}_${request.conversationId}`;
  }

  // For transcript analysis, hash the transcript (simplified)
  const transcriptHash = request.transcript
    ? request.transcript.substring(0, 100)
    : 'unknown';
  return `trans_${PLATFORM_ID}_${transcriptHash}`;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/conversation/analyze
 * 
 * Analyze a conversation or transcript
 * 
 * REQUEST BODY:
 * Option 1 - Analyze existing conversation:
 * {
 *   conversationId: string,
 *   includeCoaching?: boolean,
 *   includeFollowUps?: boolean,
 *   customContext?: string,
 *   forceRefresh?: boolean
 * }
 *
 * Option 2 - Analyze raw transcript:
 * {
 *   transcript: string,
 *   conversationType: string,
 *   participants: Participant[],
 *   repId: string,
 *   duration: number,
 *   includeCoaching?: boolean,
 *   includeFollowUps?: boolean,
 *   customContext?: string
 * }
 * 
 * RESPONSE:
 * {
 *   success: true,
 *   data: ConversationAnalysis
 * }
 * 
 * ERRORS:
 * - 400: Invalid request body
 * - 429: Rate limit exceeded
 * - 500: Analysis failed
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse request body
    const body = await request.json() as Record<string, unknown>;

    // Determine request type and validate
    type ConversationRequest = ReturnType<typeof validateAnalyzeConversationRequest>;
    type TranscriptRequest = ReturnType<typeof validateAnalyzeTranscriptRequest>;
    let validatedConversationRequest: ConversationRequest | null = null;
    let validatedTranscriptRequest: TranscriptRequest | null = null;
    let isTranscriptAnalysis = false;

    try {
      if (body.conversationId) {
        // Existing conversation analysis
        validatedConversationRequest = validateAnalyzeConversationRequest(body);
        isTranscriptAnalysis = false;
      } else if (body.transcript) {
        // Raw transcript analysis
        validatedTranscriptRequest = validateAnalyzeTranscriptRequest(body);
        isTranscriptAnalysis = true;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Request must include either conversationId or transcript',
          },
          { status: 400 }
        );
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request body',
            details: error.errors.map(err => ({
              path: err.path.map(String).join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);

      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetIn} seconds.`,
          resetIn,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': resetIn.toString(),
          },
        }
      );
    }

    // Check cache (unless forceRefresh) - only for conversation analysis
    if (!isTranscriptAnalysis && validatedConversationRequest) {
      const forceRefresh = validatedConversationRequest.forceRefresh;
      if (!forceRefresh) {
        const cacheKey = getCacheKey({
          conversationId: validatedConversationRequest.conversationId,
        });
        const cachedData = getCachedResponse(cacheKey);

        if (cachedData) {
          logger.info('Returning cached conversation analysis', {
            conversationId: validatedConversationRequest.conversationId,
          });

          return NextResponse.json(
            {
              success: true,
              data: cachedData,
              cached: true,
            },
            {
              headers: {
                'X-Cache': 'HIT',
                'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
                'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                'X-RateLimit-Reset': rateLimit.resetAt.toString(),
              },
            }
          );
        }
      }
    }

    // Perform analysis
    logger.info('Starting conversation analysis', {
      isTranscriptAnalysis,
      conversationId: validatedConversationRequest?.conversationId,
    });

    let analysis;

    if (isTranscriptAnalysis && validatedTranscriptRequest) {
      analysis = await analyzeTranscript(validatedTranscriptRequest);
    } else if (validatedConversationRequest) {
      analysis = await analyzeConversation(validatedConversationRequest);
    } else {
      throw new Error('No validated request available');
    }

    // Cache the response for conversation analysis
    if (!isTranscriptAnalysis && validatedConversationRequest) {
      const cacheKey = getCacheKey({
        conversationId: validatedConversationRequest.conversationId,
      });
      setCachedResponse(cacheKey, analysis);
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Conversation analysis complete', {
      conversationId: analysis.conversationId,
      overallScore: analysis.scores.overall,
      duration,
    });
    
    // Return response
    return NextResponse.json(
      {
        success: true,
        data: analysis,
        cached: false,
      },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Processing-Time': duration.toString(),
          'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    );
    
  } catch (error) {
    logger.error('Conversation analysis API error', error instanceof Error ? error : new Error(String(error)), {
      path: '/api/conversation/analyze',
      method: 'POST',
    });

    // Don't expose internal errors to client
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Analysis failed',
        message: process.env.NODE_ENV === 'development'
          ? errorMessage
          : 'An error occurred while analyzing the conversation',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversation/analyze
 *
 * Get API information
 */
export function GET() {
  return NextResponse.json({
    name: 'Conversation Analysis API',
    version: '1.0.0',
    description: 'Analyze sales conversations with AI-powered insights',
    endpoints: {
      POST: {
        path: '/api/conversation/analyze',
        description: 'Analyze a conversation or transcript',
        rateLimit: `${MAX_REQUESTS_PER_WINDOW} requests per minute`,
        caching: '1 hour TTL',
      },
    },
    capabilities: [
      'Sentiment analysis',
      'Talk ratio calculation',
      'Topic extraction',
      'Objection detection',
      'Competitor tracking',
      'Coaching insights',
      'Follow-up recommendations',
      'Quality indicators',
      'Red flag detection',
      'Positive signal identification',
    ],
  });
}
