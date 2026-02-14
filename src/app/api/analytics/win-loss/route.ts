import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { withCache } from '@/lib/cache/analytics-cache';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { requireAuth } from '@/lib/auth/api-auth';
import { where, limit } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

/**
 * Helper to convert Firestore timestamps, Date objects, strings, or numbers to Date
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

// Local interfaces for Firestore records
interface DealRecord {
  id?: string;
  status?: string;
  stage?: string;
  value?: string | number;
  amount?: string | number;
  closedDate?: { toDate?: () => Date } | Date | string;
  closedAt?: { toDate?: () => Date } | Date | string;
  updatedAt?: { toDate?: () => Date } | Date | string;
  lostReason?: string;
  reason?: string;
  lossReason?: string;
  assignedTo?: string;
  ownerId?: string;
  assignedToName?: string;
  ownerName?: string;
  competitor?: string;
  lostToCompetitor?: string;
}

/**
 * GET /api/analytics/win-loss - Get win/loss analysis
 *
 * Authentication: Required - Valid session token must be provided
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '90d')
 *
 * Response codes:
 * - 200: Success - Returns win/loss analytics data
 * - 401: Unauthorized - No valid authentication token provided
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/win-loss');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period = (periodParam !== '' && periodParam != null) ? periodParam : '90d';

    // Use caching for analytics queries (TTL: 10 minutes)
    const analytics = await withCache(
      'win-loss',
      async () => calculateWinLossAnalytics(period),
      { period }
    );

    logger.info('Win/loss analytics retrieved', {
      route: '/api/analytics/win-loss',
      period,
      won: analytics.won,
      lost: analytics.lost,
    });

    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting win/loss analytics', error instanceof Error ? error : new Error(String(error)), { route: '/api/analytics/win-loss' });
    return errors.database('Failed to get win/loss analytics', error instanceof Error ? error : new Error(message));
  }
}

/**
 * Calculate win/loss analytics (extracted for caching)
 */
