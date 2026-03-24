/**
 * Discovery Operation Detail — GET /api/intelligence/discovery/operations/[operationId]
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getOperation } from '@/lib/intelligence/discovery-service';

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

    return NextResponse.json({ operation });
  } catch (error: unknown) {
    logger.error('[Discovery Operation] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to fetch operation' }, { status: 500 });
  }
}
