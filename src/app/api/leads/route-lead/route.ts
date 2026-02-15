/**
 * Lead Routing API
 * POST /api/leads/route-lead - Automatically route a lead to appropriate user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { routeLead } from '@/lib/crm/lead-routing';
import { updateLead, getLead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface RouteLeadRequestBody {
  leadId?: string;
}

function isRouteLeadRequestBody(value: unknown): value is RouteLeadRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    if (!isRouteLeadRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const leadId = body.leadId;

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    // Get lead
    const lead = await getLead(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Route the lead
    const routingResult = await routeLead(lead);

    // Update lead with assignment
    await updateLead(leadId, {
      ownerId: routingResult.assignedTo,
    });

    return NextResponse.json({
      success: true,
      data: routingResult,
    });

  } catch (error: unknown) {
    logger.error('Lead routing API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

