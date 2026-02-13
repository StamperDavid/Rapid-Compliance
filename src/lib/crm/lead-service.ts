/**
 * Lead Service
 * Business logic layer for lead management
 * Decouples UI from direct Firestore access
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface EnrichmentData {
  linkedInUrl?: string;
  title?: string;
  companySize?: number;
  industry?: string;
  revenue?: number;
  [key: string]: unknown;
}

export interface Lead {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  companyName?: string;
  title?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  score?: number;
  ownerId?: string;
  formId?: string;
  formSubmissionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  enrichmentData?: EnrichmentData;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface LeadFilters {
  status?: string;
  score?: { min?: number; max?: number };
  source?: string;
  ownerId?: string;
  tags?: string[];
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Get leads with pagination and filtering
 */
export async function getLeads(
  workspaceId: string = 'default',
  filters?: LeadFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Lead>> {
  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.source) {
      constraints.push(where('source', '==', filters.source));
    }

    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    // Default ordering
    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Lead>(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/leads/records`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Leads retrieved', {
      workspaceId,
      count: result.data.length,
      hasMore: result.hasMore,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get leads', error instanceof Error ? error : undefined, { workspaceId, filters: filters ? JSON.stringify(filters) : undefined });
    throw new Error(`Failed to retrieve leads: ${errorMessage}`);
  }
}

/**
 * Get a single lead by ID
 */
export async function getLead(
  leadId: string,
  workspaceId: string = 'default'
): Promise<Lead | null> {
  try {
    const lead = await FirestoreService.get<Lead>(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/leads/records`,
      leadId
    );

    if (!lead) {
      logger.warn('Lead not found', { leadId, workspaceId });
      return null;
    }

    logger.info('Lead retrieved', { leadId });
    return lead;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get lead', error instanceof Error ? error : undefined, { leadId });
    throw new Error(`Failed to retrieve lead: ${errorMessage}`);
  }
}

/**
 * Create a new lead with auto-enrichment
 */