async function calculateWinLossAnalytics(period: string) {
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
      startDate = new Date('2020-01-01');
      break;
    default:
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  // Get deals from Firestore (with date range constraint for the requested period)
  const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/default/entities/deals`;
  let allDeals: DealRecord[] = [];
  const QUERY_LIMIT = 10000;

  try {
    // Only query deals that were updated/closed within the period
    const constraints = [
      where('updatedAt', '>=', startDate),
      limit(QUERY_LIMIT)
    ];
    allDeals = await FirestoreService.getAll(dealsPath, constraints);
    if (allDeals.length === QUERY_LIMIT) {
      logger.warn('Win-loss analytics hit query limit', { period, limit: QUERY_LIMIT });
    }
  } catch (_e) {
    logger.debug('No deals collection yet');
  }

    // Filter closed deals in period
    const wonStatuses = ['won', 'closed_won'];
    const lostStatuses = ['lost', 'closed_lost'];

    const closedDealsInPeriod = allDeals.filter(deal => {
      const status = ((deal.status ?? deal.stage) ?? '').toLowerCase();
      const isClosed = wonStatuses.some(s => status.includes(s)) || lostStatuses.some(s => status.includes(s));
      if (!isClosed) {return false;}

      const closedDate = toDate(deal.closedDate) || toDate(deal.closedAt) || toDate(deal.updatedAt);
      return closedDate >= startDate && closedDate <= now;
    });

    const wonDeals = closedDealsInPeriod.filter(deal => {
      const status = ((deal.status ?? deal.stage) ?? '').toLowerCase();
      return wonStatuses.some(s => status.includes(s));
    });

    const lostDeals = closedDealsInPeriod.filter(deal => {
      const status = ((deal.status ?? deal.stage) ?? '').toLowerCase();
      return lostStatuses.some(s => status.includes(s));
    });

    // Calculate metrics
    const totalDeals = closedDealsInPeriod.length;
    const winRate = totalDeals > 0 ? (wonDeals.length / totalDeals) * 100 : 0;

    // Revenue
    const wonRevenue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || Number(d.amount) || 0), 0);
    const lostRevenue = lostDeals.reduce((sum, d) => sum + (Number(d.value) || Number(d.amount) || 0), 0);

    // Average deal sizes
    const avgWonDeal = wonDeals.length > 0 ? wonRevenue / wonDeals.length : 0;
    const avgLostDeal = lostDeals.length > 0 ? lostRevenue / lostDeals.length : 0;

    // Loss reasons
    const reasonMap = new Map<string, { count: number; value: number }>();
    lostDeals.forEach(deal => {
      const reason = (deal.lostReason !== '' && deal.lostReason != null) ? deal.lostReason : ((deal.reason !== '' && deal.reason != null) ? deal.reason : ((deal.lossReason !== '' && deal.lossReason != null) ? deal.lossReason : 'No reason provided'));
      const value = Number(deal.value) || Number(deal.amount) || 0;
      const existing = reasonMap.get(reason) ?? { count: 0, value: 0 };
      reasonMap.set(reason, {
        count: existing.count + 1,
        value: existing.value + value,
      });
    });

    const lossReasons = Array.from(reasonMap.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value,
        percentage: lostDeals.length > 0 ? (data.count / lostDeals.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // By sales rep
    const repMap = new Map<string, { won: number; lost: number; wonValue: number; lostValue: number; name: string }>();
    closedDealsInPeriod.forEach(deal => {
      const repId = (deal.assignedTo !== '' && deal.assignedTo != null) ? deal.assignedTo : ((deal.ownerId !== '' && deal.ownerId != null) ? deal.ownerId : 'unassigned');
      const repName = (deal.assignedToName !== '' && deal.assignedToName != null) ? deal.assignedToName : ((deal.ownerName !== '' && deal.ownerName != null) ? deal.ownerName : 'Unassigned');
      const value = Number(deal.value) || Number(deal.amount) || 0;
      const status = ((deal.status ?? deal.stage) ?? '').toLowerCase();
      const isWon = wonStatuses.some(s => status.includes(s));
      
      const existing = repMap.get(repId) ?? { won: 0, lost: 0, wonValue: 0, lostValue: 0, name: repName };
      repMap.set(repId, {
        ...existing,
        name: typeof repName === 'string' ? repName : repId,
        won: existing.won + (isWon ? 1 : 0),
        lost: existing.lost + (isWon ? 0 : 1),
        wonValue: existing.wonValue + (isWon ? value : 0),
        lostValue: existing.lostValue + (isWon ? 0 : value),
      });
    });

    const byRep = Array.from(repMap.entries())
      .map(([repId, data]) => ({
        repId,
        repName: data.name,
        won: data.won,
        lost: data.lost,
        winRate: (data.won + data.lost) > 0 ? (data.won / (data.won + data.lost)) * 100 : 0,
        wonValue: data.wonValue,
        lostValue: data.lostValue,
      }))
      .sort((a, b) => b.winRate - a.winRate);

    // By competitor (if tracked)
    const competitorMap = new Map<string, { won: number; lost: number }>();
    closedDealsInPeriod.forEach(deal => {
      const competitor = (deal.competitor !== '' && deal.competitor != null) ? deal.competitor : deal.lostToCompetitor;
      if (competitor) {
        const status = ((deal.status ?? deal.stage) ?? '').toLowerCase();
        const isWon = wonStatuses.some(s => status.includes(s));
        const existing = competitorMap.get(competitor) ?? { won: 0, lost: 0 };
        competitorMap.set(competitor, {
          won: existing.won + (isWon ? 1 : 0),
          lost: existing.lost + (isWon ? 0 : 1),
        });
      }
    });

    const byCompetitor = Array.from(competitorMap.entries())
      .map(([competitor, data]) => ({
        competitor,
        won: data.won,
        lost: data.lost,
        winRate: (data.won + data.lost) > 0 ? (data.won / (data.won + data.lost)) * 100 : 0,
      }))
      .sort((a, b) => b.lost - a.lost);

    // Weekly trends
    const weeklyMap = new Map<string, { won: number; lost: number }>();
    closedDealsInPeriod.forEach(deal => {
      const closedDate = toDate(deal.closedDate) || toDate(deal.closedAt) || toDate(deal.updatedAt);
      const weekStart = new Date(closedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      const status = ((deal.status ?? deal.stage) ?? '').toLowerCase();
      const isWon = wonStatuses.some(s => status.includes(s));
      
      const existing = weeklyMap.get(weekKey) ?? { won: 0, lost: 0 };
      weeklyMap.set(weekKey, {
        won: existing.won + (isWon ? 1 : 0),
        lost: existing.lost + (isWon ? 0 : 1),
      });
    });

    const trends = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        won: data.won,
        lost: data.lost,
        winRate: (data.won + data.lost) > 0 ? (data.won / (data.won + data.lost)) * 100 : 0,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return {
      success: true,
      totalDeals,
      won: wonDeals.length,
      lost: lostDeals.length,
      winRate: Math.round(winRate * 10) / 10,
      wonRevenue,
      lostRevenue,
      avgWonDeal: Math.round(avgWonDeal),
      avgLostDeal: Math.round(avgLostDeal),
      lossReasons,
      byRep,
      byCompetitor,
      trends,
    };
}
