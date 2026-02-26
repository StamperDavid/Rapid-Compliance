import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { COLLECTIONS, getOrdersCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { withCache } from '@/lib/cache/analytics-cache';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { where, limit, orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

/**
 * Helper function to convert various date formats to Date object
 */
function toDate(value: unknown): Date {
  if (!value) {return new Date();}
  if (value instanceof Date) {return value;}
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}

/**
 * GET /api/analytics/revenue - Get revenue analytics
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/revenue');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period = (periodParam !== '' && periodParam != null) ? periodParam : '30d';

    // Use caching for analytics queries
    const analytics = await withCache(
      'revenue',
      async () => calculateRevenueAnalytics(period),
      { period }
    );

    logger.info('Revenue analytics retrieved', {
      route: '/api/analytics/revenue',
      period,
      totalRevenue: analytics.totalRevenue,
    });

    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Revenue analytics error', error instanceof Error ? error : new Error(String(error)), { route: '/api/analytics/revenue' });
    return errors.internal('Failed to generate revenue analytics', error instanceof Error ? error : new Error(message));
  }
}

/**
 * Calculate revenue analytics (extracted for caching)
 */
async function calculateRevenueAnalytics(period: string) {
  // Calculate date range based on period
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
      startDate = new Date('2020-01-01'); // Far enough back
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

    // Deal record from Firestore
    interface DealRecord {
      status?: string;
      stage?: string;
      closedDate?: { toDate?: () => Date } | Date | string;
      createdAt?: { toDate?: () => Date } | Date | string;
      value?: string | number;
      amount?: string | number;
      type?: string;
      isRecurring?: boolean;
      mrr?: number;
      source?: string;
      lead_source?: string;
      products?: Array<{ name?: string; productName?: string; price?: string | number; quantity?: number }>;
      productName?: string;
      product?: string;
      assignedTo?: string;
      ownerId?: string;
      owner?: string;
      assignedToName?: string;
      ownerName?: string;
    }
    
    // Order record from Firestore
    interface OrderRecord {
      status?: string;
      createdAt?: { toDate?: () => Date } | Date | string;
      total?: string | number;
      amount?: string | number;
      refundedAmount?: string | number;
      source?: string;
      items?: Array<{ name?: string; productName?: string; price?: string | number; quantity?: number }>;
    }
    
    // Determine the query window: must cover both the current period AND the previous
    // period (needed for growth calculation). For 'all', there is no previous period.
    const QUERY_LIMIT = 1000;
    const periodMs = now.getTime() - startDate.getTime();
    // queryStart reaches back one additional period so the growth comparison window
    // is also covered by the same Firestore query.
    const queryStart = period !== 'all'
      ? new Date(startDate.getTime() - periodMs)
      : startDate;

    // Get deals from Firestore scoped to the extended query window
    const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/default/entities/deals`;
    let allDeals: DealRecord[] = [];

    try {
      const dealsConstraints = [
        where('createdAt', '>=', queryStart),
        orderBy('createdAt', 'desc'),
        limit(QUERY_LIMIT),
      ];
      allDeals = (await AdminFirestoreService.getAll(dealsPath, dealsConstraints)) as DealRecord[];
      if (allDeals.length === QUERY_LIMIT) {
        logger.warn('Revenue analytics deals query hit limit', { limit: QUERY_LIMIT, period });
      }
    } catch (_e) {
      logger.debug('No deals collection yet');
    }

    // Filter by date and status (in-memory partitioning within the query window)
    const closedDeals = allDeals.filter(deal => {
      const isWon = deal.status === 'won' || deal.status === 'closed_won' || deal.stage === 'closed_won';
      if (!isWon) {return false;}

      const closedDate = toDate(deal.closedDate) || toDate(deal.createdAt);
      return closedDate >= startDate && closedDate <= now;
    });

    // Get orders (e-commerce) scoped to the extended query window
    const ordersPath = getOrdersCollection();
    let allOrders: OrderRecord[] = [];

    try {
      const ordersConstraints = [
        where('createdAt', '>=', queryStart),
        orderBy('createdAt', 'desc'),
        limit(QUERY_LIMIT),
      ];
      allOrders = (await AdminFirestoreService.getAll(ordersPath, ordersConstraints)) as OrderRecord[];
      if (allOrders.length === QUERY_LIMIT) {
        logger.warn('Revenue analytics orders query hit limit', { limit: QUERY_LIMIT, period });
      }
    } catch (_e) {
      logger.debug('No orders collection yet');
    }

    // MAJ-9: Include all revenue-generating statuses
    const revenueOrders = allOrders.filter(order => {
      const validStatuses = ['completed', 'paid', 'processing', 'partially_refunded'];
      if (!validStatuses.includes(order.status ?? '')) {return false;}
      const orderDate = toDate(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });

    // Calculate totals
    const dealRevenue = closedDeals.reduce((sum, deal) => sum + (Number(deal.value) || Number(deal.amount) || 0), 0);
    // MAJ-10: Subtract refunded amounts from order revenue
    const orderRevenue = revenueOrders.reduce((sum, order) => {
      const gross = Number(order.total) || Number(order.amount) || 0;
      const refunded = Number(order.refundedAmount) || 0;
      return sum + (gross - refunded);
    }, 0);
    const totalRevenue = dealRevenue + orderRevenue;
    const dealsCount = closedDeals.length + revenueOrders.length;
    const avgDealSize = dealsCount > 0 ? totalRevenue / dealsCount : 0;

    // Calculate growth (compare to previous period)
    let growth = 0;
    if (period !== 'all') {
      const prevStart = new Date(startDate.getTime() - periodMs);
      const prevEnd = startDate;

      const prevDeals = allDeals.filter(deal => {
        const isWon = deal.status === 'won' || deal.status === 'closed_won' || deal.stage === 'closed_won';
        if (!isWon) {return false;}
        const closedDate = toDate(deal.closedDate) || toDate(deal.createdAt);
        return closedDate >= prevStart && closedDate < prevEnd;
      });

      const prevOrders = allOrders.filter(order => {
        const validStatuses = ['completed', 'paid', 'processing', 'partially_refunded'];
        if (!validStatuses.includes(order.status ?? '')) {return false;}
        const orderDate = toDate(order.createdAt);
        return orderDate >= prevStart && orderDate < prevEnd;
      });

      const prevRevenue = prevDeals.reduce((sum, d) => sum + (Number(d.value) || Number(d.amount) || 0), 0)
        + prevOrders.reduce((sum, o) => sum + (Number(o.total) || Number(o.amount) || 0), 0);

      if (prevRevenue > 0) {
        growth = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
      } else if (totalRevenue > 0) {
        growth = 100; // All new revenue
      }
    }

    // Calculate MRR (Monthly Recurring Revenue from subscriptions)
    const subscriptions = allDeals.filter(d => d.type === 'subscription' || d.isRecurring);
    const mrr = subscriptions.reduce((sum, d) => sum + (Number(d.mrr) || Number(d.value) / 12 || 0), 0);

    // Revenue by source
    const sourceMap = new Map<string, number>();
    closedDeals.forEach(deal => {
      const source = (deal.source !== '' && deal.source != null) ? deal.source : ((deal.lead_source !== '' && deal.lead_source != null) ? deal.lead_source : 'direct');
      const value = Number(deal.value) || Number(deal.amount) || 0;
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + value);
    });
    revenueOrders.forEach(order => {
      const source = (order.source !== '' && order.source != null) ? order.source : 'ecommerce';
      const value = Number(order.total) || Number(order.amount) || 0;
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + value);
    });
    const bySource = Array.from(sourceMap.entries())
      .map(([source, revenue]) => ({ source, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by product (from line items)
    interface ProductItem {
      name?: string;
      productName?: string;
      price?: string | number;
      quantity?: number;
    }
    
    const productMap = new Map<string, number>();
    closedDeals.forEach(deal => {
      if (deal.products && Array.isArray(deal.products)) {
        (deal.products as ProductItem[]).forEach((p) => {
          const name = (p.name !== '' && p.name != null) ? p.name : ((p.productName !== '' && p.productName != null) ? p.productName : 'Unknown Product');
          const value = (Number(p.price) || 0) * (p.quantity ?? 1);
          productMap.set(name, (productMap.get(name) ?? 0) + value);
        });
      } else if (deal.productName || deal.product) {
        const name = deal.productName ?? deal.product ?? 'Unknown Product';
        const value = Number(deal.value) || Number(deal.amount) || 0;
        productMap.set(name, (productMap.get(name) ?? 0) + value);
      }
    });
    revenueOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        (order.items as ProductItem[]).forEach((item) => {
          const name = (item.productName !== '' && item.productName != null) ? item.productName : ((item.name !== '' && item.name != null) ? item.name : 'Unknown Product');
          const value = (Number(item.price) || 0) * (item.quantity ?? 1);
          productMap.set(name, (productMap.get(name) ?? 0) + value);
        });
      }
    });
    const byProduct = Array.from(productMap.entries())
      .map(([product, revenue]) => ({ product, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by sales rep
    const repMap = new Map<string, { revenue: number; deals: number; name: string }>();
    closedDeals.forEach(deal => {
      const repId = (deal.assignedTo !== '' && deal.assignedTo != null) ? deal.assignedTo : ((deal.ownerId !== '' && deal.ownerId != null) ? deal.ownerId : ((deal.owner !== '' && deal.owner != null) ? deal.owner : 'unassigned'));
      const repName = (deal.assignedToName !== '' && deal.assignedToName != null) ? deal.assignedToName : ((deal.ownerName !== '' && deal.ownerName != null) ? deal.ownerName : ((deal.owner !== '' && deal.owner != null) ? deal.owner : 'Unassigned'));
      const value = Number(deal.value) || Number(deal.amount) || 0;
      const existing = repMap.get(repId) ?? { revenue: 0, deals: 0, name: repName };
      repMap.set(repId, {
        revenue: existing.revenue + value,
        deals: existing.deals + 1,
        name: typeof repName === 'string' ? repName : repId,
      });
    });
    const byRep = Array.from(repMap.entries())
      .map(([_id, data]) => ({
        rep: data.name,
        revenue: data.revenue,
        deals: data.deals,
        avgDeal: data.deals > 0 ? data.revenue / data.deals : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      success: true,
      totalRevenue,
      dealsCount,
      avgDealSize,
      mrr,
      growth,
      bySource,
      byProduct,
      byRep,
    };
}
