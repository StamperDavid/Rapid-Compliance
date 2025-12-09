import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * GET /api/analytics/win-loss - Get win/loss analysis
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '90d')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = searchParams.get('period') || '90d';

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'orgId is required' },
        { status: 400 }
      );
    }

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

    // Get deals from Firestore
    const dealsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/deals`;
    let allDeals: any[] = [];
    
    try {
      allDeals = await FirestoreService.getAll(dealsPath, []);
    } catch (e) {
      console.log('No deals collection yet');
    }

    // Filter closed deals in period
    const wonStatuses = ['won', 'closed_won'];
    const lostStatuses = ['lost', 'closed_lost'];

    const closedDealsInPeriod = allDeals.filter(deal => {
      const status = (deal.status || deal.stage || '').toLowerCase();
      const isClosed = wonStatuses.some(s => status.includes(s)) || lostStatuses.some(s => status.includes(s));
      if (!isClosed) return false;

      const closedDate = deal.closedDate?.toDate?.() || deal.closedAt?.toDate?.() || 
                        (deal.closedDate ? new Date(deal.closedDate) : new Date(deal.updatedAt));
      return closedDate >= startDate && closedDate <= now;
    });

    const wonDeals = closedDealsInPeriod.filter(deal => {
      const status = (deal.status || deal.stage || '').toLowerCase();
      return wonStatuses.some(s => status.includes(s));
    });

    const lostDeals = closedDealsInPeriod.filter(deal => {
      const status = (deal.status || deal.stage || '').toLowerCase();
      return lostStatuses.some(s => status.includes(s));
    });

    // Calculate metrics
    const totalDeals = closedDealsInPeriod.length;
    const winRate = totalDeals > 0 ? (wonDeals.length / totalDeals) * 100 : 0;

    // Revenue
    const wonRevenue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.value) || parseFloat(d.amount) || 0), 0);
    const lostRevenue = lostDeals.reduce((sum, d) => sum + (parseFloat(d.value) || parseFloat(d.amount) || 0), 0);

    // Average deal sizes
    const avgWonDeal = wonDeals.length > 0 ? wonRevenue / wonDeals.length : 0;
    const avgLostDeal = lostDeals.length > 0 ? lostRevenue / lostDeals.length : 0;

    // Loss reasons
    const reasonMap = new Map<string, { count: number; value: number }>();
    lostDeals.forEach(deal => {
      const reason = deal.lostReason || deal.reason || deal.lossReason || 'No reason provided';
      const value = parseFloat(deal.value) || parseFloat(deal.amount) || 0;
      const existing = reasonMap.get(reason) || { count: 0, value: 0 };
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
      const repId = deal.assignedTo || deal.ownerId || 'unassigned';
      const repName = deal.assignedToName || deal.ownerName || 'Unassigned';
      const value = parseFloat(deal.value) || parseFloat(deal.amount) || 0;
      const status = (deal.status || deal.stage || '').toLowerCase();
      const isWon = wonStatuses.some(s => status.includes(s));
      
      const existing = repMap.get(repId) || { won: 0, lost: 0, wonValue: 0, lostValue: 0, name: repName };
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
      const competitor = deal.competitor || deal.lostToCompetitor;
      if (competitor) {
        const status = (deal.status || deal.stage || '').toLowerCase();
        const isWon = wonStatuses.some(s => status.includes(s));
        const existing = competitorMap.get(competitor) || { won: 0, lost: 0 };
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
      const closedDate = deal.closedDate?.toDate?.() || deal.closedAt?.toDate?.() || new Date(deal.closedDate || deal.updatedAt);
      const weekStart = new Date(closedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      const status = (deal.status || deal.stage || '').toLowerCase();
      const isWon = wonStatuses.some(s => status.includes(s));
      
      const existing = weeklyMap.get(weekKey) || { won: 0, lost: 0 };
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

    return NextResponse.json({
      success: true,
      analytics: {
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
      },
    });
  } catch (error: any) {
    console.error('Error getting win/loss analytics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get win/loss analytics' },
      { status: 500 }
    );
  }
}
