/**
 * Report Execution API
 * Executes saved reports and returns results
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection, getLeadsCollection, getDealsCollection, getContactsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

// Type Interfaces
interface RequestBody {
  reportId: string;
  parameters?: ReportParameters;
}

interface ReportParameters {
  period?: string;
  [key: string]: unknown;
}

interface ReportConfig {
  period?: string;
  entity?: string;
  filters?: Record<string, unknown>;
  groupBy?: string;
  aggregations?: Record<string, AggregationType>;
  [key: string]: unknown;
}

interface Report {
  id: string;
  type: ReportType;
  config: ReportConfig;
}

type ReportType = 'revenue' | 'pipeline' | 'leads' | 'deals' | 'contacts' | 'custom';
type AggregationType = 'sum' | 'avg' | 'min' | 'max';

interface AnalyticsResponse {
  totalRevenue?: number;
  dealsCount?: number;
  avgDealSize?: number;
  growth?: number;
  bySource?: Array<{ source: string; value: number }>;
  totalValue?: number;
  winRate?: number;
  byStage?: Array<{ stage: string; count: number; value: number }>;
}

interface ChartData {
  type: string;
  title: string;
  data: Array<Record<string, unknown>>;
}

interface RevenueReportResult {
  type: 'revenue';
  period: string;
  data: AnalyticsResponse;
  summary: {
    totalRevenue: number | undefined;
    dealsCount: number | undefined;
    avgDealSize: number | undefined;
    growth: number | undefined;
  };
  charts: ChartData[];
}

interface PipelineReportResult {
  type: 'pipeline';
  data: AnalyticsResponse;
  summary: {
    totalValue: number | undefined;
    dealsCount: number | undefined;
    avgDealSize: number | undefined;
    winRate: number | undefined;
  };
  charts: ChartData[];
}

interface LeadsReportResult {
  type: 'leads';
  totalLeads: number;
  byStatus: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  recentLeads: Array<{
    id: string;
    name: string;
    email: string;
    status: string | undefined;
    createdAt: unknown;
  }>;
}

interface DealsReportResult {
  type: 'deals';
  totalDeals: number;
  totalValue: number;
  avgDealSize: number;
  byStage: Array<{ stage: string; count: number; value: number }>;
  topDeals: Array<{
    id: string;
    name: string;
    value: string | number;
    stage: string | undefined;
  }>;
}

interface ContactsReportResult {
  type: 'contacts';
  totalContacts: number;
  recentContacts: Array<{
    id: string;
    name: string;
    email: string;
    company: string | undefined;
    createdAt: unknown;
  }>;
}

interface CustomReportResult {
  type: 'custom';
  data: Array<Record<string, unknown>>;
  totalRecords: number;
}

type ReportResult =
  | RevenueReportResult
  | PipelineReportResult
  | LeadsReportResult
  | DealsReportResult
  | ContactsReportResult
  | CustomReportResult;

interface LeadData {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  status?: string;
  source?: string;
  createdAt: unknown;
}

interface DealData {
  id: string;
  name: string;
  value: string | number;
  stage?: string;
  status?: string;
}

interface ContactData {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  company?: string;
  createdAt: unknown;
}

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

    const body = (await request.json()) as RequestBody;
    const { reportId, parameters } = body;

    if (!reportId) {
      return errors.badRequest('reportId is required');
    }

    // Get report configuration
    const reportDoc = await AdminFirestoreService.get(
      getSubCollection('reports'),
      reportId
    );

    if (!reportDoc) {
      return errors.notFound('Report not found');
    }

    const report = reportDoc as unknown as Report;
    logger.info('Executing report', { reportId, type: report.type });

    // Execute report based on type
    const results = await executeReport(report, parameters);

    return NextResponse.json({
      success: true,
      reportId,
      executedAt: new Date().toISOString(),
      results,
    });
  } catch (error: unknown) {
    logger.error('Report execution error', error instanceof Error ? error : new Error(String(error)), { route: '/api/reports/execute' });
    return errors.internal('Failed to execute report', error instanceof Error ? error : undefined);
  }
}

/**
 * Execute report based on type
 */
