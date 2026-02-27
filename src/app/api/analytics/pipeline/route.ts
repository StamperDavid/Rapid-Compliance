import { NextResponse, type NextRequest } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getDealsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { withCache } from '@/lib/cache/analytics-cache';
import { requireAuth } from '@/lib/auth/api-auth';
import { limit } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

/**
 * Safe parseFloat that handles NaN correctly.
 * parseFloat(undefined) returns NaN, and NaN ?? fallback returns NaN (not the fallback).
 * This function properly returns the fallback when the input cannot be parsed.
 */
function safeParseFloat(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {return fallback;}
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Convert various date representations to a Date object.
 * Handles Firestore Timestamp objects, Date instances, strings, and numbers.
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
interface StageHistoryEntry {
  stage?: string;
  timestamp?: { toDate?: () => Date } | Date | string;
}

interface DealRecord {
  id?: string;
  status?: string;
  stage?: string;
  value?: string | number;
  amount?: string | number;
  createdAt?: { toDate?: () => Date } | Date | string;
  updatedAt?: { toDate?: () => Date } | Date | string;
  closedDate?: { toDate?: () => Date } | Date | string;
  closedAt?: { toDate?: () => Date } | Date | string;
  stageHistory?: StageHistoryEntry[];
}

/**
 * GET /api/analytics/pipeline - Get pipeline analytics
 *
 * Authentication: Required - Valid session token must be provided
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: 'current')
 *
 * Response codes:
 * - 200: Success - Returns pipeline analytics data
 * - 401: Unauthorized - No valid authentication token provided
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/pipeline');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period = (periodParam !== '' && periodParam != null) ? periodParam : '30d';

    // Use caching for analytics queries (TTL: 10 minutes)
    const analytics = await withCache(
      'pipeline',
      async () => calculatePipelineAnalytics(period),
      { period }
    );

    logger.info('Pipeline analytics retrieved', {
      route: '/api/analytics/pipeline',
      period,
      dealsCount: analytics.dealsCount,
    });

    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting pipeline analytics', error instanceof Error ? error : new Error(String(error)), { route: '/api/analytics/pipeline' });
    return errors.database('Failed to get pipeline analytics', error instanceof Error ? error : new Error(message));
  }
}

/**
 * Calculate pipeline analytics (extracted for caching)
 */
async function calculatePipelineAnalytics(_period: string) {
  // Get all deals from Firestore (pipeline is a current snapshot — no date filter
  // is applied because old-but-still-open deals must be included regardless of age)
  const dealsPath = getDealsCollection();
  let allDeals: DealRecord[] = [];
  const QUERY_LIMIT = 1000;

  try {
    allDeals = (await AdminFirestoreService.getAll(dealsPath, [limit(QUERY_LIMIT)])) as DealRecord[];
    if (allDeals.length === QUERY_LIMIT) {
      logger.warn('Pipeline analytics hit query limit', { limit: QUERY_LIMIT });
    }
  } catch (_e) {
    logger.debug('No deals collection yet');
  }

    // Define open statuses (deals still in pipeline)
    const openStatuses = ['open', 'new', 'qualified', 'proposal', 'negotiation', 'pending', 'in_progress'];
    const wonStatuses = ['won', 'closed_won'];
    const lostStatuses = ['lost', 'closed_lost'];

    // Filter to open deals (in pipeline)
    const openDeals = allDeals.filter(deal => {
      const status = (deal.status !== '' && deal.status != null) 
        ? deal.status 
        : (deal.stage !== '' && deal.stage != null) 
          ? deal.stage 
          : '';
      const statusLower = status.toLowerCase();
      return openStatuses.some(s => statusLower.includes(s)) || 
             (!wonStatuses.some(s => statusLower.includes(s)) && !lostStatuses.some(s => statusLower.includes(s)));
    });

    // Calculate pipeline totals
    const totalValue = openDeals.reduce((sum, deal) => {
      const value = safeParseFloat(deal.value, 0) || safeParseFloat(deal.amount, 0);
      return sum + value;
    }, 0);
    const dealsCount = openDeals.length;
    const avgDealSize = dealsCount > 0 ? totalValue / dealsCount : 0;

    // Calculate win rate from closed deals
    const closedDeals = allDeals.filter(deal => {
      const status = (deal.status !== '' && deal.status != null) 
        ? deal.status 
        : (deal.stage !== '' && deal.stage != null) 
          ? deal.stage 
          : '';
      const statusLower = status.toLowerCase();
      return wonStatuses.some(s => statusLower.includes(s)) || lostStatuses.some(s => statusLower.includes(s));
    });
    
    const wonDeals = closedDeals.filter(deal => {
      const status = (deal.status !== '' && deal.status != null) 
        ? deal.status 
        : (deal.stage !== '' && deal.stage != null) 
          ? deal.stage 
          : '';
      const statusLower = status.toLowerCase();
      return wonStatuses.some(s => statusLower.includes(s));
    });
    
    const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0;

    // Pipeline by stage
    const stageOrder = ['new', 'qualified', 'proposal', 'negotiation', 'pending', 'closed'];
    const stageLabels: Record<string, string> = {
      'new': 'New Lead',
      'qualified': 'Qualified',
      'proposal': 'Proposal Sent',
      'negotiation': 'Negotiation',
      'pending': 'Pending Close',
      'won': 'Won',
      'closed_won': 'Won',
      'lost': 'Lost',
      'closed_lost': 'Lost',
    };

    const stageMap = new Map<string, { value: number; count: number }>();
    
    openDeals.forEach(deal => {
      const stage = (deal.stage !== '' && deal.stage != null) 
        ? deal.stage 
        : (deal.status !== '' && deal.status != null) 
          ? deal.status
          : 'new';
      const stageLower = stage.toLowerCase();
      const value = safeParseFloat(deal.value, 0) || safeParseFloat(deal.amount, 0);
      const existing = stageMap.get(stageLower) ?? { value: 0, count: 0 };
      stageMap.set(stageLower, {
        value: existing.value + value,
        count: existing.count + 1,
      });
    });

    // Convert to array and sort by stage order
    const byStage = Array.from(stageMap.entries())
      .map(([stageKey, data]) => ({
        stage: stageLabels[stageKey] ?? (stageKey.charAt(0).toUpperCase() + stageKey.slice(1)),
        stageKey,
        value: data.value,
        count: data.count,
        avgDealSize: data.count > 0 ? data.value / data.count : 0,
      }))
      .sort((a, b) => {
        const aIndex = stageOrder.findIndex(s => a.stageKey.includes(s));
        const bIndex = stageOrder.findIndex(s => b.stageKey.includes(s));
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

    // Calculate velocity (average days to close)
    const salesCycles = wonDeals.map(deal => {
      const createdAt = toDate(deal.createdAt);
      const closedAt = toDate(deal.closedDate) || toDate(deal.closedAt) || toDate(deal.updatedAt);
      const days = Math.ceil((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, days); // At least 1 day
    });
    const avgSalesCycle = salesCycles.length > 0 
      ? Math.round(salesCycles.reduce((sum, d) => sum + d, 0) / salesCycles.length)
      : 0;

    // Conversion funnel
    const funnelStages = ['new', 'qualified', 'proposal', 'negotiation', 'won'];
    const conversionRates: { fromStage: string; toStage: string; rate: number }[] = [];

    for (let i = 0; i < funnelStages.length - 1; i++) {
      const fromStage = funnelStages[i];
      const toStage = funnelStages[i + 1];
      
      // Count deals that passed through each stage
      const fromCount = allDeals.filter(d => {
        const history = d.stageHistory ?? [];
        const currentStage = (d.stage !== '' && d.stage != null) 
          ? d.stage 
          : (d.status !== '' && d.status != null) 
            ? d.status 
            : '';
        const currentStageLower = currentStage.toLowerCase();
        const inHistory = history.some((h: StageHistoryEntry) => h.stage?.toLowerCase() === fromStage) ?? false;
        const isCurrent = currentStageLower === fromStage;
        const isPastStage = funnelStages.indexOf(currentStageLower) > i;
        return [inHistory, isCurrent, isPastStage].some(Boolean);
      }).length;

      const toCount = allDeals.filter(d => {
        const history = d.stageHistory ?? [];
        const currentStage = (d.stage !== '' && d.stage != null) 
          ? d.stage 
          : (d.status !== '' && d.status != null) 
            ? d.status 
            : '';
        const currentStageLower = currentStage.toLowerCase();
        const inHistory = history.some((h: StageHistoryEntry) => h.stage?.toLowerCase() === toStage) ?? false;
        const isCurrent = currentStageLower === toStage;
        const isPastStage = funnelStages.indexOf(currentStageLower) > i + 1;
        return [inHistory, isCurrent, isPastStage].some(Boolean);
      }).length;

      const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
      
      conversionRates.push({
        fromStage: stageLabels[fromStage] ?? fromStage,
        toStage: stageLabels[toStage] ?? toStage,
        rate: Math.round(rate),
      });
    }

    return {
      success: true,
      totalValue,
      dealsCount,
      avgDealSize,
      winRate: Math.round(winRate * 10) / 10,
      avgSalesCycle,
      byStage,
      conversionRates,
      velocity: {
        avgDaysToClose: avgSalesCycle,
        totalDeals: wonDeals.length,
      },
    };
}
