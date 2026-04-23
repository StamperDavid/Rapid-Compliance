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
import type { PublishResult } from '@/types/video-pipeline';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { createPostingAgent } from '@/lib/social/autonomous-posting-agent';

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

    // Only instantiate the posting agent when we actually need to fire now.
    // For scheduled-mode the dedicated cron (/api/cron/scheduled-social-publisher)
    // will pick the post up when scheduledAt passes.
    const agent = scheduleMode === 'now' ? await createPostingAgent() : null;

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

      const now = new Date().toISOString();

      // Scheduled path — record goes in as 'scheduled', cron drains it later.
      if (scheduleMode === 'scheduled') {
        const postDoc = {
          id: postId,
          platform,
          content: postContent,
          status: 'scheduled' as const,
          mediaUrls: [videoUrl],
          hashtags: tags,
          scheduledAt: scheduledAt,
          scheduledFor: scheduledAt,
          publishedAt: null,
          sourceProjectId: projectId,
          sourceType: 'video-pipeline',
          createdAt: now,
          updatedAt: now,
          createdBy: authResult.user.uid,
        };

        try {
          await AdminFirestoreService.set(postsCollection, postId, postDoc);
          results.push({ platform, status: 'scheduled', postId });
        } catch (platformError) {
          logger.error(
            `Failed to record scheduled video post on ${platform}`,
            platformError instanceof Error ? platformError : undefined,
            { platform, projectId }
          );
          results.push({ platform, status: 'failed', error: `Failed to schedule post on ${platform}` });
        }
        continue;
      }

      // Immediate path — record the attempt, call the platform, write the outcome.
      const initialDoc = {
        id: postId,
        platform,
        content: postContent,
        status: 'publishing' as const,
        mediaUrls: [videoUrl],
        hashtags: tags,
        scheduledFor: null,
        publishedAt: null,
        sourceProjectId: projectId,
        sourceType: 'video-pipeline',
        createdAt: now,
        updatedAt: now,
        createdBy: authResult.user.uid,
      };

      try {
        await AdminFirestoreService.set(postsCollection, postId, initialDoc);
      } catch (writeError) {
        logger.error(
          `Failed to record video publish attempt on ${platform}`,
          writeError instanceof Error ? writeError : undefined,
          { platform, projectId }
        );
        results.push({ platform, status: 'failed', error: 'Could not record publish attempt' });
        continue;
      }

      if (!agent) {
        // Defensive: shouldn't happen given the branch above, but keeps the
        // compiler and runtime honest.
        results.push({ platform, status: 'failed', error: 'Posting agent unavailable' });
        continue;
      }

      const publishResult = await agent.publishNow(platform, postContent, { mediaUrl: videoUrl });
      const finalizedAt = new Date().toISOString();

      if (publishResult.success) {
        await AdminFirestoreService.update(postsCollection, postId, {
          status: 'published',
          platformPostId: publishResult.postId ?? null,
          publishedAt: finalizedAt,
          updatedAt: finalizedAt,
        });
        results.push({ platform, status: 'published', postId, publishedAt: finalizedAt });
        logger.info('Video published to platform', {
          platform,
          postId,
          projectId,
          platformPostId: publishResult.postId,
        });
      } else {
        await AdminFirestoreService.update(postsCollection, postId, {
          status: 'failed',
          error: publishResult.error ?? 'Unknown publish error',
          updatedAt: finalizedAt,
        });
        results.push({ platform, status: 'failed', error: publishResult.error ?? 'Unknown publish error' });
        logger.warn(`Video publish to ${platform} failed`, {
          platform,
          postId,
          error: publishResult.error,
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
