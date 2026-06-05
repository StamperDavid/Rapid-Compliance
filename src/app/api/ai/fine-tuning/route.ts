import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface FineTuningJobRecord {
  id: string;
  [key: string]: unknown;
}

const createJobSchema = z.object({
  id: z.string().min(1).optional(),
  modelName: z.string().min(1, 'Model name is required'),
  baseModel: z.enum(['gpt-3.5-turbo', 'gpt-4', 'claude-3-opus']).optional().default('gpt-3.5-turbo'),
  datasetId: z.string().optional().default(''),
  datasetSize: z.number().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional().default('pending'),
});

/**
 * GET /api/ai/fine-tuning - List all fine-tuning jobs
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    const jobs = await AdminFirestoreService.getAll<FineTuningJobRecord>(
      getSubCollection('fineTuningJobs'),
      constraints
    );

    return NextResponse.json({ success: true, jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch fine-tuning jobs';
    logger.error('Failed to fetch fine-tuning jobs', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/ai/fine-tuning - Create a new fine-tuning job
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createJobSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const data = bodyResult.data;
    const jobId = data.id ?? `finetune-${Date.now()}`;

    const job = {
      ...data,
      id: jobId,
      createdAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(getSubCollection('fineTuningJobs'), jobId, job, false);

    logger.info('Fine-tuning job created', { jobId, modelName: job.modelName });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create fine-tuning job';
    logger.error('Failed to create fine-tuning job', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
