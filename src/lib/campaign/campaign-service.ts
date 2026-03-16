/**
 * Campaign Service — Firestore CRUD for campaigns and deliverables
 *
 * Uses Admin SDK for server-side access (API routes, Jasper tools).
 *
 * Firestore paths:
 * - organizations/{PLATFORM_ID}/campaigns/{campaignId}
 * - organizations/{PLATFORM_ID}/campaigns/{campaignId}/deliverables/{deliverableId}
 *
 * @module lib/campaign/campaign-service
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  Campaign,
  CampaignStatus,
  CampaignDeliverable,
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
} from '@/types/campaign';
import type { SocialPlatform } from '@/types/social';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

function campaignsPath(): string {
  return getSubCollection('campaigns');
}

function deliverablesPath(campaignId: string): string {
  return `${campaignsPath()}/${campaignId}/deliverables`;
}

// ============================================================================
// CAMPAIGN CRUD
// ============================================================================

/**
 * Create a new campaign. Returns the generated campaign ID.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  if (!adminDb) {
    throw new Error('Firestore not available');
  }

  const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const campaign: Campaign = {
    id: campaignId,
    missionId: input.missionId,
    brief: input.brief,
    research: input.research,
    strategy: input.strategy,
    deliverables: [],
    status: input.status ?? 'producing',
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection(campaignsPath()).doc(campaignId).set(campaign);

  logger.info('[CampaignService] Campaign created', {
    campaignId,
    missionId: input.missionId,
  });

  return campaignId;
}

/**
 * Get a single campaign by ID.
 */
export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  if (!adminDb) {
    logger.warn('[CampaignService] Firestore not available');
    return null;
  }

  const doc = await adminDb.collection(campaignsPath()).doc(campaignId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as Campaign;
}

/**
 * Update a campaign's fields.
 */
export async function updateCampaign(
  campaignId: string,
  updates: UpdateCampaignInput
): Promise<void> {
  if (!adminDb) {
    throw new Error('Firestore not available');
  }

  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await adminDb.collection(campaignsPath()).doc(campaignId).update(updateData);

  logger.info('[CampaignService] Campaign updated', { campaignId, fields: Object.keys(updates) });
}

export interface ListCampaignsOptions {
  status?: CampaignStatus;
  limit?: number;
  startAfter?: string;
}

/**
 * List campaigns ordered newest-first with optional status filter.
 */
export async function listCampaigns(
  options: ListCampaignsOptions = {}
): Promise<{ campaigns: Campaign[]; hasMore: boolean }> {
  if (!adminDb) {
    return { campaigns: [], hasMore: false };
  }

  const { status, limit = 20, startAfter } = options;
  const fetchLimit = Math.min(limit, 50);

  let query = adminDb
    .collection(campaignsPath())
    .orderBy('createdAt', 'desc');

  if (status) {
    query = query.where('status', '==', status);
  }

  if (startAfter) {
    const afterDoc = await adminDb.collection(campaignsPath()).doc(startAfter).get();
    if (afterDoc.exists) {
      query = query.startAfter(afterDoc);
    }
  }

  query = query.limit(fetchLimit + 1);
  const snap = await query.get();

  const campaigns: Campaign[] = [];
  for (const doc of snap.docs.slice(0, fetchLimit)) {
    campaigns.push(doc.data() as Campaign);
  }

  return {
    campaigns,
    hasMore: snap.docs.length > fetchLimit,
  };
}

// ============================================================================
// DELIVERABLE CRUD
// ============================================================================

/**
 * Add a deliverable to a campaign. Returns the deliverable ID.
 * Also appends the deliverable ID to the parent campaign's deliverables array.
 */
export async function addDeliverable(
  campaignId: string,
  input: CreateDeliverableInput
): Promise<string> {
  if (!adminDb) {
    throw new Error('Firestore not available');
  }

  const deliverableId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const deliverable: CampaignDeliverable = {
    id: deliverableId,
    campaignId,
    missionId: input.missionId,
    type: input.type,
    title: input.title,
    status: input.status ?? 'pending_review',
    previewData: input.previewData,
    reviewLink: input.reviewLink,
    feedback: input.feedback,
    createdAt: now,
    updatedAt: now,
  };

  // Write deliverable doc
  await adminDb
    .collection(deliverablesPath(campaignId))
    .doc(deliverableId)
    .set(deliverable);

  // Append to parent campaign's deliverables array
  const { FieldValue } = await import('firebase-admin/firestore');
  await adminDb.collection(campaignsPath()).doc(campaignId).update({
    deliverables: FieldValue.arrayUnion(deliverableId),
    updatedAt: now,
  });

  logger.info('[CampaignService] Deliverable added', {
    campaignId,
    deliverableId,
    type: input.type,
  });

  return deliverableId;
}

