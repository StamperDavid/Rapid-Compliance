/**
 * Proposal Generation API
 * POST /api/proposals/generate - Generate proposal from template
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateProposal } from '@/lib/documents/proposal-generator';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface ProposalGenerateRequestBody {
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
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    if (!isProposalGenerateRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    const proposal = await generateProposal({
      templateId: body.templateId,
      dealId: body.dealId,
      contactId: body.contactId,
      variables: (body.variables ?? {}) as Record<string, string | number | Date>,
      lineItems: body.lineItems ?? [],
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      data: proposal,
    });

  } catch (error) {
    logger.error('Proposal generation API failed', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

