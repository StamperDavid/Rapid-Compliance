import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface ABTestRecord {
  id: string;
  [key: string]: unknown;
}

const updateABTestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  testType: z.enum(['page', 'email', 'checkout', 'pricing', 'cta', 'custom']).optional(),
  targetMetric: z.string().optional(),
  trafficAllocation: z.number().optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  variants: z.array(z.record(z.unknown())).optional(),
  winner: z.string().optional(),
  confidence: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * GET /api/ab-tests/[id] - Get a single A/B test
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

    const abTest = await AdminFirestoreService.get<ABTestRecord>(
      getSubCollection('abTests'),
      id
    );

    if (!abTest) {
      return NextResponse.json({ error: 'A/B test not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, abTest });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch A/B test';
    logger.error('Failed to fetch A/B test', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/ab-tests/[id] - Update a single A/B test
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
    const bodyResult = updateABTestSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const existing = await AdminFirestoreService.get<ABTestRecord>(
      getSubCollection('abTests'),
      id
    );

    if (!existing) {
      return NextResponse.json({ error: 'A/B test not found' }, { status: 404 });
    }

    await AdminFirestoreService.update(getSubCollection('abTests'), id, bodyResult.data);

    const abTest = await AdminFirestoreService.get<ABTestRecord>(
      getSubCollection('abTests'),
      id
    );

    return NextResponse.json({ success: true, abTest });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update A/B test';
    logger.error('Failed to update A/B test', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
