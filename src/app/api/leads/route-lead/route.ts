/**
 * Lead Routing API
 * POST /api/leads/route-lead - Automatically route a lead to appropriate user
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeLead } from '@/lib/crm/lead-routing';
import { updateLead, getLead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const organizationId = token.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { leadId, workspaceId = 'default' } = body;

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

  } catch (error: any) {
    logger.error('Lead routing API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

