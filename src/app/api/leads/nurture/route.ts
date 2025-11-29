import { NextRequest, NextResponse } from 'next/server';
import { createNurtureSequence, enrollLeadInSequence, analyzeLeadLifecycle, getLeadAttribution } from '@/lib/analytics/lead-nurturing';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { leadNurtureSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/nurture');
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
    const validation = validateInput(leadNurtureSchema, body);

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

    switch (action) {
      case 'create-sequence':
        if (!data.sequence) {
          return NextResponse.json(
            { success: false, error: 'Sequence data is required' },
            { status: 400 }
          );
        }
        const sequence = await createNurtureSequence({
          ...data.sequence,
          organizationId,
          createdBy: user.uid,
        });
        return NextResponse.json({ success: true, sequence });

      case 'enroll-lead':
        if (!data.leadId || !data.sequenceId || !data.organizationId) {
          return NextResponse.json(
            { success: false, error: 'leadId, sequenceId, and organizationId are required' },
            { status: 400 }
          );
        }
        const result = await enrollLeadInSequence(data.leadId, data.sequenceId, data.organizationId);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }
        return NextResponse.json({ success: true });

      case 'analyze-lifecycle':
        if (!data.leadId) {
          return NextResponse.json(
            { success: false, error: 'leadId is required' },
            { status: 400 }
          );
        }
        const analysis = await analyzeLeadLifecycle(data.leadId);
        return NextResponse.json({ success: true, analysis });

      case 'get-attribution':
        if (!data.leadId) {
          return NextResponse.json(
            { success: false, error: 'leadId is required' },
            { status: 400 }
          );
        }
        const attribution = getLeadAttribution(data.leadId, data.model);
        return NextResponse.json({ success: true, attribution });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Lead nurture error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
