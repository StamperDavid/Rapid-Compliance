/**
 * Proposal Generation API
 * POST /api/proposals/generate - Generate proposal from template
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateProposal } from '@/lib/documents/proposal-generator';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface ProposalGenerateRequestBody {
  workspaceId?: string;
  templateId?: string;
  dealId?: string;
  contactId?: string;
  variables?: Record<string, unknown>;
  lineItems?: LineItem[];
  validUntil?: string;
  notes?: string;
}

function isProposalGenerateRequestBody(value: unknown): value is ProposalGenerateRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!isProposalGenerateRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const organizationId = token.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    if (!body.templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const workspaceId = (body.workspaceId !== '' && body.workspaceId != null) ? body.workspaceId : 'default';

    const proposal = await generateProposal(organizationId, workspaceId, {
      templateId: body.templateId,
      dealId: body.dealId,
      contactId: body.contactId,
      variables: body.variables ?? {},
      lineItems: body.lineItems ?? [],
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      data: proposal,
    });

  } catch (error) {
    logger.error('Proposal generation API failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