/**
 * Get a single deliverable.
 */
export async function getDeliverable(
  campaignId: string,
  deliverableId: string
): Promise<CampaignDeliverable | null> {
  if (!adminDb) {
    return null;
  }

  const doc = await adminDb
    .collection(deliverablesPath(campaignId))
    .doc(deliverableId)
    .get();

  if (!doc.exists) {
    return null;
  }
  return doc.data() as CampaignDeliverable;
}

/**
 * Update a deliverable (status change, feedback, etc.).
 * When status is 'approved', sets approvedAt and approvedBy.
 */
export async function updateDeliverable(
  campaignId: string,
  deliverableId: string,
  updates: UpdateDeliverableInput,
  userId?: string
): Promise<void> {
  if (!adminDb) {
    throw new Error('Firestore not available');
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: now,
  };

  if (updates.status === 'approved') {
    updateData.approvedAt = now;
    if (userId) {
      updateData.approvedBy = userId;
    }
  }

  await adminDb
    .collection(deliverablesPath(campaignId))
    .doc(deliverableId)
    .update(updateData);

  logger.info('[CampaignService] Deliverable updated', {
    campaignId,
    deliverableId,
    status: updates.status,
  });

  // Auto-update campaign status when all deliverables are approved
  if (updates.status === 'approved') {
    await maybeUpdateCampaignStatus(campaignId);

    // Layer 3: Auto-publish on approval (fire-and-forget)
    void autoPublishDeliverable(campaignId, deliverableId).catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('[CampaignService] Auto-publish failed', { campaignId, deliverableId, error: errMsg });
    });
  }

  // Layer 4: Feedback loop — create revision mission on rejection with feedback
  if (
    (updates.status === 'rejected' || updates.status === 'revision_requested') &&
    updates.feedback
  ) {
    void createRevisionMission(campaignId, deliverableId, updates.feedback).catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('[CampaignService] Revision mission creation failed', { campaignId, deliverableId, error: errMsg });
    });
  }
}

/**
 * List deliverables for a campaign, ordered by creation time.
 */
export async function listDeliverables(
  campaignId: string
): Promise<CampaignDeliverable[]> {
  if (!adminDb) {
    return [];
  }

  const snap = await adminDb
    .collection(deliverablesPath(campaignId))
    .orderBy('createdAt', 'asc')
    .get();

  return snap.docs.map((doc) => doc.data() as CampaignDeliverable);
}

// ============================================================================
// CAMPAIGN STATUS AUTOMATION
// ============================================================================

/**
 * Check if all deliverables in a campaign are approved.
 * If so, upgrade campaign status to 'approved'.
 * If any are pending_review, set campaign to 'pending_review'.
 */
