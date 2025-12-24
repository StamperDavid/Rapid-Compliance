/**
 * Deal Service
 * Business logic layer for deal/opportunity management
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface Deal {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  company?: string;
  companyName?: string;
  contactId?: string;
  value: number;
  currency?: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  expectedCloseDate?: any;
  actualCloseDate?: any;
  ownerId?: string;
  source?: string;
  lostReason?: string;
  notes?: string;
  customFields?: Record<string, any>;
  createdAt: any;
  updatedAt?: any;
}

export interface DealFilters {
  stage?: string;
  ownerId?: string;
  minValue?: number;
  maxValue?: number;
  dateRange?: { start: Date; end: Date };
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
 * Get deals with pagination and filtering
 */
export async function getDeals(
  organizationId: string,
  workspaceId: string = 'default',
  filters?: DealFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Deal>> {
  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters?.stage) {
      constraints.push(where('stage', '==', filters.stage));
    }

    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    // Default ordering by value (high to low)
    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Deal>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
      constraints,
      options?.pageSize || 50,
      options?.lastDoc
    );

    logger.info('Deals retrieved', {
      organizationId,
      workspaceId,
      count: result.data.length,
      filters,
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to get deals', error, { organizationId, filters });
    throw new Error(`Failed to retrieve deals: ${error.message}`);
  }
}

/**
 * Get a single deal
 */
export async function getDeal(
  organizationId: string,
  dealId: string,
  workspaceId: string = 'default'
): Promise<Deal | null> {
  try {
    const deal = await FirestoreService.get<Deal>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
      dealId
    );

    if (!deal) {
      logger.warn('Deal not found', { organizationId, dealId });
      return null;
    }

    logger.info('Deal retrieved', { organizationId, dealId, value: deal.value });
    return deal;
  } catch (error: any) {
    logger.error('Failed to get deal', error, { organizationId, dealId });
    throw new Error(`Failed to retrieve deal: ${error.message}`);
  }
}

/**
 * Create a new deal
 */
export async function createDeal(
  organizationId: string,
  data: Omit<Deal, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>,
  workspaceId: string = 'default'
): Promise<Deal> {
  try {
    const dealId = `deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const deal: Deal = {
      ...data,
      id: dealId,
      organizationId,
      workspaceId,
      currency: data.currency || 'USD',
      stage: data.stage || 'prospecting',
      probability: data.probability || 10,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
      dealId,
      deal,
      false
    );

    logger.info('Deal created', {
      organizationId,
      dealId,
      value: deal.value,
      stage: deal.stage,
    });

    return deal;
  } catch (error: any) {
    logger.error('Failed to create deal', error, { organizationId, data });
    throw new Error(`Failed to create deal: ${error.message}`);
  }
}

/**
 * Update deal
 */
export async function updateDeal(
  organizationId: string,
  dealId: string,
  updates: Partial<Omit<Deal, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = 'default'
): Promise<Deal> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
      dealId,
      updatedData
    );

    logger.info('Deal updated', {
      organizationId,
      dealId,
      updatedFields: Object.keys(updates),
    });

    const deal = await getDeal(organizationId, dealId, workspaceId);
    if (!deal) {
      throw new Error('Deal not found after update');
    }

    return deal;
  } catch (error: any) {
    logger.error('Failed to update deal', error, { organizationId, dealId });
    throw new Error(`Failed to update deal: ${error.message}`);
  }
}

/**
 * Move deal to next stage
 */
export async function moveDealToStage(
  organizationId: string,
  dealId: string,
  newStage: Deal['stage'],
  workspaceId: string = 'default'
): Promise<Deal> {
  try {
    const updates: Partial<Deal> = {
      stage: newStage,
    };

    // Auto-set close date if won/lost
    if (newStage === 'closed_won' || newStage === 'closed_lost') {
      updates.actualCloseDate = new Date();
      updates.probability = newStage === 'closed_won' ? 100 : 0;
    }

    const deal = await updateDeal(organizationId, dealId, updates, workspaceId);

    logger.info('Deal moved to new stage', {
      organizationId,
      dealId,
      newStage,
      value: deal.value,
    });

    return deal;
  } catch (error: any) {
    logger.error('Failed to move deal', error, { organizationId, dealId, newStage });
    throw new Error(`Failed to move deal: ${error.message}`);
  }
}

/**
 * Delete deal
 */
export async function deleteDeal(
  organizationId: string,
  dealId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
      dealId
    );

    logger.info('Deal deleted', { organizationId, dealId });
  } catch (error: any) {
    logger.error('Failed to delete deal', error, { organizationId, dealId });
    throw new Error(`Failed to delete deal: ${error.message}`);
  }
}

/**
 * Get pipeline summary
 */
export async function getPipelineSummary(
  organizationId: string,
  workspaceId: string = 'default'
): Promise<Record<string, { count: number; totalValue: number }>> {
  try {
    const { data: allDeals } = await getDeals(organizationId, workspaceId);

    const summary: Record<string, { count: number; totalValue: number }> = {};
    const stages: Deal['stage'][] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

    stages.forEach(stage => {
      const stageDeals = allDeals.filter(d => d.stage === stage);
      summary[stage] = {
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
      };
    });

    logger.info('Pipeline summary generated', { organizationId, stageCount: Object.keys(summary).length });

    return summary;
  } catch (error: any) {
    logger.error('Failed to get pipeline summary', error, { organizationId });
    throw new Error(`Failed to get pipeline summary: ${error.message}`);
  }
}

