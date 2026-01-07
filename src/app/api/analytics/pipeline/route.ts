import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { withCache } from '@/lib/cache/analytics-cache';

/**
 * GET /api/analytics/pipeline - Get pipeline analytics
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: 'current')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/pipeline');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = (searchParams.get('period') !== '' && searchParams.get('period') != null) 
      ? searchParams.get('period') 
      : '30d';

    if (!orgId) {
      return errors.badRequest('orgId is required');
    }

    // Use caching for analytics queries (TTL: 10 minutes)
    const analytics = await withCache(
      orgId,
      'pipeline',
      async () => calculatePipelineAnalytics(orgId, period),
      { period }
    );

    logger.info('Pipeline analytics retrieved', {
      route: '/api/analytics/pipeline',
      orgId,
      period,
      dealsCount: analytics.dealsCount,
    });

    return NextResponse.json(analytics);
  } catch (error: any) {
    logger.error('Error getting pipeline analytics', error, { route: '/api/analytics/pipeline' });
    return errors.database('Failed to get pipeline analytics', error);
  }
}

/**
 * Calculate pipeline analytics (extracted for caching)
 */
async function calculatePipelineAnalytics(orgId: string, period: string) {
  // Get all deals from Firestore
  const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/deals`;
  let allDeals: any[] = [];
  
  try {
    allDeals = await FirestoreService.getAll(dealsPath, []);
  } catch (e) {
    logger.debug('No deals collection yet', { orgId });
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
      const value = parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0;
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
      const value = parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0;
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
      const createdAt = deal.createdAt?.toDate?.() ?? new Date(deal.createdAt);
      const closedAt = deal.closedDate?.toDate?.() 
        ?? deal.closedAt?.toDate?.() 
        ?? new Date(deal.closedDate ?? deal.closedAt ?? deal.updatedAt);
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
        return history.some((h: any) => h.stage?.toLowerCase() === fromStage) || 
               currentStageLower === fromStage ||
               funnelStages.indexOf(currentStageLower) > i;
      }).length;

      const toCount = allDeals.filter(d => {
        const history = d.stageHistory ?? [];
        const currentStage = (d.stage !== '' && d.stage != null) 
          ? d.stage 
          : (d.status !== '' && d.status != null) 
            ? d.status 
            : '';
        const currentStageLower = currentStage.toLowerCase();
        return history.some((h: any) => h.stage?.toLowerCase() === toStage) || 
               currentStageLower === toStage ||
               funnelStages.indexOf(currentStageLower) > i + 1;
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
