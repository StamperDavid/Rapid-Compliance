import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getNurtureSequencesCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const stepSchema = z.object({
  delayDays: z.coerce.number().min(0).optional().default(1),
  subject: z.string().optional().default(''),
  body: z.string().optional().default(''),
  type: z.enum(['email', 'sms', 'task']).optional().default('email'),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  steps: z.array(stepSchema).optional(),
});

interface NurtureSequenceDoc {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  steps?: unknown[];
  enrolled?: number;
  completed?: number;
  active?: number;
  converted?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

/**
 * GET /api/nurture/[id] - Get a single nurture sequence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const sequence = await AdminFirestoreService.get<NurtureSequenceDoc>(
      getNurtureSequencesCollection(),
      id
    );

    if (!sequence) {
      return NextResponse.json({ error: 'Nurture sequence not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, sequence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch nurture sequence';
    logger.error('Failed to fetch nurture sequence', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/nurture/[id] - Update a nurture sequence
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
    const bodyResult = updateSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const existing = await AdminFirestoreService.get<NurtureSequenceDoc>(
      getNurtureSequencesCollection(),
      id
    );

    if (!existing) {
      return NextResponse.json({ error: 'Nurture sequence not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      ...bodyResult.data,
      updatedAt: new Date().toISOString(),
    };

    await AdminFirestoreService.update(getNurtureSequencesCollection(), id, updates);

    const sequence = await AdminFirestoreService.get<NurtureSequenceDoc>(
      getNurtureSequencesCollection(),
      id
    );

    logger.info('Nurture sequence updated', { id, fields: Object.keys(bodyResult.data) });

    return NextResponse.json({ success: true, sequence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update nurture sequence';
    logger.error('Failed to update nurture sequence', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/nurture/[id] - Delete a nurture sequence
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

    await AdminFirestoreService.delete(getNurtureSequencesCollection(), id);

    logger.info('Nurture sequence deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete nurture sequence';
    logger.error('Failed to delete nurture sequence', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
