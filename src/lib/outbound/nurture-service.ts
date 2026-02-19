/**
 * Nurture Service
 * Business logic layer for lead nurture campaign management
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getNurtureSequencesCollection } from '@/lib/firebase/collections';

interface Condition {
  type: string;
  value?: unknown;
}

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
  conditions?: Condition[];
}

export interface NurtureCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  triggerType: 'manual' | 'lead_created' | 'lead_scored' | 'tag_added';
  triggerConfig?: Record<string, unknown>;
  steps: NurtureStep[];
  entryConditions?: Condition[];
  exitConditions?: Condition[];
  enrolled?: number;
  completed?: number;
  stats?: {
    enrolled: number;
    active: number;
    completed: number;
    dropped: number;
  };
  createdAt: Date;
  updatedAt?: Date;
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
      getNurtureSequencesCollection(),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Nurture campaigns retrieved', {
      count: result.data.length,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get nurture campaigns', error instanceof Error ? error : new Error(String(error)), { filters: filters ? JSON.stringify(filters) : undefined });
    throw new Error(`Failed to retrieve nurture campaigns: ${errorMessage}`);
  }
}

/**
 * Get a single nurture campaign
 */
export async function getNurtureCampaign(
  campaignId: string
): Promise<NurtureCampaign | null> {
  try {
    const campaign = await FirestoreService.get<NurtureCampaign>(
      getNurtureSequencesCollection(),
      campaignId
    );

    if (!campaign) {
      logger.warn('Nurture campaign not found', { campaignId });
      return null;
    }

    logger.info('Nurture campaign retrieved', { campaignId });
    return campaign;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get nurture campaign', error instanceof Error ? error : new Error(String(error)), { campaignId });
    throw new Error(`Failed to retrieve nurture campaign: ${errorMessage}`);
  }
}

/**
 * Create nurture campaign
 */
export async function createNurtureCampaign(
  data: Omit<NurtureCampaign, 'id' | 'createdAt' | 'stats'>,
  createdBy: string
): Promise<NurtureCampaign> {
  try {
    const campaignId = `nurture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const campaign: NurtureCampaign = {
      ...data,
      id: campaignId,
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
      getNurtureSequencesCollection(),
      campaignId,
      campaign,
      false
    );

    logger.info('Nurture campaign created', {
      campaignId,
      name: campaign.name,
      stepCount: campaign.steps.length,
    });

    return campaign;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create nurture campaign', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to create nurture campaign: ${errorMessage}`);
  }
}

/**
 * Update nurture campaign
 */
export async function updateNurtureCampaign(
  campaignId: string,
  updates: Partial<Omit<NurtureCampaign, 'id' | 'createdAt' | 'stats'>>
): Promise<NurtureCampaign> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      getNurtureSequencesCollection(),
      campaignId,
      updatedData
    );

    logger.info('Nurture campaign updated', {
      campaignId,
      updatedFields: Object.keys(updates),
    });

    const campaign = await getNurtureCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found after update');
    }

    return campaign;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update nurture campaign', error instanceof Error ? error : new Error(String(error)), { campaignId });
    throw new Error(`Failed to update nurture campaign: ${errorMessage}`);
  }
}

/**
 * Delete nurture campaign
 */
export async function deleteNurtureCampaign(
  campaignId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      getNurtureSequencesCollection(),
      campaignId
    );

    logger.info('Nurture campaign deleted', { campaignId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete nurture campaign', error instanceof Error ? error : new Error(String(error)), { campaignId });
    throw new Error(`Failed to delete nurture campaign: ${errorMessage}`);
  }
}

/**
 * Activate/pause campaign
 */
export async function setNurtureCampaignStatus(
  campaignId: string,
  status: 'active' | 'paused' | 'archived'
): Promise<NurtureCampaign> {
  try {
    const campaign = await updateNurtureCampaign(campaignId, { status });

    logger.info('Nurture campaign status changed', {
      campaignId,
      newStatus: status,
    });

    return campaign;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to change nurture campaign status', error instanceof Error ? error : new Error(String(error)), { campaignId, status });
    throw new Error(`Failed to change campaign status: ${errorMessage}`);
  }
}

/**
 * Enroll lead in nurture campaign
 */
export async function enrollLead(
  campaignId: string,
  leadId: string
): Promise<{ success: boolean; enrollmentId: string }> {
  const { PLATFORM_ID } = await import('@/lib/constants/platform');
  try {
    const campaign = await getNurtureCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'active') {
      throw new Error('Campaign must be active to enroll leads');
    }

    const enrollmentId = `enrollment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/nurtureSequences/${campaignId}/enrollments`,
      enrollmentId,
      {
        id: enrollmentId,
        campaignId,
        leadId,
        status: 'active',
        currentStep: 0,
        startedAt: now,
        createdAt: now,
      },
      false
    );

    logger.info('Lead enrolled in nurture campaign', {
      campaignId,
      leadId,
      enrollmentId,
    });

    return { success: true, enrollmentId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to enroll lead', error instanceof Error ? error : new Error(String(error)), { campaignId, leadId });
    throw new Error(`Failed to enroll lead: ${errorMessage}`);
  }
}

/**
 * Get campaign stats
 */
export async function getCampaignStats(
  campaignId: string
): Promise<NurtureCampaign['stats']> {
  const { PLATFORM_ID } = await import('@/lib/constants/platform');
  try {
    const campaign = await getNurtureCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get enrollment counts
    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/nurtureSequences/${campaignId}/enrollments`,
      []
    );

    interface EnrollmentStatus {
      status: string;
    }

    const typedEnrollments = enrollments as EnrollmentStatus[];
    const stats = {
      enrolled: typedEnrollments.length,
      active: typedEnrollments.filter((e) => e.status === 'active').length,
      completed: typedEnrollments.filter((e) => e.status === 'completed').length,
      dropped: typedEnrollments.filter((e) => e.status === 'dropped').length,
    };

    logger.info('Campaign stats calculated', {
      campaignId,
      ...stats,
    });

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get campaign stats', error instanceof Error ? error : new Error(String(error)), { campaignId });
    throw new Error(`Failed to get campaign stats: ${errorMessage}`);
  }
}




