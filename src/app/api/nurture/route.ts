import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getNurtureSequencesCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
  cursor: z.string().optional(),
});

const stepSchema = z.object({
  delayDays: z.coerce.number().min(0).optional().default(1),
  subject: z.string().optional().default(''),
  body: z.string().optional().default(''),
  type: z.enum(['email', 'sms', 'task']).optional().default('email'),
});

const createSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional().default('draft'),
  steps: z.array(stepSchema).optional().default([]),
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
 * GET /api/nurture - List nurture sequences (cursor-paginated)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      pageSize: searchParams.get('pageSize') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.errors },
        { status: 400 }
      );
    }

    const { pageSize, cursor } = queryResult.data;

    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    // Fetch one extra to determine hasMore, and walk past the cursor manually
    // (Admin SDK QueryDocumentSnapshot cursors can't cross the network, so we
    //  page by createdAt ordering and skip up to/including the cursor id).
    const all = await AdminFirestoreService.getAll<NurtureSequenceDoc>(
      getNurtureSequencesCollection(),
      constraints
    );

    let startIndex = 0;
    if (cursor) {
      const idx = all.findIndex((s) => s.id === cursor);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const slice = all.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < all.length;
    const nextCursor = slice.length > 0 ? slice[slice.length - 1].id : null;

    return NextResponse.json({
      success: true,
      sequences: slice,
      cursor: nextCursor,
      hasMore,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch nurture sequences';
    logger.error('Failed to fetch nurture sequences', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/nurture - Create a nurture sequence
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const data = bodyResult.data;
    const campaignId = `nurture-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const sequence = {
      ...data,
      id: campaignId,
      enrolled: 0,
      completed: 0,
      active: 0,
      converted: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await AdminFirestoreService.set(
      getNurtureSequencesCollection(),
      campaignId,
      sequence,
      false
    );

    logger.info('Nurture sequence created', { campaignId, name: sequence.name, steps: sequence.steps.length });

    return NextResponse.json({ success: true, sequence }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create nurture sequence';
    logger.error('Failed to create nurture sequence', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
