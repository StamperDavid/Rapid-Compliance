/**
 * Lead Service
 * Business logic layer for lead management
 * Decouples UI from direct Firestore access
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface Lead {
  id: string;
  organizationId: string;
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
  tags?: string[];
  customFields?: Record<string, any>;
  enrichmentData?: Record<string, any>;
  createdAt: any;
  updatedAt?: any;
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
  organizationId: string,
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
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/leads/records`,
      constraints,
      options?.pageSize || 50,
      options?.lastDoc
    );

    logger.info('Leads retrieved', {
      organizationId,
      workspaceId,
      count: result.data.length,
      hasMore: result.hasMore,
      filters,
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to get leads', error, { organizationId, workspaceId, filters });
    throw new Error(`Failed to retrieve leads: ${error.message}`);
  }
}

/**
 * Get a single lead by ID
 */
export async function getLead(
  organizationId: string,
  leadId: string,
  workspaceId: string = 'default'
): Promise<Lead | null> {
  try {
    const lead = await FirestoreService.get<Lead>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/leads/records`,
      leadId
    );

    if (!lead) {
      logger.warn('Lead not found', { organizationId, leadId, workspaceId });
      return null;
    }

    logger.info('Lead retrieved', { organizationId, leadId });
    return lead;
  } catch (error: any) {
    logger.error('Failed to get lead', error, { organizationId, leadId });
    throw new Error(`Failed to retrieve lead: ${error.message}`);
  }
}

/**
 * Create a new lead with auto-enrichment
 */
export async function createLead(
  organizationId: string,
  data: Omit<Lead, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>,
  workspaceId: string = 'default',
  options: { autoEnrich?: boolean; skipDuplicateCheck?: boolean } = {}
): Promise<Lead> {
  try {
    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    let enrichmentData = null;
    let enrichedScore = data.score || 50;

    // Auto-enrich if enabled and company provided
    if (options.autoEnrich !== false && data.company) {
      try {
        const { enrichCompany } = await import('@/lib/enrichment/enrichment-service');
        const enrichmentResponse = await enrichCompany({
          companyName: data.company,
        }, organizationId);
        
        if (enrichmentResponse.success) {
          enrichmentData = enrichmentResponse.data;
          enrichedScore = calculateEnrichedScore({ ...data, score: enrichedScore } as Lead, enrichmentData);
          
          logger.info('Lead auto-enriched on creation', {
            leadId,
            dataPoints: Object.keys(enrichmentData || {}).length,
          });
        }
      } catch (enrichError) {
        // Don't fail lead creation if enrichment fails
        logger.warn('Auto-enrichment failed, continuing with lead creation', enrichError);
      }
    }

    const lead: Lead = {
      ...data,
      id: leadId,
      organizationId,
      workspaceId,
      status: data.status || 'new',
      score: enrichedScore,
      enrichmentData,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/leads/records`,
      leadId,
      lead,
      false
    );

    // Log activity
    try {
      const { logStatusChange } = await import('./activity-logger');
      await logStatusChange({
        organizationId,
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
      logger.warn('Failed to log lead creation activity', activityError);
    }

    // Fire CRM event for workflow triggers
    try {
      const { fireLeadCreated } = await import('./event-triggers');
      await fireLeadCreated(organizationId, workspaceId, leadId, lead);
    } catch (triggerError) {
      logger.warn('Failed to fire lead created event', triggerError);
    }

    logger.info('Lead created', {
      organizationId,
      leadId,
      email: lead.email,
      source: lead.source,
      enriched: !!enrichmentData,
    });

    return lead;
  } catch (error: any) {
    logger.error('Failed to create lead', error, { organizationId, data });
    throw new Error(`Failed to create lead: ${error.message}`);
  }
}

/**
 * Update an existing lead
 */
export async function updateLead(
  organizationId: string,
  leadId: string,
  updates: Partial<Omit<Lead, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = 'default'
): Promise<Lead> {
  try {
    // Get current lead for comparison
    const currentLead = await getLead(organizationId, leadId, workspaceId);
    if (!currentLead) {
      throw new Error('Lead not found');
    }

    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/leads/records`,
      leadId,
      updatedData
    );

    logger.info('Lead updated', {
      organizationId,
      leadId,
      updatedFields: Object.keys(updates),
    });

    // Return updated lead
    const lead = await getLead(organizationId, leadId, workspaceId);
    if (!lead) {
      throw new Error('Lead not found after update');
    }

    // Fire events for significant changes
    try {
      const { fireLeadStatusChanged, fireLeadScoreChanged } = await import('./event-triggers');
      
      if (updates.status && updates.status !== currentLead.status) {
        await fireLeadStatusChanged(
          organizationId,
          workspaceId,
          leadId,
          currentLead.status,
          updates.status,
          lead
        );
      }

      if (updates.score && updates.score !== currentLead.score) {
        await fireLeadScoreChanged(
          organizationId,
          workspaceId,
          leadId,
          currentLead.score || 0,
          updates.score,
          lead
        );
      }
    } catch (triggerError) {
      logger.warn('Failed to fire lead update events', triggerError);
    }

    return lead;
  } catch (error: any) {
    logger.error('Failed to update lead', error, { organizationId, leadId, updates });
    throw new Error(`Failed to update lead: ${error.message}`);
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(
  organizationId: string,
  leadId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/leads/records`,
      leadId
    );

    logger.info('Lead deleted', { organizationId, leadId });
  } catch (error: any) {
    logger.error('Failed to delete lead', error, { organizationId, leadId });
    throw new Error(`Failed to delete lead: ${error.message}`);
  }
}

