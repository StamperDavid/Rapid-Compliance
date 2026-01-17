/**
 * Lead Routing API
 * POST /api/leads/route-lead - Automatically route a lead to appropriate user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { routeLead } from '@/lib/crm/lead-routing';
import { updateLead, getLead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

interface RouteLeadRequestBody {
  leadId?: string;
  workspaceId?: string;
}

function isRouteLeadRequestBody(value: unknown): value is RouteLeadRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!isRouteLeadRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const organizationId = token.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const leadId = body.leadId;
    const workspaceId = body.workspaceId ?? 'default';

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    // Get lead
    const lead = await getLead(organizationId, leadId, workspaceId);
    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Route the lead
    const routingResult = await routeLead(organizationId, workspaceId, lead);

    // Update lead with assignment
    await updateLead(organizationId, leadId, {
      ownerId: routingResult.assignedTo,
    }, workspaceId);

    return NextResponse.json({
      success: true,
      data: routingResult,
    });

  } catch (error) {
    logger.error('Lead routing API failed', error instanceof Error ? error : undefined);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

