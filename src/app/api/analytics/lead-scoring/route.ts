import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/analytics/lead-scoring - Get lead scoring analytics
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/lead-scoring');
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = searchParams.get('period') || '30d';

    if (!orgId) {
      return errors.badRequest('orgId is required');
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
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get leads from Firestore
    const leadsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workspaces/default/entities/leads`;
    let allLeads: any[] = [];
    
    try {
      allLeads = await FirestoreService.getAll(leadsPath, []);
    } catch (e) {
      logger.debug('No leads collection yet', { orgId });
    }

    // Filter by date
    const leadsInPeriod = allLeads.filter(lead => {
      const leadDate = lead.createdAt?.toDate?.() || new Date(lead.createdAt);
      return leadDate >= startDate && leadDate <= now;
    });

    // Calculate lead scores if not present
    const scoredLeads = allLeads.map(lead => {
      if (lead.score !== undefined) return lead;
      
      // Simple scoring algorithm
      let score = 50; // Base score
      
      // Email provided: +10
      if (lead.email) score += 10;
      
      // Phone provided: +10
      if (lead.phone || lead.phoneNumber) score += 10;
      
      // Company provided: +10
      if (lead.company || lead.companyName) score += 10;
      
      // Has activity: +15
      if (lead.lastActivity || lead.lastActivityAt) score += 15;
      
      // Qualified status: +20
      if ((lead.status || '').toLowerCase().includes('qualified')) score += 20;
      
      // Hot rating: +15
      if ((lead.rating || '').toLowerCase() === 'hot') score += 15;
      
      // Warm rating: +10
      if ((lead.rating || '').toLowerCase() === 'warm') score += 10;
      
      return { ...lead, score: Math.min(100, score) };
    });

    // Distribution by score ranges
    const scoreRanges = [
      { range: 'Hot (80-100)', min: 80, max: 100 },
      { range: 'Warm (60-79)', min: 60, max: 79 },
      { range: 'Cool (40-59)', min: 40, max: 59 },
      { range: 'Cold (0-39)', min: 0, max: 39 },
    ];

    const distribution = scoreRanges.map(({ range, min, max }) => {
      const leads = scoredLeads.filter(l => l.score >= min && l.score <= max);
      return {
        range,
        count: leads.length,
        percentage: scoredLeads.length > 0 ? (leads.length / scoredLeads.length) * 100 : 0,
      };
    });

    // Top leads
    const topLeads = [...scoredLeads]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10)
      .map(lead => ({
        id: lead.id,
        name: lead.name || lead.first_name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
        email: lead.email,
        company: lead.company || lead.companyName,
        score: lead.score,
        status: lead.status,
      }));

    // Average score
    const avgScore = scoredLeads.length > 0
      ? Math.round(scoredLeads.reduce((sum, l) => sum + (l.score || 0), 0) / scoredLeads.length)
      : 0;

    // Score by source
    const sourceMap = new Map<string, { total: number; count: number }>();
    scoredLeads.forEach(lead => {
      const source = lead.source || lead.lead_source || 'unknown';
      const existing = sourceMap.get(source) || { total: 0, count: 0 };
      sourceMap.set(source, {
        total: existing.total + (lead.score || 0),
        count: existing.count + 1,
      });
    });

    const bySource = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        avgScore: Math.round(data.total / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Conversion metrics
    const convertedLeads = scoredLeads.filter(l => 
      (l.status || '').toLowerCase().includes('converted') || 
      (l.status || '').toLowerCase().includes('won') ||
      l.convertedAt
    );

    const conversionRate = scoredLeads.length > 0
      ? (convertedLeads.length / scoredLeads.length) * 100
      : 0;

    const avgScoreConverted = convertedLeads.length > 0
      ? Math.round(convertedLeads.reduce((sum, l) => sum + (l.score || 0), 0) / convertedLeads.length)
      : 0;

    return NextResponse.json({
      success: true,
      analytics: {
        totalLeads: scoredLeads.length,
        leadsInPeriod: leadsInPeriod.length,
        avgScore,
        distribution,
        topLeads,
        bySource,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgScoreConverted,
        convertedLeads: convertedLeads.length,
      },
    });
  } catch (error: any) {
    logger.error('Error getting lead scoring analytics', error, { route: '/api/analytics/lead-scoring' });
    return errors.database('Failed to get lead scoring analytics', error);
  }
}