/**
 * Enrich a lead with external data
 */
export async function enrichLead(
  organizationId: string,
  leadId: string,
  workspaceId: string = 'default'
): Promise<Lead> {
  try {
    const lead = await getLead(organizationId, leadId, workspaceId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Call enrichment service for company data
    const { enrichCompany } = await import('@/lib/enrichment/enrichment-service');
    
    let enrichmentData = null;
    
    // Only enrich if we have company information
    if (lead.company) {
      const enrichmentResponse = await enrichCompany({
        companyName: lead.company,
      }, organizationId);
      
      if (enrichmentResponse.success) {
        enrichmentData = enrichmentResponse.data;
      }
    }

    // Update lead with enrichment data
    const updatedLead = await updateLead(organizationId, leadId, {
      enrichmentData,
      score: calculateEnrichedScore(lead, enrichmentData),
      updatedAt: new Date(),
    }, workspaceId);

    logger.info('Lead enriched', {
      organizationId,
      leadId,
      dataPoints: Object.keys(enrichmentData || {}).length,
    });

    return updatedLead;
  } catch (error: any) {
    logger.error('Failed to enrich lead', error, { organizationId, leadId });
    throw new Error(`Failed to enrich lead: ${error.message}`);
  }
}

/**
 * Calculate lead score based on enrichment data
 */
function calculateEnrichedScore(lead: Lead, enrichmentData: any): number {
  let score = lead.score || 50;

  // Boost score based on enrichment data quality
  if (enrichmentData?.linkedInUrl) score += 10;
  if (enrichmentData?.title?.toLowerCase().includes('director') ||
      enrichmentData?.title?.toLowerCase().includes('manager')) score += 5;
  if (enrichmentData?.companySize && enrichmentData.companySize > 50) score += 5;
  if (enrichmentData?.industry) score += 5;
  if (enrichmentData?.revenue && enrichmentData.revenue > 1000000) score += 10;

  return Math.min(score, 100); // Cap at 100
}

/**
 * Bulk operations
 */
export async function bulkUpdateLeads(
  organizationId: string,
  leadIds: string[],
  updates: Partial<Lead>,
  workspaceId: string = 'default'
): Promise<number> {
  try {
    let successCount = 0;

    for (const leadId of leadIds) {
      try {
        await updateLead(organizationId, leadId, updates, workspaceId);
        successCount++;
      } catch (error) {
        logger.warn('Failed to update lead in bulk operation', { leadId, error });
      }
    }

    logger.info('Bulk lead update completed', {
      organizationId,
      total: leadIds.length,
      successful: successCount,
      failed: leadIds.length - successCount,
    });

    return successCount;
  } catch (error: any) {
    logger.error('Bulk lead update failed', error, { organizationId, leadIds });
    throw new Error(`Bulk update failed: ${error.message}`);
  }
}

/**
 * Search leads
 */
export async function searchLeads(
  organizationId: string,
  searchTerm: string,
  workspaceId: string = 'default',
  options?: PaginationOptions
): Promise<PaginatedResult<Lead>> {
  try {
    // For now, get all and filter (Firestore doesn't have full-text search)
    // In production, use Algolia or Elasticsearch
    const result = await getLeads(organizationId, workspaceId, undefined, options);

    const searchLower = searchTerm.toLowerCase();
    const filtered = result.data.filter(lead =>
      lead.firstName?.toLowerCase().includes(searchLower) ||
      lead.lastName?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower)
    );

    logger.info('Leads searched', {
      organizationId,
      searchTerm,
      resultsCount: filtered.length,
    });

    return {
      data: filtered,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error: any) {
    logger.error('Lead search failed', error, { organizationId, searchTerm });
    throw new Error(`Search failed: ${error.message}`);
  }
}

