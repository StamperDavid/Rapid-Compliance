import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listPipelines, createPipeline } from '@/lib/crm/pipeline-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const stageSchema = z.object({
  key: z.string().min(1, 'Stage key is required'),
  label: z.string().min(1, 'Stage name is required'),
  order: z.number().int().default(0),
  probability: z.number().min(0).max(100).optional(),
  type: z.enum(['open', 'won', 'lost']).optional(),
});

const createPipelineSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required'),
  stages: z.array(stageSchema).min(1, 'A pipeline needs at least one stage'),
});

/**
 * GET /api/crm/pipelines — List all pipelines (default first). Seeds the
 * default pipeline on first call so the board always has one to render.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const pipelines = await listPipelines();
    return NextResponse.json({ success: true, pipelines });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list pipelines';
    logger.error('Failed to list pipelines', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/crm/pipelines — Create a new pipeline.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createPipelineSchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const pipeline = await createPipeline(bodyResult.data);
    return NextResponse.json({ success: true, pipeline }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create pipeline';
    logger.error('Failed to create pipeline', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
