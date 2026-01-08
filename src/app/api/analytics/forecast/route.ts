import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/analytics/forecast - Get sales forecast
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: 'month' | 'quarter' | 'year' (optional, default: 'month')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/forecast');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = (searchParams.get('period') !== '' && searchParams.get('period') != null) 
      ? searchParams.get('period') 
      : 'month';

    if (!orgId) {
      return errors.badRequest('orgId is required');
    }

    // Get open deals from Firestore
    const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/deals`;
    let allDeals: any[] = [];
    
    try {
      allDeals = await FirestoreService.getAll(dealsPath, []);
    } catch (_e) {
      logger.debug('No deals collection yet', { orgId });
    }

    // Filter to open deals (still in pipeline)
    const openStatuses = ['open', 'new', 'qualified', 'proposal', 'negotiation', 'pending', 'in_progress'];
    const openDeals = allDeals.filter(deal => {
      const status = (deal.status !== '' && deal.status != null) 
        ? deal.status 
        : (deal.stage !== '' && deal.stage != null) 
          ? deal.stage 
          : '';
      const statusLower = status.toLowerCase();
      return openStatuses.some(s => statusLower.includes(s));
    });

    // Calculate weighted forecast (value × probability)
    const weightedForecast = openDeals.reduce((sum, deal) => {
      const value = parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0;
      const probability = parseFloat(deal.probability) ?? 50; // Default 50%
      return sum + (value * probability / 100);
    }, 0);

    // Best case (all deals at 100%)
    const bestCase = openDeals.reduce((sum, deal) => 
      sum + (parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0), 0);

    // Worst case (only high probability deals)
    const worstCase = openDeals
      .filter(deal => (parseFloat(deal.probability) ?? 50) >= 75)
      .reduce((sum, deal) => sum + (parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0), 0);

    // Confidence based on deal quality
    const avgProbability = openDeals.length > 0
      ? openDeals.reduce((sum, d) => sum + (parseFloat(d.probability) ?? 50), 0) / openDeals.length
      : 0;
    const confidence = Math.round(Math.min(100, avgProbability * 1.2));

    // Forecast by close date
    const now = new Date();
    const periodEnd = new Date();
    switch (period) {
      case 'month':
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
      case 'quarter':
        periodEnd.setMonth(periodEnd.getMonth() + 3);
        break;
      case 'year':
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        break;
    }

    const dealsClosingInPeriod = openDeals.filter(deal => {
      const closeDate = deal.expectedCloseDate?.toDate?.() 
                        ?? deal.closeDate?.toDate?.() 
                        ?? (deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null) 
                        ?? (deal.closeDate ? new Date(deal.closeDate) : null);
      return closeDate && closeDate >= now && closeDate <= periodEnd;
    });

    const forecastInPeriod = dealsClosingInPeriod.reduce((sum, deal) => {
      const value = parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0;
      const probability = parseFloat(deal.probability) ?? 50;
      return sum + (value * probability / 100);
    }, 0);

    // By sales rep
    const repMap = new Map<string, { forecast: number; deals: number; name: string }>();
    openDeals.forEach(deal => {
      const repId = (deal.assignedTo !== '' && deal.assignedTo != null) 
        ? deal.assignedTo 
        : (deal.ownerId !== '' && deal.ownerId != null) 
          ? deal.ownerId 
          : 'unassigned';
      const repName = (deal.assignedToName !== '' && deal.assignedToName != null) 
        ? deal.assignedToName 
        : (deal.ownerName !== '' && deal.ownerName != null) 
          ? deal.ownerName 
          : 'Unassigned';
      const value = parseFloat(deal.value) ?? parseFloat(deal.amount) ?? 0;
      const probability = parseFloat(deal.probability) ?? 50;
      const weighted = value * probability / 100;
      
      const existing = repMap.get(repId) ?? { forecast: 0, deals: 0, name: repName };
      repMap.set(repId, {
        forecast: existing.forecast + weighted,
        deals: existing.deals + 1,
        name: typeof repName === 'string' ? repName : repId,
      });
    });

    const byRep = Array.from(repMap.entries())
      .map(([repId, data]) => ({
        repId,
        repName: data.name,
        forecastedRevenue: Math.round(data.forecast),
        openDeals: data.deals,
      }))
      .sort((a, b) => b.forecastedRevenue - a.forecastedRevenue);

    // Risk factors
    const factors: any[] = [];
    
    // Check for large deals
    const largeDeals = openDeals.filter(d => (parseFloat(d.value) ?? 0) > 10000);
    if (largeDeals.length > 0) {
      factors.push({
        factor: 'Large deals in pipeline',
        impact: 'positive',
        description: `${largeDeals.length} deals over $10,000`,
      });
    }

    // Check for stale deals
    const staleDeals = openDeals.filter(d => {
      const updated = d.updatedAt?.toDate?.() ?? new Date(d.updatedAt);
      return (now.getTime() - updated.getTime()) > 30 * 24 * 60 * 60 * 1000;
    });
    if (staleDeals.length > 0) {
      factors.push({
        factor: 'Stale deals',
        impact: 'negative',
        description: `${staleDeals.length} deals not updated in 30+ days`,
      });
    }

    // High probability deals
    const highProbDeals = openDeals.filter(d => (parseFloat(d.probability) ?? 50) >= 75);
    if (highProbDeals.length > 0) {
      factors.push({
        factor: 'High probability deals',
        impact: 'positive',
        description: `${highProbDeals.length} deals at 75%+ probability`,
      });
    }

    return NextResponse.json({
      success: true,
      forecast: {
        period,
        forecastedRevenue: Math.round(weightedForecast),
        forecastInPeriod: Math.round(forecastInPeriod),
        confidence,
        scenarios: {
          bestCase: Math.round(bestCase),
          likely: Math.round(weightedForecast),
          worstCase: Math.round(worstCase),
        },
        totalOpenDeals: openDeals.length,
        dealsClosingInPeriod: dealsClosingInPeriod.length,
        byRep,
        factors,
      },
    });
  } catch (error: any) {
    logger.error('Error getting sales forecast', error, { route: '/api/analytics/forecast' });
    return errors.database('Failed to get sales forecast', error);
  }
}
