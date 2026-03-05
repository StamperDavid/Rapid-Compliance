/**
 * Discovery Convert API — Convert approved results to CRM leads
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getDiscoveryBatch,
  convertToLead,
  bulkConvertToLeads,
} from '@/lib/services/discovery-service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ batchId: string }> };

const convertSchema = z.object({
  resultId: z.string().optional(),
  resultIds: z.array(z.string()).optional(),
}).refine(data => Boolean(data.resultId) || (data.resultIds && data.resultIds.length > 0), {
  message: 'Either resultId or resultIds is required',
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { batchId } = await context.params;
    const batch = await getDiscoveryBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = convertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
    }

    const userId = authResult.user.uid;
    const { resultId, resultIds } = parsed.data;

    if (resultId) {
      const leadId = await convertToLead(resultId, userId);
      return NextResponse.json({ success: true, leadId });
    }

    if (resultIds && resultIds.length > 0) {
      const result = await bulkConvertToLeads(resultIds, userId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'No results to convert' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to convert';
    logger.error('Failed to convert discovery results', error instanceof Error ? error : new Error(String(error)));
    const status = message.includes('not found') ? 404 : message.includes('already converted') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
