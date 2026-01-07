import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { withCache } from '@/lib/cache/analytics-cache';

/**
 * GET /api/analytics/revenue - Get revenue analytics
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/revenue');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = searchParams.get('period') || '30d';

    if (!orgId) {
      return errors.badRequest('orgId is required');
    }

    // Use caching for analytics queries
    const analytics = await withCache(
      orgId,
      'revenue',
      async () => calculateRevenueAnalytics(orgId, period),
      { period }
    );

    logger.info('Revenue analytics retrieved', { 
      route: '/api/analytics/revenue',
      orgId, 
      period,
      totalRevenue: analytics.totalRevenue,
    });

    return NextResponse.json(analytics);
  } catch (error: any) {
    logger.error('Revenue analytics error', error, { route: '/api/analytics/revenue' });
    return errors.internal('Failed to generate revenue analytics', error);
  }
}

/**
 * Calculate revenue analytics (extracted for caching)
 */
async function calculateRevenueAnalytics(orgId: string, period: string) {
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

    // Get deals from Firestore with date filtering for better performance
    const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/deals`;
    let allDeals: any[] = [];
    
    try {
      // Fetch with reasonable constraints to prevent timeout
      // Note: For analytics, we need all matching records to calculate totals
      // If org has 10,000+ deals, consider implementing background jobs for analytics
      const constraints: any[] = [
        // Limit to won/closed deals to reduce data fetched
        // Multiple status checks would require OR queries (not supported in single query)
        // So we fetch all and filter - consider indexing if performance becomes an issue
      ];
      allDeals = await FirestoreService.getAll(dealsPath, constraints);
    } catch (e) {
      logger.debug('No deals collection yet', { orgId });
    }

    // Filter by date and status
    const closedDeals = allDeals.filter(deal => {
      const isWon = deal.status === 'won' || deal.status === 'closed_won' || deal.stage === 'closed_won';
      if (!isWon) {return false;}
      
      const closedDate = deal.closedDate?.toDate?.() || (deal.closedDate ? new Date(deal.closedDate) : deal.createdAt?.toDate?.() || new Date(deal.createdAt));
      return closedDate >= startDate && closedDate <= now;
    });

    // Get orders (e-commerce)
    const ordersPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/orders`;
    let allOrders: any[] = [];
    
    try {
      allOrders = await FirestoreService.getAll(ordersPath, []);
    } catch (e) {
      logger.debug('No orders collection yet', { orgId });
    }

    const completedOrders = allOrders.filter(order => {
      if (order.status !== 'completed' && order.status !== 'paid') {return false;}
      const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });

    // Calculate totals
    const dealRevenue = closedDeals.reduce((sum, deal) => sum + (parseFloat(deal.value) || parseFloat(deal.amount) || 0), 0);
    const orderRevenue = completedOrders.reduce((sum, order) => sum + (parseFloat(order.total) || parseFloat(order.amount) || 0), 0);
    const totalRevenue = dealRevenue + orderRevenue;
    const dealsCount = closedDeals.length + completedOrders.length;
    const avgDealSize = dealsCount > 0 ? totalRevenue / dealsCount : 0;

    // Calculate growth (compare to previous period)
    let growth = 0;
    if (period !== 'all') {
      const periodMs = now.getTime() - startDate.getTime();
      const prevStart = new Date(startDate.getTime() - periodMs);
      const prevEnd = startDate;

      const prevDeals = allDeals.filter(deal => {
        const isWon = deal.status === 'won' || deal.status === 'closed_won' || deal.stage === 'closed_won';
        if (!isWon) {return false;}
        const closedDate = deal.closedDate?.toDate?.() || (deal.closedDate ? new Date(deal.closedDate) : deal.createdAt?.toDate?.() || new Date(deal.createdAt));
        return closedDate >= prevStart && closedDate < prevEnd;
      });

      const prevOrders = allOrders.filter(order => {
        if (order.status !== 'completed' && order.status !== 'paid') {return false;}
        const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
        return orderDate >= prevStart && orderDate < prevEnd;
      });

      const prevRevenue = prevDeals.reduce((sum, d) => sum + (parseFloat(d.value) || parseFloat(d.amount) || 0), 0)
        + prevOrders.reduce((sum, o) => sum + (parseFloat(o.total) || parseFloat(o.amount) || 0), 0);

      if (prevRevenue > 0) {
        growth = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
      } else if (totalRevenue > 0) {
        growth = 100; // All new revenue
      }
    }

    // Calculate MRR (Monthly Recurring Revenue from subscriptions)
    const subscriptions = allDeals.filter(d => d.type === 'subscription' || d.isRecurring);
    const mrr = subscriptions.reduce((sum, d) => sum + (parseFloat(d.mrr) || parseFloat(d.value) / 12 || 0), 0);

    // Revenue by source
    const sourceMap = new Map<string, number>();
    closedDeals.forEach(deal => {
      const source = deal.source || deal.lead_source || 'direct';
      const value = parseFloat(deal.value) || parseFloat(deal.amount) || 0;
      sourceMap.set(source, (sourceMap.get(source) || 0) + value);
    });
    completedOrders.forEach(order => {
      const source = order.source || 'ecommerce';
      const value = parseFloat(order.total) || parseFloat(order.amount) || 0;
      sourceMap.set(source, (sourceMap.get(source) || 0) + value);
    });
    const bySource = Array.from(sourceMap.entries())
      .map(([source, revenue]) => ({ source, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by product (from line items)
    const productMap = new Map<string, number>();
    closedDeals.forEach(deal => {
      if (deal.products && Array.isArray(deal.products)) {
        deal.products.forEach((p: any) => {
          const name = p.name || p.productName || 'Unknown Product';
          const value = (parseFloat(p.price) || 0) * (p.quantity || 1);
          productMap.set(name, (productMap.get(name) || 0) + value);
        });
      } else if (deal.productName || deal.product) {
        const name = deal.productName || deal.product;
        const value = parseFloat(deal.value) || parseFloat(deal.amount) || 0;
        productMap.set(name, (productMap.get(name) || 0) + value);
      }
    });
    completedOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const name = item.productName || item.name || 'Unknown Product';
          const value = (parseFloat(item.price) || 0) * (item.quantity || 1);
          productMap.set(name, (productMap.get(name) || 0) + value);
        });
      }
    });
    const byProduct = Array.from(productMap.entries())
      .map(([product, revenue]) => ({ product, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by sales rep
    const repMap = new Map<string, { revenue: number; deals: number; name: string }>();
    closedDeals.forEach(deal => {
      const repId = deal.assignedTo || deal.ownerId || deal.owner || 'unassigned';
      const repName = deal.assignedToName || deal.ownerName || deal.owner || 'Unassigned';
      const value = parseFloat(deal.value) || parseFloat(deal.amount) || 0;
      const existing = repMap.get(repId) ?? { revenue: 0, deals: 0, name: repName };
      repMap.set(repId, {
        revenue: existing.revenue + value,
        deals: existing.deals + 1,
        name: typeof repName === 'string' ? repName : repId,
      });
    });
    const byRep = Array.from(repMap.entries())
      .map(([id, data]) => ({
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