export async function createLead(
  data: Omit<Lead, 'id' | 'workspaceId' | 'createdAt'>,
  workspaceId: string = 'default',
  options: { autoEnrich?: boolean; skipDuplicateCheck?: boolean } = {}
): Promise<Lead> {
  try {
    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    let enrichmentData: EnrichmentData | null = null;
    let enrichedScore = data.score ?? 50;

    // Auto-enrich if enabled and company provided
    if (options.autoEnrich !== false && data.company) {
      try {
        const { enrichCompany } = await import('@/lib/enrichment/enrichment-service');
        const enrichmentResponse = await enrichCompany({
          companyName: data.company,
        });

        if (enrichmentResponse.success && enrichmentResponse.data) {
          enrichmentData = enrichmentResponse.data as unknown as EnrichmentData;
          enrichedScore = calculateEnrichedScore({ ...data, score: enrichedScore } as Lead, enrichmentData);

          logger.info('Lead auto-enriched on creation', {
            leadId,
            dataPoints: Object.keys(enrichmentData ?? {}).length,
          });
        }
      } catch (enrichError) {
        // Don't fail lead creation if enrichment fails
        logger.warn('Auto-enrichment failed, continuing with lead creation', { error: enrichError instanceof Error ? enrichError.message : String(enrichError) });
      }
    }

    // Clean undefined values from enrichmentData (Firestore doesn't allow undefined)
    const cleanEnrichmentData: EnrichmentData | null = enrichmentData ?
      Object.fromEntries(
        Object.entries(enrichmentData).filter(([_key, v]) => v !== undefined)
      ) as EnrichmentData : null;

    const lead: Lead = {
      ...data,
      id: leadId,
      workspaceId,
      status: data.status ?? 'new',
      score: enrichedScore,
      ...(cleanEnrichmentData && { enrichmentData: cleanEnrichmentData }),
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/leads/records`,
      leadId,
      lead,
      false
    );

    // Log activity
    try {
      const { logStatusChange } = await import('./activity-logger');
      await logStatusChange({
        workspaceId,
        relatedEntityType: 'lead',
        relatedEntityId: leadId,
        relatedEntityName: `${data.firstName} ${data.lastName}`,
        fieldChanged: 'status',
        previousValue: null,
        newValue: lead.status,
        userName: 'System',
      });
    } catch (activityError) {
      logger.warn('Failed to log lead creation activity', { error: activityError instanceof Error ? activityError.message : String(activityError) });
    }

    // Fire CRM event for workflow triggers
    try {
      const { fireLeadCreated } = await import('./event-triggers');
      await fireLeadCreated(workspaceId, leadId, { ...lead } as Record<string, unknown>);
    } catch (triggerError) {
      logger.warn('Failed to fire lead created event', { error: triggerError instanceof Error ? triggerError.message : String(triggerError) });
    }

    logger.info('Lead created', {
      leadId,
      email: lead.email,
      source: lead.source,
      enriched: !!enrichmentData,
    });

    return lead;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create lead', error instanceof Error ? error : undefined, { dataKeys: Object.keys(data).join(',') });
    throw new Error(`Failed to create lead: ${errorMessage}`);
  }
}

/**
 * Update an existing lead
 */
export async function updateLead(
  leadId: string,
  updates: Partial<Omit<Lead, 'id' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = 'default'
): Promise<Lead> {
  try {
    // Get current lead for comparison
    const currentLead = await getLead(leadId, workspaceId);
    if (!currentLead) {
      throw new Error('Lead not found');
    }

    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/leads/records`,
      leadId,
      updatedData
    );

    logger.info('Lead updated', {
      leadId,
      updatedFields: Object.keys(updates),
    });

    // Return updated lead
    const lead = await getLead(leadId, workspaceId);
    if (!lead) {
      throw new Error('Lead not found after update');
    }

    // Fire events for significant changes
    try {
      const { fireLeadStatusChanged, fireLeadScoreChanged } = await import('./event-triggers');

      if (updates.status && updates.status !== currentLead.status) {
        await fireLeadStatusChanged(
          workspaceId,
          leadId,
          currentLead.status,
          updates.status,
          { ...lead } as Record<string, unknown>
        );
      }

      if (updates.score && updates.score !== currentLead.score) {
        await fireLeadScoreChanged(
          workspaceId,
          leadId,
          currentLead.score ?? 0,
          updates.score,
          { ...lead } as Record<string, unknown>
        );
      }
    } catch (triggerError) {
      logger.warn('Failed to fire lead update events', { error: triggerError instanceof Error ? triggerError.message : String(triggerError) });
    }

    return lead;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update lead', error instanceof Error ? error : undefined, { leadId, updatedFields: Object.keys(updates).join(',') });
    throw new Error(`Failed to update lead: ${errorMessage}`);
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(
  leadId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    // Check for linked deals before deleting (referential integrity)
    const linkedDeals = await FirestoreService.getAll(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/deals/records`,
      [where('leadId', '==', leadId)]
    );
    if (linkedDeals.length > 0) {
      throw new Error(
        `Cannot delete lead: ${linkedDeals.length} deal(s) are linked to this lead. Remove or reassign them first.`
      );
    }

    await FirestoreService.delete(
      `${getSubCollection('workspaces')}/${workspaceId}/entities/leads/records`,
      leadId
    );

    logger.info('Lead deleted', { leadId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete lead', error instanceof Error ? error : undefined, { leadId });
    throw new Error(`Failed to delete lead: ${errorMessage}`);
  }
}

/**
 * Enrich a lead with external data
 */
export async function enrichLead(
  leadId: string,
  workspaceId: string = 'default'
): Promise<Lead> {
  try {
    const lead = await getLead(leadId, workspaceId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Call enrichment service for company data
    const { enrichCompany } = await import('@/lib/enrichment/enrichment-service');

    let enrichmentData: EnrichmentData | null = null;

    // Only enrich if we have company information
    if (lead.company) {
      const enrichmentResponse = await enrichCompany({
        companyName: lead.company,
      });

      if (enrichmentResponse.success && enrichmentResponse.data) {
        enrichmentData = enrichmentResponse.data as unknown as EnrichmentData;
      }
    }

    // Update lead with enrichment data
    const updatedLead = await updateLead(leadId, {
      enrichmentData: enrichmentData ?? undefined,
      score: calculateEnrichedScore(lead, enrichmentData),
      updatedAt: new Date(),
    }, workspaceId);

    logger.info('Lead enriched', {
      leadId,
      dataPoints: Object.keys(enrichmentData ?? {}).length,
    });

    return updatedLead;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to enrich lead', error instanceof Error ? error : undefined, { leadId });
    throw new Error(`Failed to enrich lead: ${errorMessage}`);
  }
}

/**
 * Calculate lead score based on enrichment data
 */
function calculateEnrichedScore(lead: Lead, enrichmentData: EnrichmentData | null): number {
  let score = lead.score ?? 50;

  if (!enrichmentData) {
    return score;
  }

  // Boost score based on enrichment data quality
  if (enrichmentData.linkedInUrl) {
    score += 10;
  }
  if (enrichmentData.title && typeof enrichmentData.title === 'string') {
    const titleLower = enrichmentData.title.toLowerCase();
    if (titleLower.includes('director') || titleLower.includes('manager')) {
      score += 5;
    }
  }
  if (enrichmentData.companySize && typeof enrichmentData.companySize === 'number' && enrichmentData.companySize > 50) {
    score += 5;
  }
  if (enrichmentData.industry) {
    score += 5;
  }
  if (enrichmentData.revenue && typeof enrichmentData.revenue === 'number' && enrichmentData.revenue > 1000000) {
    score += 10;
  }

  return Math.min(score, 100); // Cap at 100
}

/**
 * Bulk operations
 */
export async function bulkUpdateLeads(
  leadIds: string[],
  updates: Partial<Lead>,
  workspaceId: string = 'default'
): Promise<number> {
  try {
    let successCount = 0;

    for (const leadId of leadIds) {
      try {
        await updateLead(leadId, updates, workspaceId);
        successCount++;
      } catch (error) {
        logger.warn('Failed to update lead in bulk operation', { leadId, error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.info('Bulk lead update completed', {
      total: leadIds.length,
      successful: successCount,
      failed: leadIds.length - successCount,
    });

    return successCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Bulk lead update failed', error instanceof Error ? error : undefined, { leadCount: leadIds.length });
    throw new Error(`Bulk update failed: ${errorMessage}`);
  }
}

/**
 * Search leads
 */
export async function searchLeads(
  searchTerm: string,
  workspaceId: string = 'default',
  options?: PaginationOptions
): Promise<PaginatedResult<Lead>> {
  try {
    // For now, get all and filter (Firestore doesn't have full-text search)
    // In production, use Algolia or Elasticsearch
    const result = await getLeads(workspaceId, undefined, options);

    const searchLower = searchTerm.toLowerCase();
    const filtered = result.data.filter(lead =>
      lead.firstName?.toLowerCase().includes(searchLower) ||
      lead.lastName?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower)
    );

    logger.info('Leads searched', {
      searchTerm,
      resultsCount: filtered.length,
    });

    return {
      data: filtered,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Lead search failed', error instanceof Error ? error : undefined, { searchTerm });
    throw new Error(`Search failed: ${errorMessage}`);
  }
}

