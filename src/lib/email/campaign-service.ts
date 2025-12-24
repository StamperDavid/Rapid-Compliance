/**
 * Campaign Service
 * Business logic layer for email campaign management
 * Wraps campaign-manager.ts with service layer pattern
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface EmailCampaign {
  id: string;
  organizationId: string;
  workspaceId?: string;
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
  scheduledFor?: any;
  sentAt?: any;
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
  createdAt: any;
  updatedAt?: any;
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
  organizationId: string,
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
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailCampaigns`,
      constraints,
      options?.pageSize || 50,
      options?.lastDoc
    );

    logger.info('Email campaigns retrieved', {
      organizationId,
      count: result.data.length,
      filters,
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to get campaigns', error, { organizationId, filters });
    throw new Error(`Failed to retrieve campaigns: ${error.message}`);
  }
}

/**
 * Get a single campaign
 */
export async function getCampaign(
  organizationId: string,
  campaignId: string
): Promise<EmailCampaign | null> {
  try {
    const campaign = await FirestoreService.get<EmailCampaign>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailCampaigns`,
      campaignId
    );

    if (!campaign) {
      logger.warn('Campaign not found', { organizationId, campaignId });
      return null;
    }

    logger.info('Campaign retrieved', { organizationId, campaignId });
    return campaign;
  } catch (error: any) {
    logger.error('Failed to get campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to retrieve campaign: ${error.message}`);
  }
}

/**
 * Create campaign
 */
export async function createCampaign(
  organizationId: string,
  data: Omit<EmailCampaign, 'id' | 'organizationId' | 'createdAt' | 'stats'>,
  createdBy: string
): Promise<EmailCampaign> {
  try {
    const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const campaign: EmailCampaign = {
      ...data,
      id: campaignId,
      organizationId,
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
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailCampaigns`,
      campaignId,
      campaign,
      false
    );

    logger.info('Campaign created', {
      organizationId,
      campaignId,
      name: campaign.name,
    });

    return campaign;
  } catch (error: any) {
    logger.error('Failed to create campaign', error, { organizationId, data });
    throw new Error(`Failed to create campaign: ${error.message}`);
  }
}

/**
 * Update campaign
 */
export async function updateCampaign(
  organizationId: string,
  campaignId: string,
  updates: Partial<Omit<EmailCampaign, 'id' | 'organizationId' | 'createdAt' | 'stats'>>
): Promise<EmailCampaign> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailCampaigns`,
      campaignId,
      updatedData
    );

    logger.info('Campaign updated', {
      organizationId,
      campaignId,
      updatedFields: Object.keys(updates),
    });

    const campaign = await getCampaign(organizationId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found after update');
    }

    return campaign;
  } catch (error: any) {
    logger.error('Failed to update campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to update campaign: ${error.message}`);
  }
}

/**
 * Delete campaign
 */
export async function deleteCampaign(
  organizationId: string,
  campaignId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailCampaigns`,
      campaignId
    );

    logger.info('Campaign deleted', { organizationId, campaignId });
  } catch (error: any) {
    logger.error('Failed to delete campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to delete campaign: ${error.message}`);
  }
}

/**
 * Send campaign
 */
export async function sendCampaign(
  organizationId: string,
  campaignId: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    const campaign = await getCampaign(organizationId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error(`Cannot send campaign with status: ${campaign.status}`);
    }

    // Use existing campaign manager
    const { sendCampaign: executeSend } = await import('./campaign-manager');
    
    const result = await executeSend(campaignId, organizationId);

    logger.info('Campaign sent', {
      organizationId,
      campaignId,
      success: result.success,
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to send campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to send campaign: ${error.message}`);
  }
}

