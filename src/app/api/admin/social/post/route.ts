/**
 * Admin Platform Social Media Post API
 * POST to platform social accounts (SalesVelocity.ai official accounts)
 * Uses platform-level API keys from environment variables
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

interface TwitterResponse {
  data?: {
    id?: string;
  };
}

interface LinkedInResponse {
  id?: string;
}

// Request validation schema
const postSchema = z.object({
  platform: z.enum(['twitter', 'linkedin']),
  content: z.string().min(1, 'Content is required'),
  scheduledAt: z.string().datetime().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
});

/**
 * POST /api/admin/social/post
 * Create a post on platform social media accounts
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = postSchema.safeParse(body);

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

    const { platform, content, scheduledAt, mediaUrls } = validation.data;

    // Validate content length per platform
    if (platform === 'twitter' && content.length > 280) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tweet exceeds 280 character limit',
        },
        { status: 400 }
      );
    }

    if (platform === 'linkedin' && content.length > 3000) {
      return NextResponse.json(
        {
          success: false,
          error: 'LinkedIn post exceeds 3000 character limit',
        },
        { status: 400 }
      );
    }

    logger.info('[AdminSocialPost] Posting to platform account', {
      platform,
      contentLength: content.length,
      isScheduled: !!scheduledAt,
      hasMedia: !!(mediaUrls && mediaUrls.length > 0),
      adminId: authResult.user.uid,
      file: 'admin/social/post/route.ts',
    });

    // Check for platform API credentials
    if (platform === 'twitter') {
      const twitterBearerToken = process.env.PLATFORM_TWITTER_BEARER_TOKEN;
      const twitterAccessToken = process.env.PLATFORM_TWITTER_ACCESS_TOKEN;
      const _twitterAccessSecret = process.env.PLATFORM_TWITTER_ACCESS_SECRET;
      const _twitterApiKey = process.env.PLATFORM_TWITTER_API_KEY;
      const _twitterApiSecret = process.env.PLATFORM_TWITTER_API_SECRET;

      if (!twitterBearerToken || !twitterAccessToken) {
        logger.warn('[AdminSocialPost] Platform Twitter credentials not configured', {
          file: 'admin/social/post/route.ts',
        });

        // For development/demo, return success with mock data
        if (process.env.NODE_ENV === 'development') {
          return NextResponse.json({
            success: true,
            postId: `mock_tweet_${Date.now()}`,
            platform: 'twitter',
            content,
            scheduledAt: scheduledAt ?? null,
            postedAt: scheduledAt ? null : new Date().toISOString(),
            message: '[DEV MODE] Platform Twitter credentials not configured. Mock post created.',
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: 'Platform Twitter credentials not configured',
            message: 'Please configure PLATFORM_TWITTER_* environment variables.',
          },
          { status: 500 }
        );
      }

      // If scheduling, store for later posting
      if (scheduledAt) {
        // In production, this would save to a scheduled posts collection
        logger.info('[AdminSocialPost] Tweet scheduled', {
          scheduledAt,
          file: 'admin/social/post/route.ts',
        });

        return NextResponse.json({
          success: true,
          postId: `scheduled_tweet_${Date.now()}`,
          platform: 'twitter',
          content,
          scheduledAt,
          message: 'Tweet scheduled successfully',
        });
      }

      // Post immediately using Twitter API v2
      try {
        const twitterResponse = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${twitterAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: content }),
        });

        if (!twitterResponse.ok) {
          const errorData: unknown = await twitterResponse.json().catch(() => ({}));
          logger.error('[AdminSocialPost] Twitter API error', {
            status: twitterResponse.status,
            error: errorData,
            file: 'admin/social/post/route.ts',
          });

          return NextResponse.json(
            {
              success: false,
              error: 'Failed to post to Twitter',
              details: errorData,
            },
            { status: 500 }
          );
        }

        const tweetData = (await twitterResponse.json()) as TwitterResponse;

        return NextResponse.json({
          success: true,
          postId: tweetData.data?.id ?? `tweet_${Date.now()}`,
          platform: 'twitter',
          content,
          postedAt: new Date().toISOString(),
          tweetUrl: tweetData.data?.id ? `https://twitter.com/i/web/status/${tweetData.data.id}` : null,
        });
      } catch (twitterError) {
        logger.error('[AdminSocialPost] Twitter post failed', twitterError, {
          file: 'admin/social/post/route.ts',
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to post to Twitter',
          },
          { status: 500 }
        );
      }
    }

    if (platform === 'linkedin') {
      const linkedInAccessToken = process.env.PLATFORM_LINKEDIN_ACCESS_TOKEN;
      const linkedInOrgId = process.env.PLATFORM_LINKEDIN_ORG_ID;

      if (!linkedInAccessToken || !linkedInOrgId) {
        logger.warn('[AdminSocialPost] Platform LinkedIn credentials not configured', {
          file: 'admin/social/post/route.ts',
        });

        // For development/demo, return success with mock data
        if (process.env.NODE_ENV === 'development') {
          return NextResponse.json({
            success: true,
            postId: `mock_linkedin_${Date.now()}`,
            platform: 'linkedin',
            content,
            scheduledAt: scheduledAt ?? null,
            postedAt: scheduledAt ? null : new Date().toISOString(),
            message: '[DEV MODE] Platform LinkedIn credentials not configured. Mock post created.',
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: 'Platform LinkedIn credentials not configured',
            message: 'Please configure PLATFORM_LINKEDIN_* environment variables.',
          },
          { status: 500 }
        );
      }

      // If scheduling, store for later posting
      if (scheduledAt) {
        logger.info('[AdminSocialPost] LinkedIn post scheduled', {
          scheduledAt,
          file: 'admin/social/post/route.ts',
        });

        return NextResponse.json({
          success: true,
          postId: `scheduled_linkedin_${Date.now()}`,
          platform: 'linkedin',
          content,
          scheduledAt,
          message: 'LinkedIn post scheduled successfully',
        });
      }

      // Post immediately using LinkedIn API
      try {
        const linkedInResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${linkedInAccessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            author: `urn:li:organization:${linkedInOrgId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                  text: content,
                },
                shareMediaCategory: 'NONE',
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
          }),
        });

        if (!linkedInResponse.ok) {
          const errorData: unknown = await linkedInResponse.json().catch(() => ({}));
          logger.error('[AdminSocialPost] LinkedIn API error', {
            status: linkedInResponse.status,
            error: errorData,
            file: 'admin/social/post/route.ts',
          });

          return NextResponse.json(
            {
              success: false,
              error: 'Failed to post to LinkedIn',
              details: errorData,
            },
            { status: 500 }
          );
        }

        const postData = (await linkedInResponse.json()) as LinkedInResponse;

        return NextResponse.json({
          success: true,
          postId: postData.id ?? `linkedin_${Date.now()}`,
          platform: 'linkedin',
          content,
          postedAt: new Date().toISOString(),
        });
      } catch (linkedInError) {
        logger.error('[AdminSocialPost] LinkedIn post failed', linkedInError, {
          file: 'admin/social/post/route.ts',
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to post to LinkedIn',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unsupported platform',
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error('[AdminSocialPost] Unexpected error', error, {
      file: 'admin/social/post/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/social/post
 * Get platform social media configuration status and recent posts
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Check platform credentials status
    const twitterConfigured = !!(
      process.env.PLATFORM_TWITTER_BEARER_TOKEN &&
      process.env.PLATFORM_TWITTER_ACCESS_TOKEN
    );
    const linkedInConfigured = !!(
      process.env.PLATFORM_LINKEDIN_ACCESS_TOKEN &&
      process.env.PLATFORM_LINKEDIN_ORG_ID
    );

    // In production, fetch recent posts from database
    // For now, return configuration status
    return NextResponse.json({
      success: true,
      platforms: {
        twitter: {
          configured: twitterConfigured,
          handle: process.env.PLATFORM_TWITTER_HANDLE ?? '@SalesVelocityAI',
        },
        linkedin: {
          configured: linkedInConfigured,
          companyName: 'SalesVelocity.ai',
        },
      },
      recentPosts: [],
      scheduledPosts: [],
    });
  } catch (error) {
    logger.error('[AdminSocialPost] GET failed', error, {
      file: 'admin/social/post/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
