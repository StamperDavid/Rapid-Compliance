/**
 * Discovery Batch API — Get results, Approve/Reject
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getDiscoveryBatch,
  getDiscoveryResults,
  approveResult,
  rejectResult,
  bulkApprove,
} from '@/lib/services/discovery-service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { batchId } = await context.params;
    const { searchParams } = new URL(request.url);

    const batch = await getDiscoveryBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const statusFilter = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'converted' | null;
    const results = await getDiscoveryResults(batchId, {
      ...(statusFilter && { status: statusFilter }),
    });

    return NextResponse.json({ batch, results });
  } catch (error: unknown) {
    logger.error('Failed to get discovery results', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to get discovery results' }, { status: 500 });
  }
}

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'bulk-approve']),
  resultId: z.string().optional(),
  resultIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    // Validate batchId exists
    const { batchId } = await context.params;
    const batch = await getDiscoveryBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
    }

    const { action, resultId, resultIds, notes } = parsed.data;
    const userId = authResult.user.uid;

    switch (action) {
      case 'approve':
        if (!resultId) {return NextResponse.json({ error: 'resultId required' }, { status: 400 });}
        await approveResult(resultId, userId);
        return NextResponse.json({ success: true });

      case 'reject':
        if (!resultId) {return NextResponse.json({ error: 'resultId required' }, { status: 400 });}
        await rejectResult(resultId, userId, notes);
        return NextResponse.json({ success: true });

      case 'bulk-approve': {
        if (!resultIds || resultIds.length === 0) {return NextResponse.json({ error: 'resultIds required' }, { status: 400 });}
        const count = await bulkApprove(resultIds, userId);
        return NextResponse.json({ success: true, approved: count });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: unknown) {
    logger.error('Failed to update discovery result', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to update discovery result' }, { status: 500 });
  }
}
