/**
 * Campaign Service
 * Business logic layer for email campaign management
 * Wraps campaign-manager.ts with service layer pattern
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: string;
  segmentId?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  scheduledFor?: Date | string;
  sentAt?: Date | string;
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    openRate: number;
    clickRate: number;
  };
  createdAt: Date | string;
  updatedAt?: Date | string;
  createdBy?: string;
}

export interface CampaignFilters {
  status?: string;
  createdBy?: string;
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Get campaigns with pagination
 */
export async function getCampaigns(
  filters?: CampaignFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<EmailCampaign>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<EmailCampaign>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emailCampaigns`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Email campaigns retrieved', {
      count: result.data.length,
      status: filters?.status,
      createdBy: filters?.createdBy,
    });

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get campaigns', err, { status: filters?.status, createdBy: filters?.createdBy });
    throw new Error(`Failed to retrieve campaigns: ${err.message}`);
  }
}

/**
 * Get a single campaign
 */
export async function getCampaign(
  campaignId: string
): Promise<EmailCampaign | null> {
  try {
    const campaign = await FirestoreService.get<EmailCampaign>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emailCampaigns`,
      campaignId
    );

    if (!campaign) {
      logger.warn('Campaign not found', { campaignId });
      return null;
    }

    logger.info('Campaign retrieved', { campaignId });
    return campaign;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get campaign', err, { campaignId });
    throw new Error(`Failed to retrieve campaign: ${err.message}`);
  }
}

/**
 * Create campaign
 */
export async function createCampaign(
  data: Omit<EmailCampaign, 'id' | 'createdAt' | 'stats'>,
  createdBy: string
): Promise<EmailCampaign> {
  try {
    const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const campaign: EmailCampaign = {
      ...data,
      id: campaignId,
      status: data.status || 'draft',
      stats: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        openRate: 0,
        clickRate: 0,
      },
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emailCampaigns`,
      campaignId,
      campaign,
      false
    );

    logger.info('Campaign created', {
      campaignId,
      name: campaign.name,
    });

    return campaign;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create campaign', err, { campaignName: data.name });
    throw new Error(`Failed to create campaign: ${err.message}`);
  }
}

/**
 * Update campaign
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<Omit<EmailCampaign, 'id' | 'createdAt' | 'stats'>>
): Promise<EmailCampaign> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emailCampaigns`,
      campaignId,
      updatedData
    );

    logger.info('Campaign updated', {
      campaignId,
      updatedFields: Object.keys(updates),
    });

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found after update');
    }

    return campaign;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to update campaign', err, { campaignId });
    throw new Error(`Failed to update campaign: ${err.message}`);
  }
}

/**
 * Delete campaign
 */
export async function deleteCampaign(
  campaignId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emailCampaigns`,
      campaignId
    );

    logger.info('Campaign deleted', { campaignId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to delete campaign', err, { campaignId });
    throw new Error(`Failed to delete campaign: ${err.message}`);
  }
}

/**
 * Send campaign
 * Returns the number of emails sent
 */
export async function sendCampaign(
  campaignId: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error(`Cannot send campaign with status: ${campaign.status}`);
    }

    // Use existing campaign manager
    const { sendCampaign: executeSend } = await import('./campaign-manager');

    const result = await executeSend(campaignId);

    if (!result.success) {
      return { success: false, sent: 0, error: result.error };
    }

    // Get updated campaign to retrieve sent count
    const updatedCampaign = await getCampaign(campaignId);
    const sentCount = updatedCampaign?.stats?.sent ?? 0;

    logger.info('Campaign sent', {
      campaignId,
      sent: sentCount,
    });

    return { success: true, sent: sentCount };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to send campaign', err, { campaignId });
    throw new Error(`Failed to send campaign: ${err.message}`);
  }
}

