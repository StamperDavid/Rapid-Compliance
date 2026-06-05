import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/** Entity names map to Firestore sub-collections; restrict to a safe charset to prevent path injection. */
const ENTITY_NAME_RE = /^[a-zA-Z0-9_]+$/;

const createSchema = z.object({
  id: z.string().min(1).optional(),
  record: z.record(z.unknown()),
});

/**
 * GET /api/entities/[entityName]/records — list all records for a dynamic entity.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityName: string }> }
) {
  try {
    const { entityName } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!ENTITY_NAME_RE.test(entityName)) {
      return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 });
    }

    const records = await AdminFirestoreService.getAll(getSubCollection(entityName), []);
    return NextResponse.json({ success: true, records });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch records';
    logger.error('Failed to fetch entity records', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/entities/[entityName]/records — create a record. Server stamps id/createdAt/updatedAt.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entityName: string }> }
) {
  try {
    const { entityName } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!ENTITY_NAME_RE.test(entityName)) {
      return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const id = parsed.data.id ?? `${entityName}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();
    const record = { ...parsed.data.record, id, createdAt: now, updatedAt: now };

    await AdminFirestoreService.set(getSubCollection(entityName), id, record);
    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create record';
    logger.error('Failed to create entity record', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
