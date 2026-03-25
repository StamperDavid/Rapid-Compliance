/**
 * API Route: Video Publishing
 *
 * POST /api/video/publish — Publish or schedule a video to social platforms.
 * Creates social posts for each selected platform with the video attached.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSocialPostsCollection } from '@/lib/firebase/collections';
import type { PublishResult, PublishPlatform } from '@/types/video-pipeline';
import { SOCIAL_PLATFORMS } from '@/types/social';

export const dynamic = 'force-dynamic';

const publishSchema = z.object({
  projectId: z.string().min(1),
  videoUrl: z.string().url('Invalid video URL'),
  platforms: z
    .array(z.enum(SOCIAL_PLATFORMS))
    .min(1, 'Select at least one platform'),
  title: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  scheduleMode: z.enum(['now', 'scheduled']).optional().default('now'),
  scheduledAt: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = publishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const {
      projectId,
      videoUrl,
      platforms,
      title,
      description,
      tags,
      scheduleMode,
      scheduledAt,
    } = parsed.data;

    // Validate scheduled time is in the future
    if (scheduleMode === 'scheduled') {
      if (!scheduledAt) {
        return NextResponse.json(
          { success: false, error: 'Scheduled time is required when scheduling' },
          { status: 400 }
        );
      }
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'Scheduled time must be in the future' },
          { status: 400 }
        );
      }
    }

    const postsCollection = getSocialPostsCollection();
    const results: PublishResult[] = [];

    // Create a social post for each selected platform
    for (const platform of platforms) {
      const postId = `pub-${Date.now()}-${platform}-${Math.random().toString(36).slice(2, 8)}`;
      const hashtags = tags.map((t) => `#${t}`);
      const postContent = [
        title,
        '',
        description,
        '',
        hashtags.join(' '),
      ].filter(Boolean).join('\n').trim();

      const postStatus = scheduleMode === 'scheduled' ? 'scheduled' : 'published';
      const now = new Date().toISOString();

      const postDoc = {
        id: postId,
        platform,
        content: postContent,
        status: postStatus,
        mediaUrls: [videoUrl],
        hashtags: tags,
        scheduledFor: scheduleMode === 'scheduled' ? scheduledAt : null,
        publishedAt: scheduleMode === 'now' ? now : null,
        sourceProjectId: projectId,
        sourceType: 'video-pipeline',
        createdAt: now,
        updatedAt: now,
        createdBy: authResult.user.uid,
      };

      try {
        await AdminFirestoreService.set(postsCollection, postId, postDoc);

        results.push({
          platform: platform as PublishPlatform,
          status: postStatus === 'scheduled' ? 'scheduled' : 'published',
          postId,
          publishedAt: postStatus === 'published' ? now : undefined,
        });

        logger.info('Video published to platform', {
          platform,
          postId,
          projectId,
          scheduleMode,
        });
      } catch (platformError) {
        logger.error(
          `Failed to publish to ${platform}`,
          platformError instanceof Error ? platformError : undefined,
          { platform, projectId }
        );
        results.push({
          platform: platform as PublishPlatform,
          status: 'failed',
          error: `Failed to create post on ${platform}`,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    logger.error('Video publish failed', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to publish video' },
      { status: 500 }
    );
  }
}
