/**
 * Nurture Service
 * Business logic layer for lead nurture campaign management
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { where, orderBy } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface NurtureStep {
  id: string;
  order: number;
  type: 'email' | 'sms' | 'task' | 'wait';
  delay: number; // seconds
  content?: {
    subject?: string;
    body?: string;
    template?: string;
  };
  conditions?: any[];
}

export interface NurtureCampaign {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  triggerType: 'manual' | 'lead_created' | 'lead_scored' | 'tag_added';
  triggerConfig?: Record<string, any>;
  steps: NurtureStep[];
  entryConditions?: any[];
  exitConditions?: any[];
  enrolled?: number;
  completed?: number;
  stats?: {
    enrolled: number;
    active: number;
    completed: number;
    dropped: number;
  };
  createdAt: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface NurtureFilters {
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
 * Get nurture campaigns with pagination
 */
export async function getNurtureCampaigns(
  organizationId: string,
  filters?: NurtureFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<NurtureCampaign>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<NurtureCampaign>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Nurture campaigns retrieved', {
      organizationId,
      count: result.data.length,
      filters,
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to get nurture campaigns', error, { organizationId, filters });
    throw new Error(`Failed to retrieve nurture campaigns: ${error.message}`);
  }
}

/**
 * Get a single nurture campaign
 */
export async function getNurtureCampaign(
  organizationId: string,
  campaignId: string
): Promise<NurtureCampaign | null> {
  try {
    const campaign = await FirestoreService.get<NurtureCampaign>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences`,
      campaignId
    );

    if (!campaign) {
      logger.warn('Nurture campaign not found', { organizationId, campaignId });
      return null;
    }

    logger.info('Nurture campaign retrieved', { organizationId, campaignId });
    return campaign;
  } catch (error: any) {
    logger.error('Failed to get nurture campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to retrieve nurture campaign: ${error.message}`);
  }
}

/**
 * Create nurture campaign
 */
export async function createNurtureCampaign(
  organizationId: string,
  data: Omit<NurtureCampaign, 'id' | 'organizationId' | 'createdAt' | 'stats'>,
  createdBy: string
): Promise<NurtureCampaign> {
  try {
    const campaignId = `nurture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const campaign: NurtureCampaign = {
      ...data,
      id: campaignId,
      organizationId,
      status: data.status || 'draft',
      steps: data.steps ?? [],
      stats: {
        enrolled: 0,
        active: 0,
        completed: 0,
        dropped: 0,
      },
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences`,
      campaignId,
      campaign,
      false
    );

    logger.info('Nurture campaign created', {
      organizationId,
      campaignId,
      name: campaign.name,
      stepCount: campaign.steps.length,
    });

    return campaign;
  } catch (error: any) {
    logger.error('Failed to create nurture campaign', error, { organizationId, data });
    throw new Error(`Failed to create nurture campaign: ${error.message}`);
  }
}

/**
 * Update nurture campaign
 */
export async function updateNurtureCampaign(
  organizationId: string,
  campaignId: string,
  updates: Partial<Omit<NurtureCampaign, 'id' | 'organizationId' | 'createdAt' | 'stats'>>
): Promise<NurtureCampaign> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences`,
      campaignId,
      updatedData
    );

    logger.info('Nurture campaign updated', {
      organizationId,
      campaignId,
      updatedFields: Object.keys(updates),
    });

    const campaign = await getNurtureCampaign(organizationId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found after update');
    }

    return campaign;
  } catch (error: any) {
    logger.error('Failed to update nurture campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to update nurture campaign: ${error.message}`);
  }
}

/**
 * Delete nurture campaign
 */
export async function deleteNurtureCampaign(
  organizationId: string,
  campaignId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences`,
      campaignId
    );

    logger.info('Nurture campaign deleted', { organizationId, campaignId });
  } catch (error: any) {
    logger.error('Failed to delete nurture campaign', error, { organizationId, campaignId });
    throw new Error(`Failed to delete nurture campaign: ${error.message}`);
  }
}

/**
 * Activate/pause campaign
 */
export async function setNurtureCampaignStatus(
  organizationId: string,
  campaignId: string,
  status: 'active' | 'paused' | 'archived'
): Promise<NurtureCampaign> {
  try {
    const campaign = await updateNurtureCampaign(organizationId, campaignId, { status });

    logger.info('Nurture campaign status changed', {
      organizationId,
      campaignId,
      newStatus: status,
    });

    return campaign;
  } catch (error: any) {
    logger.error('Failed to change nurture campaign status', error, { organizationId, campaignId, status });
    throw new Error(`Failed to change campaign status: ${error.message}`);
  }
}

/**
 * Enroll lead in nurture campaign
 */
export async function enrollLead(
  organizationId: string,
  campaignId: string,
  leadId: string
): Promise<{ success: boolean; enrollmentId: string }> {
  try {
    const campaign = await getNurtureCampaign(organizationId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'active') {
      throw new Error('Campaign must be active to enroll leads');
    }

    const enrollmentId = `enrollment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences/${campaignId}/enrollments`,
      enrollmentId,
      {
        id: enrollmentId,
        campaignId,
        leadId,
        organizationId,
        status: 'active',
        currentStep: 0,
        startedAt: now,
        createdAt: now,
      },
      false
    );

    logger.info('Lead enrolled in nurture campaign', {
      organizationId,
      campaignId,
      leadId,
      enrollmentId,
    });

    return { success: true, enrollmentId };
  } catch (error: any) {
    logger.error('Failed to enroll lead', error, { organizationId, campaignId, leadId });
    throw new Error(`Failed to enroll lead: ${error.message}`);
  }
}

/**
 * Get campaign stats
 */
export async function getCampaignStats(
  organizationId: string,
  campaignId: string
): Promise<NurtureCampaign['stats']> {
  try {
    const campaign = await getNurtureCampaign(organizationId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get enrollment counts
    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/nurtureSequences/${campaignId}/enrollments`,
      []
    );

    const stats = {
      enrolled: enrollments.length,
      active: enrollments.filter((e: any) => e.status === 'active').length,
      completed: enrollments.filter((e: any) => e.status === 'completed').length,
      dropped: enrollments.filter((e: any) => e.status === 'dropped').length,
    };

    logger.info('Campaign stats calculated', {
      organizationId,
      campaignId,
      ...stats,
    });

    return stats;
  } catch (error: any) {
    logger.error('Failed to get campaign stats', error, { organizationId, campaignId });
    throw new Error(`Failed to get campaign stats: ${error.message}`);
  }
}




