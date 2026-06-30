import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPipeline, updatePipeline, deletePipeline } from '@/lib/crm/pipeline-service';
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

const updatePipelineSchema = z
  .object({
    name: z.string().min(1).optional(),
    stages: z.array(stageSchema).min(1, 'A pipeline needs at least one stage').optional(),
  })
  .refine((data) => data.name !== undefined || data.stages !== undefined, {
    message: 'Nothing to update — provide a name and/or stages.',
  });

/**
 * GET /api/crm/pipelines/[pipelineId] — Get a single pipeline.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
): Promise<NextResponse> {
  try {
    const { pipelineId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const pipeline = await getPipeline(pipelineId);
    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, pipeline });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pipeline';
    logger.error('Failed to fetch pipeline', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/pipelines/[pipelineId] — Update name and/or stages.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
): Promise<NextResponse> {
  try {
    const { pipelineId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updatePipelineSchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const pipeline = await updatePipeline(pipelineId, bodyResult.data);
    return NextResponse.json({ success: true, pipeline });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update pipeline';
    logger.error('Failed to update pipeline', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/pipelines/[pipelineId] — Delete a pipeline.
 * Blocked for the default pipeline or one that still has deals.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
): Promise<NextResponse> {
  try {
    const { pipelineId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await deletePipeline(pipelineId);
    return NextResponse.json({ success: true, deleted: pipelineId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete pipeline';
    logger.error('Failed to delete pipeline', error instanceof Error ? error : new Error(String(error)));
    // A blocked delete (default pipeline / pipeline still has deals) is a
    // client-correctable condition, so surface it as a 400 with the plain
    // message rather than a 500.
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
