/**
 * Twitter Post API Endpoint
 * POST to create and publish a tweet
 *
 * Rate Limit: 50 req/min per organization
 * Requires: Twitter OAuth 2.0 configured for the organization
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Request validation schema
const postTweetSchema = z.object({
  text: z.string().min(1, 'Tweet text is required').max(280, 'Tweet exceeds 280 character limit'),
  mediaIds: z.array(z.string()).optional(),
  pollOptions: z.array(z.string().min(1).max(25)).min(2).max(4).optional(),
  pollDurationMinutes: z.number().min(5).max(10080).optional(), // 5 min to 7 days
  replyToTweetId: z.string().optional(),
  quoteTweetId: z.string().optional(),
});

/**
 * POST /api/social/twitter/post
 * Create and publish a tweet
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/twitter/post');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse request body
    const body: unknown = await request.json();

    // Validate input
    const validation = postTweetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    logger.info('Twitter Post API: Posting tweet', {
      textLength: data.text.length,
      hasMedia: !!(data.mediaIds && data.mediaIds.length > 0),
      hasPoll: !!(data.pollOptions && data.pollOptions.length > 0),
    });

    // Create Twitter service for organization
    const twitterService = await createTwitterService();

    if (!twitterService) {
      logger.warn('Twitter Post API: Service not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Twitter integration not configured for this organization',
          message: 'Please configure Twitter API credentials in your organization settings.',
        },
        { status: 400 }
      );
    }

    // Check if service is properly configured
    if (!twitterService.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Twitter API credentials incomplete',
          message: 'Please ensure both OAuth 2.0 access token and bearer token are configured.',
        },
        { status: 400 }
      );
    }

    // Post the tweet
    const result = await twitterService.postTweet({
      text: data.text,
      mediaIds: data.mediaIds,
      pollOptions: data.pollOptions,
      pollDurationMinutes: data.pollDurationMinutes,
      replyToTweetId: data.replyToTweetId,
      quoteTweetId: data.quoteTweetId,
    });

    if (!result.success) {
      logger.warn('Twitter Post API: Tweet failed', {
        error: result.error,
      });

      // Check for rate limit error
      if (result.rateLimitRemaining === 0 && result.rateLimitReset) {
        return NextResponse.json(
          {
            success: false,
            error: 'Twitter rate limit exceeded',
            rateLimitReset: result.rateLimitReset.toISOString(),
            retryAfter: Math.ceil((result.rateLimitReset.getTime() - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((result.rateLimitReset.getTime() - Date.now()) / 1000).toString(),
            },
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to post tweet',
        },
        { status: 500 }
      );
    }

    logger.info('Twitter Post API: Tweet posted successfully', {
      tweetId: result.tweetId,
    });

    return NextResponse.json({
      success: true,
      tweetId: result.tweetId,
      text: result.text,
      tweetUrl: `https://twitter.com/i/web/status/${result.tweetId}`,
      rateLimitRemaining: result.rateLimitRemaining,
    });
  } catch (error: unknown) {
    logger.error('Twitter Post API: Unexpected error', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/twitter/post' });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/twitter/post
 * Get Twitter integration status for organization
 */
export async function GET(_request: NextRequest) {
  try {
    // Check Twitter service status
    const twitterService = await createTwitterService();

    if (!twitterService) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'Twitter integration not configured',
      });
    }

    const isConfigured = twitterService.isConfigured();

    // Try to get user info if configured
    let userInfo = null;
    if (isConfigured) {
      const meResult = await twitterService.getMe();
      if (meResult.user) {
        userInfo = {
          id: meResult.user.id,
          name: meResult.user.name,
          username: meResult.user.username,
          profileImageUrl: meResult.user.profileImageUrl,
        };
      }
    }

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      user: userInfo,
    });
  } catch (error: unknown) {
    logger.error('Twitter Post API: Status check failed', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/twitter/post' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check Twitter status',
      },
      { status: 500 }
    );
  }
}
