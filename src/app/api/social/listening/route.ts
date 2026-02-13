/**
 * API Route: Social Listening Mentions
 *
 * GET /api/social/listening          → List mentions (with filters)
 * PUT /api/social/listening          → Update mention status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { ListeningService } from '@/lib/social/listening-service';
import type { MentionSentiment, MentionStatus, SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const updateMentionSchema = z.object({
  mentionId: z.string().min(1),
  status: z.enum(['new', 'seen', 'replied', 'escalated', 'dismissed']),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/listening');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as SocialPlatform | null;
    const sentiment = searchParams.get('sentiment') as MentionSentiment | null;
    const status = searchParams.get('status') as MentionStatus | null;
    const limitParam = searchParams.get('limit');

    // If requesting breakdown stats
    if (searchParams.get('breakdown') === 'true') {
      const breakdown = await ListeningService.getSentimentBreakdown();
      return NextResponse.json({ success: true, breakdown });
    }

    const mentions = await ListeningService.listMentions({
      platform: platform ?? undefined,
      sentiment: sentiment ?? undefined,
      status: status ?? undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
    });

    return NextResponse.json({ success: true, mentions, total: mentions.length });
  } catch (error: unknown) {
    logger.error('Listening API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to list mentions' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/listening');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = updateMentionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const success = await ListeningService.updateMentionStatus(
      validation.data.mentionId,
      validation.data.status
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update mention' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Listening API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update mention' },
      { status: 500 }
    );
  }
}
