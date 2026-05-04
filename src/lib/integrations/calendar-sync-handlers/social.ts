/**
 * Calendar two-way sync — social post handler.
 *
 * For social posts (refId = `social-post-{postId}`):
 *   - Cancel = flip the post's status to 'cancelled' so the worker
 *     skips it. Delegates to the existing SocialPostService.cancelPost
 *     so business rules (only 'scheduled' posts can be cancelled) are
 *     honored.
 *   - Reschedule = update the post's `scheduledAt` field. Only
 *     'scheduled' posts can be rescheduled.
 *
 * The Google Calendar event was already moved/deleted by the operator —
 * we never re-upsert or re-delete it from this handler.
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import {
  SocialPostService,
  type ScheduledSocialPost,
} from '@/lib/social/social-post-service';
import { COLLECTIONS } from '@/lib/db/firestore-service';

const FILE = 'calendar-sync-handlers/social.ts';

// Mirror the path that SocialPostService uses internally. Kept private to
// this module so reschedule writes land in the same collection cancelPost
// reads from.
const SOCIAL_POSTS_COLLECTION_PATH = `${COLLECTIONS.ORGANIZATIONS}/platform/platform_social_posts`;

/**
 * Cancel a scheduled social post.
 */
export async function cancelSocialPost(
  postId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await SocialPostService.cancelPost(postId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-social] cancelSocialPost failed',
      err instanceof Error ? err : new Error(message),
      { postId, file: FILE },
    );
    return { success: false, error: message };
  }
}

/**
 * Reschedule a scheduled social post.
 */
export async function rescheduleSocialPost(
  postId: string,
  newStart: Date,
): Promise<{ success: boolean; error?: string }> {
  try {
    const post = await SocialPostService.getPost(postId);
    if (!post) {
      return { success: false, error: `Post ${postId} not found` };
    }
    if (post.status !== 'scheduled') {
      return {
        success: false,
        error: `Cannot reschedule post in status "${post.status}" — only scheduled posts can be moved`,
      };
    }

    // Defensive future-time guard. The cron worker will fire any post
    // whose scheduledAt <= now on the next tick, so a past time would
    // mean "fire immediately" — we reject so the operator's intent
    // (move the event to a NEW future time) is preserved.
    if (newStart.getTime() <= Date.now()) {
      return { success: false, error: 'New scheduledAt must be in the future' };
    }

    const updates: Partial<ScheduledSocialPost> & Record<string, unknown> = {
      scheduledAt: newStart,
      updatedAt: new Date(),
      rescheduledVia: 'google-calendar-sync',
    };

    await AdminFirestoreService.update(SOCIAL_POSTS_COLLECTION_PATH, postId, updates);

    logger.info('[calendar-sync-social] Rescheduled', {
      postId,
      newStart: newStart.toISOString(),
      file: FILE,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-social] rescheduleSocialPost failed',
      err instanceof Error ? err : new Error(message),
      { postId, file: FILE },
    );
    return { success: false, error: message };
  }
}
