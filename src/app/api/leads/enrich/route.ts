import { NextRequest, NextResponse } from 'next/server';
import { enrichLead } from '@/lib/analytics/lead-nurturing';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { leadEnrichSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/enrich');
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
    const validation = validateInput(leadEnrichSchema, body);

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

    const { organizationId, leadId, sources } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    const enrichment = await enrichLead(leadId, organizationId, sources || {});

    return NextResponse.json({ success: true, enrichment });
  } catch (error: any) {
    console.error('Lead enrichment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to enrich lead' },
      { status: 500 }
    );
  }
}
