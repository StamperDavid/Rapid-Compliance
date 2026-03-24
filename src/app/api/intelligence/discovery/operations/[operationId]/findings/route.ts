/**
 * Operation Findings — GET /api/intelligence/discovery/operations/[operationId]/findings
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { listFindings, getOperation } from '@/lib/intelligence/discovery-service';
import { ListFindingsQuerySchema } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { operationId } = await params;

    const operation = await getOperation(operationId);
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = ListFindingsQuerySchema.safeParse({
      enrichmentStatus: searchParams.get('enrichmentStatus') ?? undefined,
      approvalStatus: searchParams.get('approvalStatus') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      startAfter: searchParams.get('startAfter') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const result = await listFindings({
      operationId,
      ...parsed.data,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Discovery Findings] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to list findings' }, { status: 500 });
  }
}
