import { NextRequest, NextResponse } from 'next/server';
import { calculateLeadScore, batchScoreLeads, getModelInsights } from '@/lib/analytics/lead-scoring';
import { LeadScoringFactors } from '@/lib/analytics/lead-scoring';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { leadScoringSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/lead-scoring');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(leadScoringSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { action, data, organizationId } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Process based on action
    switch (action) {
      case 'score':
        if (!data.factors) {
          return NextResponse.json(
            { success: false, error: 'Missing factors data' },
            { status: 400 }
          );
        }
        const score = calculateLeadScore(data.factors as LeadScoringFactors);
        return NextResponse.json({ success: true, score });

      case 'batch-score':
        if (!data.leads || !Array.isArray(data.leads)) {
          return NextResponse.json(
            { success: false, error: 'Missing leads array' },
            { status: 400 }
          );
        }
        const scores = batchScoreLeads(data.leads);
        return NextResponse.json({ success: true, scores });

      case 'insights':
        if (!data.leads || !Array.isArray(data.leads)) {
          return NextResponse.json(
            { success: false, error: 'Missing leads array' },
            { status: 400 }
          );
        }
        const insights = getModelInsights(data.leads);
        return NextResponse.json({ success: true, insights });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: score, batch-score, or insights' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Lead scoring error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process lead scoring' },
      { status: 500 }
    );
  }
}

