import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { withCache } from '@/lib/cache/analytics-cache';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

/**
 * Helper function to convert various date formats to Date object
 */
function toDate(value: unknown): Date {
  if (!value) { return new Date(); }
  if (value instanceof Date) { return value; }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}

// ============================================================================
// Firestore record interfaces
// ============================================================================

interface LeadRecord {
  id?: string;
  status?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  formId?: string;
  formSubmissionId?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
}

interface DealRecord {
  id?: string;
  status?: string;
  stage?: string;
  value?: string | number;
  amount?: string | number;
  source?: string;
  leadId?: string;
  closedDate?: { toDate?: () => Date } | Date | string;
  createdAt?: { toDate?: () => Date } | Date | string;
}

interface OrderRecord {
  id?: string;
  status?: string;
  total?: string | number;
  amount?: string | number;
  source?: string;
  attributionSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  dealId?: string;
  leadId?: string;
  formId?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
}

interface FormSubmissionRecord {
  id?: string;
  formId?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
}

// ============================================================================
// Response types
// ============================================================================

interface SourceBreakdown {
  source: string;
  revenue: number;
  orders: number;
  deals: number;
  leads: number;
}

interface CampaignBreakdown {
  campaign: string;
  revenue: number;
  leads: number;
  deals: number;
  orders: number;
  conversionRate: number;
}

interface MediumBreakdown {
  medium: string;
  revenue: number;
  leads: number;
  deals: number;
  orders: number;
}

interface FunnelMetrics {
  formSubmissions: number;
  leadsCreated: number;
  dealsCreated: number;
  ordersCompleted: number;
  formToLeadRate: number;
  leadToDealRate: number;
  dealToOrderRate: number;
  overallConversionRate: number;
}

interface AttributionAnalytics {
  success: boolean;
  period: string;
  totalAttributedRevenue: number;
  totalUnattributedRevenue: number;
  funnel: FunnelMetrics;
  bySource: SourceBreakdown[];
  byCampaign: CampaignBreakdown[];
  byMedium: MediumBreakdown[];
  topPerformingSource: string;
  topPerformingCampaign: string;
}

/**
 * GET /api/analytics/attribution - Revenue attribution analytics
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/attribution');
    if (rateLimitResponse) { return rateLimitResponse; }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period = (periodParam !== '' && periodParam != null) ? periodParam : '30d';

    const analytics = await withCache(
      'attribution',
      async () => calculateAttributionAnalytics(period),
      { period }
    );

    logger.info('Attribution analytics retrieved', {
      route: '/api/analytics/attribution',
      period,
      totalAttributedRevenue: analytics.totalAttributedRevenue,
    });

    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Attribution analytics error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/analytics/attribution',
    });
    return errors.internal('Failed to generate attribution analytics', error instanceof Error ? error : new Error(message));
  }
}

/**
 * Calculate attribution analytics (extracted for caching)
 */