async function maybeUpdateCampaignStatus(campaignId: string): Promise<void> {
  if (!adminDb) { return; }

  try {
    const deliverables = await listDeliverables(campaignId);
    if (deliverables.length === 0) { return; }

    const allPublished = deliverables.every((d) => d.status === 'published');
    const allApproved = deliverables.every((d) => d.status === 'approved' || d.status === 'published');
    const anyPendingReview = deliverables.some((d) => d.status === 'pending_review');

    let newStatus: CampaignStatus | undefined;
    if (allPublished) {
      newStatus = 'published';
    } else if (allApproved) {
      newStatus = 'approved';
    } else if (anyPendingReview) {
      newStatus = 'pending_review';
    }

    if (newStatus) {
      await adminDb.collection(campaignsPath()).doc(campaignId).update({
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      logger.info('[CampaignService] Campaign status auto-updated', {
        campaignId,
        newStatus,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn('[CampaignService] maybeUpdateCampaignStatus failed', { campaignId, error: errMsg });
  }
}

// ============================================================================
// FIRE-AND-FORGET HELPER (for Jasper tool integration)
// ============================================================================

/**
 * Create a deliverable without throwing — for use in Jasper tool handlers
 * where deliverable creation is non-critical side-effect.
 */
export function trackDeliverableAsync(
  campaignId: string,
  input: CreateDeliverableInput
): void {
  void addDeliverable(campaignId, input).catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn('[CampaignService] Fire-and-forget deliverable failed', {
      campaignId,
      type: input.type,
      error: errMsg,
    });
  });
}

// ============================================================================
// LAYER 3: AUTO-PUBLISH PIPELINE
// ============================================================================

/**
 * Auto-publish a deliverable after approval. Runs fire-and-forget.
 * Routes to type-specific publish action, then updates status to 'published'.
 */
async function autoPublishDeliverable(
  campaignId: string,
  deliverableId: string
): Promise<void> {
  if (!adminDb) { return; }

  const deliverable = await getDeliverable(campaignId, deliverableId);
  if (!deliverable) {
    logger.warn('[AutoPublish] Deliverable not found', { campaignId, deliverableId });
    return;
  }

  let published = false;

  switch (deliverable.type) {
    case 'blog':
      published = await publishBlog(deliverable);
      break;
    case 'social_post':
      published = await publishSocialPost(deliverable);
      break;
    case 'video':
      published = await publishVideoToMediaLibrary(deliverable);
      break;
    case 'image':
      published = await publishImageToMediaLibrary(deliverable);
      break;
    default:
      // email, research, strategy — no auto-publish action, just mark published
      published = true;
      break;
  }

  if (published) {
    const now = new Date().toISOString();
    await adminDb
      .collection(deliverablesPath(campaignId))
      .doc(deliverableId)
      .update({
        status: 'published',
        publishedAt: now,
        updatedAt: now,
      });

    logger.info('[AutoPublish] Deliverable published', {
      campaignId,
      deliverableId,
      type: deliverable.type,
    });

    // Re-check campaign status — may promote to 'published'
    await maybeUpdateCampaignStatus(campaignId);
  }
}

/**
 * Blog: Update blog post status from 'draft' to 'published'.
 */
async function publishBlog(deliverable: CampaignDeliverable): Promise<boolean> {
  const draftId = deliverable.previewData.draftId as string | undefined;
  if (!draftId || !adminDb) { return false; }

  try {
    const blogPath = `${getSubCollection('website')}/config/blog-posts`;
    await adminDb.collection(blogPath).doc(draftId).update({
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    logger.info('[AutoPublish] Blog published', { draftId });
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[AutoPublish] Blog publish failed', err instanceof Error ? err : undefined, { draftId, error: errMsg });
    return false;
  }
}

/**
 * Social Post: Post via AutonomousPostingAgent if not already posted.
 * If the post was already sent (actionId exists), just marks as published.
 */
async function publishSocialPost(deliverable: CampaignDeliverable): Promise<boolean> {
  const platform = (deliverable.previewData.platform as string) || 'twitter';
  const content = deliverable.previewData.copy as string | undefined;

  // If actionId exists, the post was already sent by the tool handler
  if (deliverable.previewData.actionId) {
    logger.info('[AutoPublish] Social post already sent', {
      actionId: String(deliverable.previewData.actionId),
    });
    return true;
  }

  if (!content) {
    logger.warn('[AutoPublish] Social post has no content', { deliverableId: deliverable.id });
    return false;
  }

  // Validate platform
  const validPlatforms: SocialPlatform[] = ['twitter', 'linkedin'];
  const socialPlatform = platform as SocialPlatform;
  if (!validPlatforms.includes(socialPlatform)) {
    logger.warn('[AutoPublish] Invalid social platform', { platform });
    return false;
  }

  try {
    const { createPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
    const agent = await createPostingAgent({ platforms: [socialPlatform] });

    const mediaUrls = deliverable.previewData.imageUrl
      ? [deliverable.previewData.imageUrl as string]
      : undefined;

    const result = await agent.executeAction({
      type: 'POST',
      platform: socialPlatform,
      content,
      mediaUrls,
    });

    if (result.success) {
      logger.info('[AutoPublish] Social post published', {
        platform: socialPlatform,
        actionId: result.actionId,
        platformActionId: result.platformActionId,
      });
    } else {
      logger.warn('[AutoPublish] Social post failed', {
        platform: socialPlatform,
        error: result.error,
      });
    }

    return result.success;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[AutoPublish] Social post failed', err instanceof Error ? err : undefined, { error: errMsg });
    return false;
  }
}

/**
 * Video: Save rendered video to media library if a videoUrl is available.
 * If no videoUrl exists (not yet rendered), marks as published without media entry.
 */
async function publishVideoToMediaLibrary(deliverable: CampaignDeliverable): Promise<boolean> {
  if (!adminDb) { return false; }

  const videoUrl = deliverable.previewData.videoUrl as string | undefined;
  if (!videoUrl) {
    // Video may not be rendered yet — mark as published anyway
    logger.info('[AutoPublish] Video has no videoUrl — marking published without media entry', {
      projectId: String(deliverable.previewData.projectId ?? ''),
    });
    return true;
  }

  try {
    const mediaCollection = `organizations/${PLATFORM_ID}/media`;
    const now = new Date();
    await adminDb.collection(mediaCollection).doc().set({
      type: 'video',
      category: 'clip',
      name: deliverable.title,
      url: videoUrl,
      thumbnailUrl: (deliverable.previewData.thumbnailUrl as string) ?? null,
      mimeType: 'video/mp4',
      fileSize: 0,
      duration: null,
      metadata: {
        source: 'campaign',
        campaignId: deliverable.campaignId,
        deliverableId: deliverable.id,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    });

    logger.info('[AutoPublish] Video saved to media library', { deliverableId: deliverable.id });
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[AutoPublish] Video media save failed', err instanceof Error ? err : undefined, { error: errMsg });
    return false;
  }
}

/**
 * Image: Save to media library.
 */
async function publishImageToMediaLibrary(deliverable: CampaignDeliverable): Promise<boolean> {
  if (!adminDb) { return false; }

  const imageUrl = deliverable.previewData.imageUrl as string | undefined;
  if (!imageUrl) {
    logger.warn('[AutoPublish] Image has no imageUrl', { deliverableId: deliverable.id });
    return false;
  }

  try {
    const mediaCollection = `organizations/${PLATFORM_ID}/media`;
    const now = new Date();
    await adminDb.collection(mediaCollection).doc().set({
      type: 'image',
      category: 'photo',
      name: deliverable.title,
      url: imageUrl,
      thumbnailUrl: null,
      mimeType: 'image/png',
      fileSize: 0,
      metadata: {
        source: 'campaign',
        campaignId: deliverable.campaignId,
        deliverableId: deliverable.id,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    });

    logger.info('[AutoPublish] Image saved to media library', { deliverableId: deliverable.id });
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[AutoPublish] Image media save failed', err instanceof Error ? err : undefined, { error: errMsg });
    return false;
  }
}

// ============================================================================
// LAYER 4: FEEDBACK LOOP — REVISION MISSIONS
// ============================================================================

/**
 * Create a Jasper revision mission when a deliverable is rejected with feedback.
 * The mission includes the original content and client feedback so Jasper can
 * produce a revised version in the same campaign.
 */
async function createRevisionMission(
  campaignId: string,
  deliverableId: string,
  feedback: string
): Promise<void> {
  if (!adminDb) { return; }

  const deliverable = await getDeliverable(campaignId, deliverableId);
  if (!deliverable) {
    logger.warn('[FeedbackLoop] Deliverable not found', { campaignId, deliverableId });
    return;
  }

  try {
    const { createMission } = await import('@/lib/orchestrator/mission-persistence');
    const revisionMissionId = `revision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await createMission({
      missionId: revisionMissionId,
      conversationId: `campaign_${campaignId}_revision`,
      status: 'PENDING',
      title: `Revise ${deliverable.type}: ${deliverable.title}`,
      userPrompt: [
        `Revise the following ${deliverable.type} based on client feedback.`,
        '',
        '## Feedback',
        `"${feedback}"`,
        '',
        '## Original Content',
        JSON.stringify(deliverable.previewData, null, 2),
        '',
        '## Instructions',
        `campaignId: ${campaignId}`,
        `originalDeliverableId: ${deliverableId}`,
        `Use campaignId "${campaignId}" when creating the revised deliverable so it appears in the same campaign review.`,
      ].join('\n'),
      steps: [],
      createdAt: now,
      updatedAt: now,
    });

    // Link revision mission to the deliverable
    await adminDb
      .collection(deliverablesPath(campaignId))
      .doc(deliverableId)
      .update({
        revisionMissionId,
        updatedAt: now,
      });

    logger.info('[FeedbackLoop] Revision mission created', {
      campaignId,
      deliverableId,
      revisionMissionId,
      type: deliverable.type,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[FeedbackLoop] Failed to create revision mission', err instanceof Error ? err : undefined, {
      campaignId,
      deliverableId,
      error: errMsg,
    });
  }
}
