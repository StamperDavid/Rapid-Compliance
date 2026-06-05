import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface DatasetRecord {
  id: string;
  [key: string]: unknown;
}

const createDatasetSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Dataset name is required').max(100),
  description: z.string().max(500).optional().default(''),
  format: z.enum(['jsonl', 'csv', 'text']).optional().default('jsonl'),
  exampleCount: z.number().optional().default(0),
});

/**
 * GET /api/ai/datasets - List all training datasets
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    const datasets = await AdminFirestoreService.getAll<DatasetRecord>(
      getSubCollection('trainingDatasets'),
      constraints
    );

    return NextResponse.json({ success: true, datasets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch training datasets';
    logger.error('Failed to fetch training datasets', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/ai/datasets - Create a new training dataset
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createDatasetSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const data = bodyResult.data;
    const datasetId = data.id ?? `dataset-${Date.now()}`;

    const dataset = {
      ...data,
      id: datasetId,
      createdAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(getSubCollection('trainingDatasets'), datasetId, dataset, false);

    logger.info('Training dataset created', { datasetId, name: dataset.name });

    return NextResponse.json({ success: true, dataset }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create training dataset';
    logger.error('Failed to create training dataset', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
