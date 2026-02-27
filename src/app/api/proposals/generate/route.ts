/**
 * Proposal Generation API
 * POST /api/proposals/generate - Generate proposal from template
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateProposal } from '@/lib/documents/proposal-generator';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number().optional(),
});

const ProposalGenerateSchema = z.object({
  templateId: z.string().min(1),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
  lineItems: z.array(LineItemSchema).optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = ProposalGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { templateId, dealId, contactId, variables, lineItems, validUntil, notes } = parsed.data;

    const proposal = await generateProposal({
      templateId,
      dealId,
      contactId,
      variables: (variables ?? {}) as Record<string, string | number | Date>,
      lineItems: lineItems ?? [],
      validUntil: validUntil ? new Date(validUntil) : undefined,
      notes,
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