async function calculateAttributionAnalytics(period: string): Promise<AttributionAnalytics> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      startDate = new Date('2020-01-01');
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Fetch all collections
  const leadsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/default/entities/leads`;
  const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/default/entities/deals`;
  const ordersPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`;
  const formSubmissionsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/formSubmissions`;

  let allLeads: LeadRecord[] = [];
  let allDeals: DealRecord[] = [];
  let allOrders: OrderRecord[] = [];
  let allFormSubmissions: FormSubmissionRecord[] = [];

  try { allLeads = await FirestoreService.getAll<LeadRecord>(leadsPath, []); } catch { logger.debug('No leads collection yet'); }
  try { allDeals = await FirestoreService.getAll<DealRecord>(dealsPath, []); } catch { logger.debug('No deals collection yet'); }
  try { allOrders = await FirestoreService.getAll<OrderRecord>(ordersPath, []); } catch { logger.debug('No orders collection yet'); }
  try { allFormSubmissions = await FirestoreService.getAll<FormSubmissionRecord>(formSubmissionsPath, []); } catch { logger.debug('No form submissions collection yet'); }

  // Filter by date range
  const leads = allLeads.filter(l => {
    const d = toDate(l.createdAt);
    return d >= startDate && d <= now;
  });

  const deals = allDeals.filter(d => {
    const dt = toDate(d.createdAt);
    return dt >= startDate && dt <= now;
  });

  const closedWonDeals = deals.filter(d =>
    d.status === 'won' || d.status === 'closed_won' || d.stage === 'closed_won'
  );

  const completedOrders = allOrders.filter(o => {
    if (o.status !== 'completed' && o.status !== 'paid') { return false; }
    const dt = toDate(o.createdAt);
    return dt >= startDate && dt <= now;
  });

  const formSubmissions = allFormSubmissions.filter(f => {
    const dt = toDate(f.createdAt);
    return dt >= startDate && dt <= now;
  });

  // ---- Funnel Metrics ----
  const formSubmissionCount = formSubmissions.length;
  const leadsCreated = leads.length;
  const dealsCreated = deals.length;
  const ordersCompleted = completedOrders.length;

  const funnel: FunnelMetrics = {
    formSubmissions: formSubmissionCount,
    leadsCreated,
    dealsCreated,
    ordersCompleted,
    formToLeadRate: formSubmissionCount > 0 ? (leadsCreated / formSubmissionCount) * 100 : 0,
    leadToDealRate: leadsCreated > 0 ? (dealsCreated / leadsCreated) * 100 : 0,
    dealToOrderRate: dealsCreated > 0 ? (ordersCompleted / dealsCreated) * 100 : 0,
    overallConversionRate: formSubmissionCount > 0 ? (ordersCompleted / formSubmissionCount) * 100 : 0,
  };

  // ---- Build lead lookup for attribution inheritance ----
  const leadById = new Map<string, LeadRecord>();
  for (const lead of allLeads) {
    if (lead.id) { leadById.set(lead.id, lead); }
  }

  // ---- Revenue by Source (utm_source) ----
  const sourceMap = new Map<string, { revenue: number; orders: number; deals: number; leads: number }>();

  function getOrCreateSource(source: string) {
    const existing = sourceMap.get(source);
    if (existing) { return existing; }
    const entry = { revenue: 0, orders: 0, deals: 0, leads: 0 };
    sourceMap.set(source, entry);
    return entry;
  }

  let totalAttributedRevenue = 0;
  let totalUnattributedRevenue = 0;

  // Count leads by source
  for (const lead of leads) {
    const source = lead.utmSource ?? lead.source ?? '';
    if (source) {
      getOrCreateSource(source).leads++;
    }
  }

  // Count deals by source (inherit from lead if needed)
  for (const deal of closedWonDeals) {
    let source = deal.source ?? '';
    if (!source && deal.leadId) {
      const parentLead = leadById.get(deal.leadId);
      source = parentLead?.utmSource ?? parentLead?.source ?? '';
    }
    const value = Number(deal.value) || Number(deal.amount) || 0;
    if (source) {
      const entry = getOrCreateSource(source);
      entry.deals++;
      entry.revenue += value;
      totalAttributedRevenue += value;
    } else {
      totalUnattributedRevenue += value;
    }
  }

  // Count orders by source
  for (const order of completedOrders) {
    let source = order.utmSource ?? order.attributionSource ?? '';
    if (!source && order.leadId) {
      const parentLead = leadById.get(order.leadId);
      source = parentLead?.utmSource ?? parentLead?.source ?? '';
    }
    const value = Number(order.total) || Number(order.amount) || 0;
    if (source) {
      const entry = getOrCreateSource(source);
      entry.orders++;
      entry.revenue += value;
      totalAttributedRevenue += value;
    } else {
      totalUnattributedRevenue += value;
    }
  }

  const bySource: SourceBreakdown[] = Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // ---- Revenue by Campaign (utm_campaign) ----
  const campaignMap = new Map<string, { revenue: number; leads: number; deals: number; orders: number }>();

  function getOrCreateCampaign(campaign: string) {
    const existing = campaignMap.get(campaign);
    if (existing) { return existing; }
    const entry = { revenue: 0, leads: 0, deals: 0, orders: 0 };
    campaignMap.set(campaign, entry);
    return entry;
  }

  for (const lead of leads) {
    if (lead.utmCampaign) {
      getOrCreateCampaign(lead.utmCampaign).leads++;
    }
  }

  for (const order of completedOrders) {
    let campaign = order.utmCampaign ?? '';
    if (!campaign && order.leadId) {
      const parentLead = leadById.get(order.leadId);
      campaign = parentLead?.utmCampaign ?? '';
    }
    if (campaign) {
      const entry = getOrCreateCampaign(campaign);
      entry.orders++;
      entry.revenue += Number(order.total) || Number(order.amount) || 0;
    }
  }

  const byCampaign: CampaignBreakdown[] = Array.from(campaignMap.entries())
    .map(([campaign, data]) => ({
      campaign,
      ...data,
      conversionRate: data.leads > 0 ? (data.orders / data.leads) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ---- Revenue by Medium (utm_medium) ----
  const mediumMap = new Map<string, { revenue: number; leads: number; deals: number; orders: number }>();

  function getOrCreateMedium(medium: string) {
    const existing = mediumMap.get(medium);
    if (existing) { return existing; }
    const entry = { revenue: 0, leads: 0, deals: 0, orders: 0 };
    mediumMap.set(medium, entry);
    return entry;
  }

  for (const lead of leads) {
    if (lead.utmMedium) {
      getOrCreateMedium(lead.utmMedium).leads++;
    }
  }

  for (const order of completedOrders) {
    let medium = order.utmMedium ?? '';
    if (!medium && order.leadId) {
      const parentLead = leadById.get(order.leadId);
      medium = parentLead?.utmMedium ?? '';
    }
    if (medium) {
      const entry = getOrCreateMedium(medium);
      entry.orders++;
      entry.revenue += Number(order.total) || Number(order.amount) || 0;
    }
  }

  const byMedium: MediumBreakdown[] = Array.from(mediumMap.entries())
    .map(([medium, data]) => ({ medium, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    success: true,
    period,
    totalAttributedRevenue,
    totalUnattributedRevenue,
    funnel,
    bySource,
    byCampaign,
    byMedium,
    topPerformingSource: bySource[0]?.source ?? 'none',
    topPerformingCampaign: byCampaign[0]?.campaign ?? 'none',
  };
}
