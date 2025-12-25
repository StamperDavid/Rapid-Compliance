/**
 * Proposal Generation API
 * POST /api/proposals/generate - Generate proposal from template
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateProposal } from '@/lib/documents/proposal-generator';
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
    const workspaceId = body.workspaceId || 'default';

    const proposal = await generateProposal(organizationId, workspaceId, {
      templateId: body.templateId,
      dealId: body.dealId,
      contactId: body.contactId,
      variables: body.variables,
      lineItems: body.lineItems,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      data: proposal,
    });

  } catch (error: any) {
    logger.error('Proposal generation API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

