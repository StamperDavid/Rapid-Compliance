/**
 * Report Execution API
 * Executes saved reports and returns results
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/reports/execute
 * Execute a report and return results
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/reports/execute');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { reportId, orgId, parameters } = body;

    if (!reportId || !orgId) {
      return errors.badRequest('reportId and orgId are required');
    }

    // Get report configuration
    const report = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/reports`,
      reportId
    );

    if (!report) {
      return errors.notFound('Report not found');
    }

    logger.info('Executing report', { reportId, orgId, type: (report as any).type });

    // Execute report based on type
    const results = await executeReport(report as any, orgId, parameters);

    return NextResponse.json({
      success: true,
      reportId,
      executedAt: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    logger.error('Report execution error', error, { route: '/api/reports/execute' });
    return errors.internal('Failed to execute report', error);
  }
}

/**
 * Execute report based on type
 */
async function executeReport(report: any, orgId: string, parameters: any = {}) {
  const { type, config } = report;

  switch (type) {
    case 'revenue':
      return executeRevenueReport(orgId, config, parameters);
    
    case 'pipeline':
      return executePipelineReport(orgId, config, parameters);
    
    case 'leads':
      return executeLeadsReport(orgId, config, parameters);
    
    case 'deals':
      return executeDealsReport(orgId, config, parameters);
    
    case 'contacts':
      return executeContactsReport(orgId, config, parameters);
    
    case 'custom':
      return executeCustomReport(orgId, config, parameters);
    
    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

/**
 * Revenue Report
 */
async function executeRevenueReport(orgId: string, config: any, parameters: any) {
  const period =(parameters.period || config.period !== '' && parameters.period || config.period != null) ? parameters.period ?? config.period: '30d';
  
  // Call analytics service
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analytics/revenue?orgId=${orgId}&period=${period}`);
  const analytics = await response.json();
  
  return {
    type: 'revenue',
    period,
    data: analytics,
    summary: {
      totalRevenue: analytics.totalRevenue,
      dealsCount: analytics.dealsCount,
      avgDealSize: analytics.avgDealSize,
      growth: analytics.growth,
    },
    charts: [
      {
        type: 'line',
        title: 'Revenue Over Time',
        data: analytics.bySource ?? [],
      },
      {
        type: 'bar',
        title: 'Revenue by Source',
        data: analytics.bySource ?? [],
      },
    ],
  };
}

/**
 * Pipeline Report
 */
async function executePipelineReport(orgId: string, config: any, parameters: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analytics/pipeline?orgId=${orgId}`);
  const analytics = await response.json();
  
  return {
    type: 'pipeline',
    data: analytics,
    summary: {
      totalValue: analytics.totalValue,
      dealsCount: analytics.dealsCount,
      avgDealSize: analytics.avgDealSize,
      winRate: analytics.winRate,
    },
    charts: [
      {
        type: 'funnel',
        title: 'Pipeline by Stage',
        data: analytics.byStage ?? [],
      },
    ],
  };
}

/**
 * Leads Report
 */
async function executeLeadsReport(orgId: string, config: any, parameters: any) {
  const leadsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/leads/records`;
  const allLeads = await FirestoreService.getAll(leadsPath, []);
  
  // Group by status
  const statusMap = new Map<string, number>();
  allLeads.forEach((lead: any) => {
    const status =(lead.status !== '' && lead.status != null) ? lead.status : 'new';
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  });
  
  // Group by source
  const sourceMap = new Map<string, number>();
  allLeads.forEach((lead: any) => {
    const source =(lead.source !== '' && lead.source != null) ? lead.source : 'direct';
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  });
  
  return {
    type: 'leads',
    totalLeads: allLeads.length,
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    bySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
    recentLeads: allLeads.slice(0, 10).map((lead: any) => ({
      id: lead.id,
      name:(lead.name !== '' && lead.name != null) ? lead.name : `${lead.firstName} ${lead.lastName}`,
      email: lead.email,
      status: lead.status,
      createdAt: lead.createdAt,
    })),
  };
}

/**
 * Deals Report
 */
async function executeDealsReport(orgId: string, config: any, parameters: any) {
  const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/deals/records`;
  const allDeals = await FirestoreService.getAll(dealsPath, []);
  
  const totalValue = allDeals.reduce((sum: number, deal: any) => sum + (parseFloat(deal.value) || 0), 0);
  
  // Group by stage
  const stageMap = new Map<string, { count: number; value: number }>();
  allDeals.forEach((deal: any) => {
    const stage =(deal.stage || deal.status !== '' && deal.stage || deal.status != null) ? deal.stage ?? deal.status: 'new';
    const value = parseFloat(deal.value) || 0;
    const existing = stageMap.get(stage) ?? { count: 0, value: 0 };
    stageMap.set(stage, {
      count: existing.count + 1,
      value: existing.value + value,
    });
  });
  
  return {
    type: 'deals',
    totalDeals: allDeals.length,
    totalValue,
    avgDealSize: allDeals.length > 0 ? totalValue / allDeals.length : 0,
    byStage: Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
    })),
    topDeals: allDeals
      .sort((a: any, b: any) => (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0))
      .slice(0, 10)
      .map((deal: any) => ({
        id: deal.id,
        name: deal.name,
        value: deal.value,
        stage:deal.stage ?? deal.status,
      })),
  };
}

/**
 * Contacts Report
 */
async function executeContactsReport(orgId: string, config: any, parameters: any) {
  const contactsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/contacts/records`;
  const allContacts = await FirestoreService.getAll(contactsPath, []);
  
  return {
    type: 'contacts',
    totalContacts: allContacts.length,
    recentContacts: allContacts.slice(0, 10).map((contact: any) => ({
      id: contact.id,
      name:(contact.name !== '' && contact.name != null) ? contact.name : `${contact.firstName} ${contact.lastName}`,
      email: contact.email,
      company: contact.company,
      createdAt: contact.createdAt,
    })),
  };
}

/**
 * Custom Report (SQL-like queries)
 */
async function executeCustomReport(orgId: string, config: any, parameters: any) {
  // For custom reports, execute the configured query
  const { entity, filters, groupBy, aggregations } = config;
  
  const entityPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/${entity}/records`;
  const records = await FirestoreService.getAll(entityPath, []);
  
  // Apply filters (simple key-value matching)
  let filtered = records;
  if (filters) {
    filtered = records.filter((record: any) => {
      return Object.entries(filters).every(([key, value]) => record[key] === value);
    });
  }
  
  // Apply groupBy and aggregations
  if (groupBy && aggregations) {
    const grouped = new Map<any, any[]>();
    filtered.forEach((record: any) => {
      const key = record[groupBy];
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    });
    
    const result = Array.from(grouped.entries()).map(([key, group]) => {
      const aggregated: any = { [groupBy]: key, count: group.length };
      
      // Apply aggregations
      Object.entries(aggregations).forEach(([field, agg]) => {
        const values = group.map((r: any) => parseFloat(r[field]) || 0);
        switch (agg) {
          case 'sum':
            aggregated[`${field}_sum`] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            aggregated[`${field}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            aggregated[`${field}_min`] = Math.min(...values);
            break;
          case 'max':
            aggregated[`${field}_max`] = Math.max(...values);
            break;
        }
      });
      
      return aggregated;
    });
    
    return {
      type: 'custom',
      data: result,
      totalRecords: filtered.length,
    };
  }
  
  return {
    type: 'custom',
    data: filtered,
    totalRecords: filtered.length,
  };
}

