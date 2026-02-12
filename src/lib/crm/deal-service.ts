/**
 * Deal Service
 * Business logic layer for deal/opportunity management
 */

import { FirestoreService } from '@/lib/db/firestore-service';

import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getClientSignalCoordinator } from '@/lib/orchestration/coordinator-factory-client';
import { getSubCollection } from '@/lib/firebase/collections';

export interface Deal {
  id: string;
  workspaceId: string;
  name: string;
  company?: string;
  companyName?: string;
  contactId?: string;
  value: number;
  currency?: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  expectedCloseDate?: Date | { toDate: () => Date };
  actualCloseDate?: Date | { toDate: () => Date };
  ownerId?: string;
  source?: string;
  lostReason?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
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
      `${getSubCollection('workspaces')}/${workspaceId}/entities/deals/records`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Deals retrieved', {
            workspaceId,
      count: result.data.length,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get deals', error instanceof Error ? error : new Error(String(error)), { workspaceId, filters: filters ? JSON.stringify(filters) : undefined });
    throw new Error(`Failed to retrieve deals: ${errorMessage}`);
  }
}

/**
 * Get a single deal
 */
export async function getDeal(
  dealId: string,
  workspaceId: string = 'default'
): Promise<Deal | null> {
  try {
    const deal = await FirestoreService.get<Deal>(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/deals/records`,
      dealId
    );

    if (!deal) {
      logger.warn('Deal not found', { workspaceId, dealId });
      return null;
    }

    logger.info('Deal retrieved', { workspaceId, dealId, value: deal.value });
    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get deal', error instanceof Error ? error : new Error(String(error)), { workspaceId, dealId });
    throw new Error(`Failed to retrieve deal: ${errorMessage}`);
  }
}

/**
 * Create a new deal
 */
export async function createDeal(
  data: Omit<Deal, 'id' | 'workspaceId' | 'createdAt'>,
  workspaceId: string = 'default'
): Promise<Deal> {
  try {
    const dealId = `deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const deal: Deal = {
      ...data,
      id: dealId,
            workspaceId,
      currency: data.currency ?? 'USD',
      stage: data.stage || 'prospecting',
      probability: data.probability || 10,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/deals/records`,
      dealId,
      deal,
      false
    );

    logger.info('Deal created', {
            dealId,
      value: deal.value,
      stage: deal.stage,
    });

    // Emit deal.created signal
    await emitDealSignal({
      type: 'deal.created',
      workspaceId,
      deal,
    });

    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create deal', error instanceof Error ? error : new Error(String(error)), { workspaceId, dealName: data.name, value: data.value });
    throw new Error(`Failed to create deal: ${errorMessage}`);
  }
}

/**
 * Update deal
 */
export async function updateDeal(
  dealId: string,
  updates: Partial<Omit<Deal, 'id' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = 'default'
): Promise<Deal> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/deals/records`,
      dealId,
      updatedData
    );

    logger.info('Deal updated', {
            dealId,
      updatedFields: Object.keys(updates),
    });

    const deal = await getDeal(dealId, workspaceId);
    if (!deal) {
      throw new Error('Deal not found after update');
    }

    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update deal', error instanceof Error ? error : new Error(String(error)), { workspaceId, dealId });
    throw new Error(`Failed to update deal: ${errorMessage}`);
  }
}

/**
 * Move deal to next stage
 */
export async function moveDealToStage(
  dealId: string,
  newStage: Deal['stage'],
  workspaceId: string = 'default'
): Promise<Deal> {
  try {
    // Get current deal for event firing
    const currentDeal = await getDeal(dealId, workspaceId);
    if (!currentDeal) {
      throw new Error('Deal not found');
    }

    const oldStage = currentDeal.stage;

    const updates: Partial<Deal> = {
      stage: newStage,
    };

    // Auto-set close date if won/lost
    if (newStage === 'closed_won' || newStage === 'closed_lost') {
      updates.actualCloseDate = new Date();
      updates.probability = newStage === 'closed_won' ? 100 : 0;
    }

    const deal = await updateDeal(dealId, updates, workspaceId);

    // Fire CRM event
    try {
      const { fireDealStageChanged } = await import('./event-triggers');
      await fireDealStageChanged(workspaceId, dealId, oldStage, newStage, deal as unknown as Record<string, unknown>);
    } catch (triggerError) {
      logger.warn('Failed to fire deal stage changed event', { error: triggerError instanceof Error ? triggerError.message : String(triggerError) });
    }

    logger.info('Deal moved to new stage', {
            dealId,
      oldStage,
      newStage,
      value: deal.value,
    });

    // Emit signals based on stage change
    await emitDealSignal({
      type: 'deal.stage.changed',
      workspaceId,
      deal,
      metadata: { oldStage, newStage },
    });

    // Emit specific win/loss signals
    if (newStage === 'closed_won') {
      await emitDealSignal({
        type: 'deal.won',
        workspaceId,
        deal,
        metadata: { oldStage },
      });
    } else if (newStage === 'closed_lost') {
      await emitDealSignal({
        type: 'deal.lost',
        workspaceId,
        deal,
        metadata: { oldStage, lostReason: deal.lostReason },
      });
    }

    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to move deal', error instanceof Error ? error : new Error(String(error)), { workspaceId, dealId, newStage });
    throw new Error(`Failed to move deal: ${errorMessage}`);
  }
}

/**
 * Delete deal
 */
export async function deleteDeal(
  dealId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    // Check for linked activities before deleting (referential integrity)
    const linkedActivities = await FirestoreService.getAll(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/activities/records`,
      [where('dealId', '==', dealId)]
    );
    if (linkedActivities.length > 0) {
      throw new Error(
        `Cannot delete deal: ${linkedActivities.length} activity record(s) are linked to this deal. Remove them first.`
      );
    }

    await FirestoreService.delete(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/deals/records`,
      dealId
    );

    logger.info('Deal deleted', { workspaceId, dealId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete deal', error instanceof Error ? error : new Error(String(error)), { workspaceId, dealId });
    throw new Error(`Failed to delete deal: ${errorMessage}`);
  }
}

/**
 * Get pipeline summary
 */
export async function getPipelineSummary(
  workspaceId: string = 'default'
): Promise<Record<string, { count: number; totalValue: number }>> {
  try {
    const { data: allDeals } = await getDeals(workspaceId);

    const summary: Record<string, { count: number; totalValue: number }> = {};
    const stages: Deal['stage'][] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

    stages.forEach(stage => {
      const stageDeals = allDeals.filter(d => d.stage === stage);
      summary[stage] = {
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
      };
    });

    logger.info('Pipeline summary generated', { workspaceId, stageCount: Object.keys(summary).length });

    return summary;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get pipeline summary', error instanceof Error ? error : new Error(String(error)), { workspaceId });
    throw new Error(`Failed to get pipeline summary: ${errorMessage}`);
  }
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit CRM deal signals to the Neural Net
 */
async function emitDealSignal(params: {
  type: 'deal.created' | 'deal.stage.changed' | 'deal.won' | 'deal.lost';
  workspaceId: string;
  deal: Deal;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { type, workspaceId, deal, metadata = {} } = params;
    const coordinator = getClientSignalCoordinator();

    // Determine signal priority based on deal value and type
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (type === 'deal.won' || type === 'deal.lost') {
      priority = 'High';
    } else if (deal.value > 50000) {
      priority = 'High';
    } else if (deal.value > 10000) {
      priority = 'Medium';
    } else {
      priority = 'Low';
    }

    await coordinator.emitSignal({
      type,
      leadId: deal.contactId, // Link to contact if available
      workspaceId,
      confidence: 1.0, // CRM events are always certain
      priority,
      metadata: {
        source: 'crm-deal-service',
        dealId: deal.id,
        dealName: deal.name,
        company:deal.company ?? deal.companyName,
        contactId: deal.contactId,
        value: deal.value,
        currency: deal.currency,
        stage: deal.stage,
        probability: deal.probability,
        expectedCloseDate: deal.expectedCloseDate,
        actualCloseDate: deal.actualCloseDate,
        ownerId: deal.ownerId,
        dealSource: deal.source,
        ...metadata,
      },
    });

    logger.info('Deal signal emitted', {
      type,
      dealId: deal.id,
            value: deal.value,
    });
  } catch (error) {
    // Don't fail deal operations if signal emission fails
    logger.error('Failed to emit deal signal', error instanceof Error ? error : new Error(String(error)), {
      type: params.type,
      dealId: params.deal.id,
    });
  }
}

