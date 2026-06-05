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

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional().default(''),
  trafficWeight: z.number(),
  config: z.record(z.unknown()).optional().default({}),
  metrics: z
    .object({
      impressions: z.number(),
      conversions: z.number(),
      conversionRate: z.number(),
      revenue: z.number().optional(),
    })
    .optional(),
});

const createABTestSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  testType: z.enum(['page', 'email', 'checkout', 'pricing', 'cta', 'custom']).optional().default('page'),
  targetMetric: z.string().optional(),
  trafficAllocation: z.number().optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional().default('draft'),
  variants: z.array(variantSchema).optional().default([]),
  winner: z.string().optional(),
  confidence: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/ab-tests - List all A/B tests
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const abTests = await AdminFirestoreService.getAll<ABTestRecord>(
      getSubCollection('abTests'),
      []
    );

    return NextResponse.json({ success: true, abTests });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch A/B tests';
    logger.error('Failed to fetch A/B tests', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/ab-tests - Create a new A/B test
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createABTestSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const data = bodyResult.data;
    const testId = data.id ?? `abtest-${Date.now()}`;

    const abTest = {
      ...data,
      id: testId,
      createdAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(getSubCollection('abTests'), testId, abTest);

    return NextResponse.json({ success: true, abTest }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create A/B test';
    logger.error('Failed to create A/B test', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
