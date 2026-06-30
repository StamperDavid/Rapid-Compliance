/**
 * Deal Service
 * Business logic layer for deal/opportunity management
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';

import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { getSubCollection } from '@/lib/firebase/collections';
import { getOrCreateDefaultPipeline, getPipeline, getPipelineForDeal } from './pipeline-service';

export type { Deal } from './deal-service-types';
import type { Deal, DealStage } from './deal-service-types';

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

    const result = await AdminFirestoreService.getAllPaginated<Deal>(
      getSubCollection('deals'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Deals retrieved', {
      count: result.data.length,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get deals', error instanceof Error ? error : new Error(String(error)), { filters: filters ? JSON.stringify(filters) : undefined });
    throw new Error(`Failed to retrieve deals: ${errorMessage}`);
  }
}

/**
 * Get a single deal
 */
export async function getDeal(
  dealId: string
): Promise<Deal | null> {
  try {
    const deal = await AdminFirestoreService.get<Deal>(
      getSubCollection('deals'),
      dealId
    );

    if (!deal) {
      logger.warn('Deal not found', { dealId });
      return null;
    }

    logger.info('Deal retrieved', { dealId, value: deal.value });
    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get deal', error instanceof Error ? error : new Error(String(error)), { dealId });
    throw new Error(`Failed to retrieve deal: ${errorMessage}`);
  }
}

/**
 * Create a new deal
 */
export async function createDeal(
  data: Omit<Deal, 'id' | 'createdAt' | 'stage'> & { stage?: DealStage }
): Promise<Deal> {
  try {
    const dealId = `deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Resolve the pipeline this deal belongs to. New deals with no pipelineId
    // fall into the default pipeline so they render on the default board.
    const pipeline = data.pipelineId
      ? (await getPipeline(data.pipelineId)) ?? (await getOrCreateDefaultPipeline())
      : await getOrCreateDefaultPipeline();
    const firstStage = [...pipeline.stages].sort((a, b) => a.order - b.order)[0];
    const stage: DealStage = (data.stage !== undefined && data.stage !== '')
      ? data.stage
      : (firstStage?.key ?? 'prospecting');
    const stageDef = pipeline.stages.find((s) => s.key === stage);
    const probability = data.probability ?? stageDef?.probability ?? 10;

    const deal: Deal = {
      ...data,
      id: dealId,
      pipelineId: pipeline.id,
      currency: data.currency ?? 'USD',
      stage,
      probability,
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(
      getSubCollection('deals'),
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
      deal,
    });

    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create deal', error instanceof Error ? error : new Error(String(error)), { dealName: data.name, value: data.value });
    throw new Error(`Failed to create deal: ${errorMessage}`);
  }
}

/**
 * Update deal
 */
export async function updateDeal(
  dealId: string,
  updates: Partial<Omit<Deal, 'id' | 'createdAt'>>
): Promise<Deal> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await AdminFirestoreService.update(
      getSubCollection('deals'),
      dealId,
      updatedData
    );

    logger.info('Deal updated', {
      dealId,
      updatedFields: Object.keys(updates),
    });

    const deal = await getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found after update');
    }

    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update deal', error instanceof Error ? error : new Error(String(error)), { dealId });
    throw new Error(`Failed to update deal: ${errorMessage}`);
  }
}

/**
 * Create a deal from lead data (inherits attribution).
 * Accepts lead fields directly to avoid importing lead-service (which
 * pulls in firebase-admin and breaks client-side webpack builds).
 */
export async function createDealFromLead(
  leadId: string,
  leadAttribution: {
    firstName?: string;
    lastName?: string;
    company?: string;
    source?: string;
    ownerId?: string;
  },
  dealData: Partial<Omit<Deal, 'id' | 'createdAt'>>
): Promise<Deal> {
  try {
    const deal = await createDeal(
      {
        name: dealData.name ?? `${leadAttribution.firstName ?? ''} ${leadAttribution.lastName ?? ''} - Deal`.trim(),
        company: dealData.company ?? leadAttribution.company,
        contactId: dealData.contactId,
        leadId,
        value: dealData.value ?? 0,
        stage: dealData.stage ?? 'prospecting',
        probability: dealData.probability ?? 10,
        source: dealData.source ?? leadAttribution.source,
        ownerId: dealData.ownerId ?? leadAttribution.ownerId,
        ...dealData,
      }
    );

    logger.info('Deal created from lead', {
      dealId: deal.id,
      leadId,
      source: deal.source,
    });

    return deal;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create deal from lead', error instanceof Error ? error : new Error(String(error)), { leadId });
    throw new Error(`Failed to create deal from lead: ${errorMessage}`);
  }
}

/**
 * Move deal to next stage
 */
export async function moveDealToStage(
  dealId: string,
  newStage: DealStage
): Promise<Deal> {
  try {
    // Get current deal for event firing
    const currentDeal = await getDeal(dealId);
    if (!currentDeal) {
      throw new Error('Deal not found');
    }

    // Resolve the deal's pipeline (falls back to the default for legacy deals)
    // so the target stage is validated against real stage keys and win/loss is
    // detected via the stage's `type`, not just the two default keys.
    const pipeline = await getPipelineForDeal(currentDeal.pipelineId);
    const stageDef = pipeline.stages.find((s) => s.key === newStage);
    if (!stageDef) {
      throw new Error(`"${newStage}" isn’t a stage in this deal’s pipeline.`);
    }

    const oldStage = currentDeal.stage;
    const isWon = stageDef.type === 'won' || newStage === 'closed_won';
    const isLost = stageDef.type === 'lost' || newStage === 'closed_lost';

    const updates: Partial<Deal> = {
      stage: newStage,
    };

    // Auto-set close date if won/lost
    if (isWon || isLost) {
      updates.actualCloseDate = new Date();
      updates.probability = isWon ? 100 : 0;
    }

    const deal = await updateDeal(dealId, updates);

    // Fire CRM event
    try {
      const { fireDealStageChanged } = await import('./event-triggers');
      await fireDealStageChanged(dealId, oldStage, newStage, deal as unknown as Record<string, unknown>);
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
      deal,
      metadata: { oldStage, newStage },
    });

    // Emit specific win/loss signals
    if (isWon) {
      await emitDealSignal({
        type: 'deal.won',
        deal,
        metadata: { oldStage },
      });
    } else if (isLost) {
      await emitDealSignal({
        type: 'deal.lost',
        deal,
        metadata: { oldStage, lostReason: deal.lostReason },
      });
    }

    return deal;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to move deal', error instanceof Error ? error : new Error(String(error)), { dealId, newStage });
    throw new Error(`Failed to move deal: ${errorMessage}`);
  }
}

/**
 * Delete deal
 */
export async function deleteDeal(
  dealId: string
): Promise<void> {
  try {
    // Check for linked activities before deleting (referential integrity)
    const linkedActivities = await AdminFirestoreService.getAll(
      getSubCollection('activities'),
      [where('dealId', '==', dealId)]
    );
    if (linkedActivities.length > 0) {
      throw new Error(
        `Cannot delete deal: ${linkedActivities.length} activity record(s) are linked to this deal. Remove them first.`
      );
    }

    await AdminFirestoreService.delete(
      getSubCollection('deals'),
      dealId
    );

    logger.info('Deal deleted', { dealId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete deal', error instanceof Error ? error : new Error(String(error)), { dealId });
    throw new Error(`Failed to delete deal: ${errorMessage}`);
  }
}

/**
 * Get pipeline summary
 */
export async function getPipelineSummary(): Promise<Record<string, { count: number; totalValue: number }>> {
  try {
    const { data: allDeals } = await getDeals();

    const summary: Record<string, { count: number; totalValue: number }> = {};
    const stages: Deal['stage'][] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

    stages.forEach(stage => {
      const stageDeals = allDeals.filter(d => d.stage === stage);
      summary[stage] = {
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
      };
    });

    logger.info('Pipeline summary generated', { stageCount: Object.keys(summary).length });

    return summary;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get pipeline summary', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Failed to get pipeline summary: ${errorMessage}`);
  }
}

