/**
 * Outbound Sequence (single) API Routes
 * PATCH:  Update sequence status (activate/pause) or top-level fields.
 * DELETE: Remove a sequence by ID.
 *
 * Operates over the `sequences` sub-collection via the Admin SDK, matching the
 * collection used by GET/POST /api/outbound/sequences.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { OutboundSequence } from '@/types/outbound-sequence';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const updateSequenceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'draft', 'archived']).optional(),
});

/**
 * PATCH /api/outbound/sequences/[id] - Update sequence status/fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updateSequenceSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const existing = await AdminFirestoreService.get<OutboundSequence>(
      getSubCollection('sequences'),
      id
    );

    if (!existing) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      ...bodyResult.data,
      updatedAt: new Date().toISOString(),
    };

    await AdminFirestoreService.update(getSubCollection('sequences'), id, updates);

    const sequence = await AdminFirestoreService.get<OutboundSequence>(
      getSubCollection('sequences'),
      id
    );

    logger.info('Sequence updated', { id, fields: Object.keys(bodyResult.data) });

    return NextResponse.json({ success: true, sequence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update sequence';
    logger.error('Failed to update sequence', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/outbound/sequences/[id] - Delete a sequence
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await AdminFirestoreService.delete(getSubCollection('sequences'), id);

    logger.info('Sequence deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete sequence';
    logger.error('Failed to delete sequence', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
