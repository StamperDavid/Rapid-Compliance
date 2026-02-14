/**
 * Social Media Schedule API Endpoint
 * POST to schedule posts across LinkedIn and Twitter
 * GET to retrieve scheduled posts
 * DELETE to cancel scheduled posts
 *
 * Rate Limit: 100 req/min per organization
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { createPostingAgent } from '@/lib/social/autonomous-posting-agent';
import type { SocialPlatform } from '@/types/social';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Request validation schemas
const schedulePostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(3000, 'Content exceeds maximum length (3000 characters)'),
  platforms: z.array(z.enum(['twitter', 'linkedin'])).min(1, 'At least one platform is required'),
  scheduledAt: z.string().datetime('Invalid datetime format'),
  mediaUrls: z.array(z.string().url()).optional(),
  hashtags: z.array(z.string()).optional(),
  accountId: z.string().optional(),
});

const getScheduledSchema = z.object({
  platform: z.enum(['twitter', 'linkedin']).optional(),
});

const cancelPostSchema = z.object({
  postId: z.string().min(1),
});

/**
 * POST /api/social/schedule
 * Schedule a social media post
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/schedule');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse request body
    const body: unknown = await request.json();

    // Validate input
    const validation = schedulePostSchema.safeParse(body);

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
    const scheduledAt = new Date(data.scheduledAt);

    // Validate scheduled time is in the future
    if (scheduledAt <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Scheduled time must be in the future',
        },
        { status: 400 }
      );
    }

    // Validate content length for Twitter
    if (data.platforms.includes('twitter') && data.content.length > 280) {
      return NextResponse.json(
        {
          success: false,
          error: 'Content exceeds Twitter character limit (280)',
          currentLength: data.content.length,
        },
        { status: 400 }
      );
    }

    // Validate content length for LinkedIn
    if (data.platforms.includes('linkedin') && data.content.length > 3000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Content exceeds LinkedIn character limit (3000)',
          currentLength: data.content.length,
        },
        { status: 400 }
      );
    }

    logger.info('Schedule API: Scheduling post', {
      platforms: data.platforms,
      scheduledAt: scheduledAt.toISOString(),
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Schedule the post
    const result = await agent.schedulePost(
      data.content,
      data.platforms as SocialPlatform[],
      scheduledAt,
      {
        mediaUrls: data.mediaUrls,
        hashtags: data.hashtags,
        createdBy: 'api',
        accountId: data.accountId,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to schedule post',
        },
        { status: 500 }
      );
    }

    logger.info('Schedule API: Post scheduled successfully', {
      postId: result.postId,
      scheduledAt: scheduledAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      postId: result.postId,
      scheduledAt: scheduledAt.toISOString(),
      platforms: data.platforms,
      message: `Post scheduled for ${scheduledAt.toLocaleString()}`,
    });
  } catch (error: unknown) {
    logger.error('Schedule API: Unexpected error', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/schedule' });

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
 * GET /api/social/schedule
 * Get scheduled posts for organization
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/schedule');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as SocialPlatform | null;

    // Validate query params
    const validation = getScheduledSchema.safeParse({ platform: platform ?? undefined });

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

    logger.info('Schedule API: Getting scheduled posts', {
      platform: data.platform,
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Get scheduled posts
    const scheduledPosts = await agent.getScheduledPosts(data.platform);

    return NextResponse.json({
      success: true,
      posts: scheduledPosts.map((post) => ({
        id: post.id,
        platform: post.platform,
        content: post.content,
        scheduledAt: post.scheduledAt,
        status: post.status,
        createdAt: post.createdAt,
      })),
      total: scheduledPosts.length,
    });
  } catch (error: unknown) {
    logger.error('Schedule API: Get scheduled failed', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/schedule' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get scheduled posts',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social/schedule
 * Cancel a scheduled post
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/schedule');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse request body
    const body: unknown = await request.json();

    // Validate input
    const validation = cancelPostSchema.safeParse(body);

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

    logger.info('Schedule API: Cancelling scheduled post', {
      postId: data.postId,
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Cancel the post
    const result = await agent.cancelPost(data.postId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to cancel post',
        },
        { status: 404 }
      );
    }

    logger.info('Schedule API: Post cancelled successfully', {
      postId: data.postId,
    });

    return NextResponse.json({
      success: true,
      message: 'Post cancelled successfully',
      postId: data.postId,
    });
  } catch (error: unknown) {
    logger.error('Schedule API: Cancel failed', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/schedule' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel post',
      },
      { status: 500 }
    );
  }
}
