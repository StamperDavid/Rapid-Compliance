/**
 * Social Media Queue API Endpoint
 * POST to add posts to queue
 * GET to retrieve queue contents
 * PUT to reorder queue
 * DELETE to remove from queue
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
const addToQueueSchema = z.object({
  content: z.string().min(1, 'Content is required').max(3000, 'Content exceeds maximum length (3000 characters)'),
  platforms: z.array(z.enum(['twitter', 'linkedin'])).min(1, 'At least one platform is required'),
  mediaUrls: z.array(z.string().url()).optional(),
  hashtags: z.array(z.string()).optional(),
  preferredTimeSlot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  accountId: z.string().optional(),
});

const getQueueSchema = z.object({
  platform: z.enum(['twitter', 'linkedin']).optional(),
});

const processQueueSchema = z.object({
  maxPosts: z.number().min(1).max(10).optional(),
});

const removeFromQueueSchema = z.object({
  postId: z.string().min(1),
});

/**
 * POST /api/social/queue
 * Add post to queue or process queue
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/queue');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse request body
    const body: unknown = await request.json();

    // Check if this is a process queue request
    if (typeof body === 'object' && body !== null && 'action' in body && body.action === 'process') {
      return await processQueue(body);
    }

    // Otherwise, add to queue
    const validation = addToQueueSchema.safeParse(body);

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

    logger.info('Queue API: Adding to queue', {
      platforms: data.platforms,
      preferredTimeSlot: data.preferredTimeSlot,
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Add to queue
    const result = await agent.addToQueue(
      data.content,
      data.platforms as SocialPlatform[],
      {
        mediaUrls: data.mediaUrls,
        hashtags: data.hashtags,
        preferredTimeSlot: data.preferredTimeSlot,
        createdBy: 'api',
        accountId: data.accountId,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to add to queue',
        },
        { status: 500 }
      );
    }

    logger.info('Queue API: Post added to queue', {
      postId: result.postId,
    });

    return NextResponse.json({
      success: true,
      postId: result.postId,
      platforms: data.platforms,
      message: 'Post added to queue successfully',
    });
  } catch (error: unknown) {
    logger.error('Queue API: Unexpected error', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/queue' });

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
 * Process queue helper function
 */
async function processQueue(body: unknown) {
  const validation = processQueueSchema.safeParse(body);

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

  logger.info('Queue API: Processing queue', {
    maxPosts: data.maxPosts,
  });

  // Create posting agent
  const agent = await createPostingAgent();

  // Process queue
  const result = await agent.processQueue(data.maxPosts ?? 1);

  logger.info('Queue API: Queue processed', {
    successCount: result.successCount,
    failureCount: result.failureCount,
  });

  return NextResponse.json({
    success: true,
    processed: result.results.length,
    successCount: result.successCount,
    failureCount: result.failureCount,
    results: result.results.map((r) => ({
      platform: r.platform,
      success: r.success,
      postId: r.postId,
      platformPostId: r.platformPostId,
      error: r.error,
    })),
  });
}

/**
 * GET /api/social/queue
 * Get queue contents for organization
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/queue');
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
    const validation = getQueueSchema.safeParse({ platform: platform ?? undefined });

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

    logger.info('Queue API: Getting queue', {
      platform: data.platform,
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Get queue
    const queue = await agent.getQueue(data.platform);

    return NextResponse.json({
      success: true,
      queue: queue.map((post) => ({
        id: post.id,
        platform: post.platform,
        content: post.content,
        queuePosition: post.queuePosition,
        preferredTimeSlot: post.preferredTimeSlot,
        status: post.status,
        createdAt: post.createdAt,
      })),
      total: queue.length,
    });
  } catch (error: unknown) {
    logger.error('Queue API: Get queue failed', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/queue' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get queue',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/social/queue
 * Post immediately (bypass queue)
 */
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/queue');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse request body
    const body: unknown = await request.json();

    // Use same schema as add to queue
    const validation = addToQueueSchema.safeParse(body);

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

    logger.info('Queue API: Posting immediately', {
      platforms: data.platforms,
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Post immediately
    const result = await agent.postNow(
      data.content,
      data.platforms as SocialPlatform[],
      {
        mediaUrls: data.mediaUrls,
        hashtags: data.hashtags,
        createdBy: 'api',
      }
    );

    logger.info('Queue API: Immediate post complete', {
      successCount: result.successCount,
      failureCount: result.failureCount,
    });

    return NextResponse.json({
      success: result.successCount > 0,
      successCount: result.successCount,
      failureCount: result.failureCount,
      results: result.results.map((r) => ({
        platform: r.platform,
        success: r.success,
        postId: r.postId,
        platformPostId: r.platformPostId,
        publishedAt: r.publishedAt,
        error: r.error,
        rateLimited: r.rateLimited,
        nextRetryAt: r.nextRetryAt,
      })),
    });
  } catch (error: unknown) {
    logger.error('Queue API: Immediate post failed', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/queue' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to post',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social/queue
 * Remove post from queue
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/queue');
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
    const validation = removeFromQueueSchema.safeParse(body);

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

    logger.info('Queue API: Removing from queue', {
      postId: data.postId,
    });

    // Create posting agent
    const agent = await createPostingAgent();

    // Remove from queue
    const result = await agent.cancelPost(data.postId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Post not found in queue',
        },
        { status: 404 }
      );
    }

    logger.info('Queue API: Post removed from queue', {
      postId: data.postId,
    });

    return NextResponse.json({
      success: true,
      message: 'Post removed from queue',
      postId: data.postId,
    });
  } catch (error: unknown) {
    logger.error('Queue API: Remove from queue failed', error instanceof Error ? error : new Error(String(error)), { route: '/api/social/queue' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove from queue',
      },
      { status: 500 }
    );
  }
}
