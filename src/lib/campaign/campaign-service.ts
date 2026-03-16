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
import type {
  Campaign,
  CampaignStatus,
  CampaignDeliverable,
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
} from '@/types/campaign';

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

    const allApproved = deliverables.every((d) => d.status === 'approved' || d.status === 'published');
    const anyPendingReview = deliverables.some((d) => d.status === 'pending_review');

    let newStatus: CampaignStatus | undefined;
    if (allApproved) {
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
