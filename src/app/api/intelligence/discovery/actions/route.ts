/**
 * Discovery Actions (Audit Log) — GET /api/intelligence/discovery/actions
 *
 * Returns the granular action log for an operation, with optional
 * finding filter and delta polling via `since` parameter.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { listActions } from '@/lib/intelligence/discovery-service';
import { ListActionsQuerySchema } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const parsed = ListActionsQuerySchema.safeParse({
      operationId: searchParams.get('operationId') ?? undefined,
      findingId: searchParams.get('findingId') ?? undefined,
      since: searchParams.get('since') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const actions = await listActions(parsed.data);
    return NextResponse.json({ actions });
  } catch (error: unknown) {
    logger.error('[Discovery Actions] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to list actions' }, { status: 500 });
  }
}
