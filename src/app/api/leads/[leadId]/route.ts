import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLead, updateLead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const updateLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  companyName: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  score: z.number().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/leads/[leadId] - Get a single lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const lead = await getLead(leadId, { useAdminSdk: true });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch lead';
    logger.error('Failed to fetch lead', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/[leadId] - Update a single lead
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updateLeadSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const lead = await updateLead(leadId, bodyResult.data, { useAdminSdk: true });

    return NextResponse.json({ success: true, lead });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update lead';
    logger.error('Failed to update lead', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
