import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ENTITY_NAME_RE = /^[a-zA-Z0-9_]+$/;

const updateSchema = z.object({
  record: z.record(z.unknown()),
});

/**
 * GET /api/entities/[entityName]/records/[id] — fetch a single record (Admin SDK).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityName: string; id: string }> }
) {
  try {
    const { entityName, id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!ENTITY_NAME_RE.test(entityName)) {
      return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 });
    }

    const record = await AdminFirestoreService.get(getSubCollection(entityName), id);
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch record';
    logger.error('Failed to fetch entity record', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/entities/[entityName]/records/[id] — update a record.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entityName: string; id: string }> }
) {
  try {
    const { entityName, id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!ENTITY_NAME_RE.test(entityName)) {
      return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.errors },
        { status: 400 }
      );
    }

    await AdminFirestoreService.update(getSubCollection(entityName), id, {
      ...parsed.data.record,
      updatedAt: new Date().toISOString(),
    });

    const record = await AdminFirestoreService.get(getSubCollection(entityName), id);
    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update record';
    logger.error('Failed to update entity record', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/entities/[entityName]/records/[id] — delete a record.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entityName: string; id: string }> }
) {
  try {
    const { entityName, id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!ENTITY_NAME_RE.test(entityName)) {
      return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 });
    }

    await AdminFirestoreService.delete(getSubCollection(entityName), id);
    return NextResponse.json({ success: true, deleted: id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete record';
    logger.error('Failed to delete entity record', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
