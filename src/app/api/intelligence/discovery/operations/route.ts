/**
 * Discovery Operations — GET (list) / POST (create)
 * /api/intelligence/discovery/operations
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  createOperation,
  listOperations,
} from '@/lib/intelligence/discovery-service';
import { getSource } from '@/lib/intelligence/discovery-source-service';
import {
  CreateOperationSchema,
  ListOperationsQuerySchema,
} from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

// ── GET — List operations ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const parsed = ListOperationsQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      sourceId: searchParams.get('sourceId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      startAfter: searchParams.get('startAfter') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const result = await listOperations(parsed.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Discovery Operations] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to list operations' }, { status: 500 });
  }
}

// ── POST — Create operation ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const parsed = CreateOperationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const source = await getSource(parsed.data.sourceId);
    if (!source) {
      return NextResponse.json(
        { error: 'Source not found', sourceId: parsed.data.sourceId },
        { status: 404 }
      );
    }

    const config = parsed.data.config ?? {
      maxRecords: source.maxRecordsPerRun,
      enrichmentDepth: source.enrichmentDepth,
      enableMultiHop: true,
      secondarySources: source.enrichmentHints,
    };

    const operation = await createOperation({
      sourceId: source.id,
      sourceName: source.name,
      triggeredBy: 'manual',
      config,
      createdBy: authResult.user.uid,
    });

    return NextResponse.json({ operation }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[Discovery Operations] POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to create operation' }, { status: 500 });
  }
}