async function executeReport(
  report: Report,
  parameters: ReportParameters = {}
): Promise<ReportResult> {
  const { type, config } = report;

  switch (type) {
    case 'revenue':
      return executeRevenueReport(config, parameters);

    case 'pipeline':
      return executePipelineReport(config, parameters);

    case 'leads':
      return executeLeadsReport(config, parameters);

    case 'deals':
      return executeDealsReport(config, parameters);

    case 'contacts':
      return executeContactsReport(config, parameters);

    case 'custom':
      return executeCustomReport(config, parameters);

    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

/**
 * Revenue Report
 */
async function executeRevenueReport(
  config: ReportConfig,
  parameters: ReportParameters
): Promise<RevenueReportResult> {
  const period =
    (parameters.period || config.period !== '' && parameters.period || config.period != null)
      ? (parameters.period ?? config.period) as string
      : '30d';

  // Call analytics service
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL as string}/api/analytics/revenue?period=${period}`
  );
  const analytics = (await response.json()) as AnalyticsResponse;

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
async function executePipelineReport(
  _config: ReportConfig,
  _parameters: ReportParameters
): Promise<PipelineReportResult> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL as string}/api/analytics/pipeline`
  );
  const analytics = (await response.json()) as AnalyticsResponse;

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
async function executeLeadsReport(
  _config: ReportConfig,
  _parameters: ReportParameters
): Promise<LeadsReportResult> {
  const leadsPath = getLeadsCollection();
  const allLeadsData = await AdminFirestoreService.getAll(leadsPath, []);
  const allLeads = allLeadsData as unknown as LeadData[];

  // Group by status
  const statusMap = new Map<string, number>();
  allLeads.forEach((lead) => {
    const status = (lead.status !== '' && lead.status != null) ? lead.status : 'new';
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  });

  // Group by source
  const sourceMap = new Map<string, number>();
  allLeads.forEach((lead) => {
    const source = (lead.source !== '' && lead.source != null) ? lead.source : 'direct';
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  });

  return {
    type: 'leads',
    totalLeads: allLeads.length,
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    bySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
    recentLeads: allLeads.slice(0, 10).map((lead) => ({
      id: lead.id,
      name: (lead.name !== '' && lead.name != null)
        ? lead.name
        : `${lead.firstName ?? ''} ${lead.lastName ?? ''}`,
      email: lead.email,
      status: lead.status,
      createdAt: lead.createdAt,
    })),
  };
}

/**
 * Deals Report
 */
async function executeDealsReport(
  _config: ReportConfig,
  _parameters: ReportParameters
): Promise<DealsReportResult> {
  const dealsPath = getDealsCollection();
  const allDealsData = await AdminFirestoreService.getAll(dealsPath, []);
  const allDeals = allDealsData as unknown as DealData[];

  const totalValue = allDeals.reduce(
    (sum: number, deal) => sum + (parseFloat(deal.value.toString()) || 0),
    0
  );

  // Group by stage
  const stageMap = new Map<string, { count: number; value: number }>();
  allDeals.forEach((deal) => {
    const stage: string =
      (deal.stage && deal.stage !== '')
        ? deal.stage
        : (deal.status && deal.status !== '')
        ? deal.status
        : 'new';
    const value = parseFloat(deal.value.toString()) || 0;
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
      .sort((a, b) => (parseFloat(b.value.toString()) || 0) - (parseFloat(a.value.toString()) || 0))
      .slice(0, 10)
      .map((deal) => ({
        id: deal.id,
        name: deal.name,
        value: deal.value,
        stage: deal.stage ?? deal.status,
      })),
  };
}

/**
 * Contacts Report
 */
async function executeContactsReport(
  _config: ReportConfig,
  _parameters: ReportParameters
): Promise<ContactsReportResult> {
  const contactsPath = getContactsCollection();
  const allContactsData = await AdminFirestoreService.getAll(contactsPath, []);
  const allContacts = allContactsData as unknown as ContactData[];

  return {
    type: 'contacts',
    totalContacts: allContacts.length,
    recentContacts: allContacts.slice(0, 10).map((contact) => ({
      id: contact.id,
      name: (contact.name !== '' && contact.name != null)
        ? contact.name
        : `${contact.firstName ?? ''} ${contact.lastName ?? ''}`,
      email: contact.email,
      company: contact.company,
      createdAt: contact.createdAt,
    })),
  };
}

/**
 * Custom Report (SQL-like queries)
 */
async function executeCustomReport(
  config: ReportConfig,
  _parameters: ReportParameters
): Promise<CustomReportResult> {
  // For custom reports, execute the configured query
  const { entity, filters, groupBy, aggregations } = config;

  if (!entity) {
    throw new Error('Entity is required for custom reports');
  }

  const entityPath = getSubCollection(entity);
  const recordsData = await AdminFirestoreService.getAll(entityPath, []);
  const records = recordsData as Array<Record<string, unknown>>;

  // Apply filters (simple key-value matching)
  let filtered = records;
  if (filters) {
    filtered = records.filter((record) => {
      return Object.entries(filters).every(([key, value]) => record[key] === value);
    });
  }

  // Apply groupBy and aggregations
  if (groupBy && aggregations) {
    const grouped = new Map<unknown, Array<Record<string, unknown>>>();
    filtered.forEach((record) => {
      const key = record[groupBy];
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      const existingGroup = grouped.get(key);
      if (existingGroup) {
        existingGroup.push(record);
      }
    });

    const result = Array.from(grouped.entries()).map(([key, group]) => {
      const aggregated: Record<string, unknown> = { [groupBy]: key, count: group.length };

      // Apply aggregations
      Object.entries(aggregations).forEach(([field, agg]) => {
        const values = group.map((r) => {
          const fieldValue = r[field];
          return typeof fieldValue === 'number'
            ? fieldValue
            : parseFloat(String(fieldValue)) || 0;
        });
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