/**
 * Get all deals linked to a company by its id (association FK).
 */
export async function getDealsByCompanyId(companyId: string): Promise<Deal[]> {
  try {
    const deals = await AdminFirestoreService.getAll<Deal>(
      getSubCollection('deals'),
      [where('companyId', '==', companyId)]
    );

    logger.info('Deals retrieved by companyId', { companyId, count: deals.length });
    return deals;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get deals by companyId', error instanceof Error ? error : new Error(String(error)), { companyId });
    throw new Error(`Failed to retrieve deals by company: ${errorMessage}`);
  }
}

// ============================================================================
// SERVER-SIDE HELPERS — Admin SDK required (used by merge route)
// ============================================================================

/**
 * Find all deals whose contactId matches the given value.
 * Uses the Admin SDK so this can be called from server-side API routes.
 */
export async function findDealsByContactId(contactId: string): Promise<Deal[]> {
  try {
    const db = AdminFirestoreService.collection(getSubCollection('deals'));
    const snapshot = await db.where('contactId', '==', contactId).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Deal);
  } catch (error) {
    logger.error('Failed to find deals by contactId', error instanceof Error ? error : new Error(String(error)), { contactId });
    throw new Error(`Failed to find deals by contactId: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  deal: Deal;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { type, deal, metadata = {} } = params;
    const coordinator = getServerSignalCoordinator();

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
      leadId: deal.leadId ?? deal.contactId, // Link to lead or contact
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

