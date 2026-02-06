export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { getWorkflow, updateWorkflow, deleteWorkflow, setWorkflowStatus } from '@/lib/workflows/workflow-service';

const paramsSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
});

const getQuerySchema = z.object({
  workspaceId: z.string().optional().default('default'),
});

const putBodySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  workflow: z.record(z.unknown()),
});

const patchBodySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  status: z.enum(['active', 'paused']),
});

const deleteQuerySchema = z.object({
  workspaceId: z.string().optional().default('default'),
});

/**
 * GET /api/workflows/[workflowId]
 * Get a single workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminApp) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth(adminApp).verifyIdToken(token);

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid workflowId' }, { status: 400 });
    }
    const { workflowId } = paramsResult.data;

    const { searchParams } = new URL(request.url);
    const queryResult = getQuerySchema.safeParse({
      workspaceId: searchParams.get('workspaceId') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { workspaceId } = queryResult.data;
    const workflow = await getWorkflow(DEFAULT_ORG_ID, workflowId, workspaceId);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error: unknown) {
    logger.error('Failed to get workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to get workflow';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/[workflowId]
 * Update a workflow
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminApp) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth(adminApp).verifyIdToken(token);

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid workflowId' }, { status: 400 });
    }
    const { workflowId } = paramsResult.data;

    const body: unknown = await request.json();
    const bodyResult = putBodySchema.safeParse(body);
    if (!bodyResult.success) {
      const firstError = bodyResult.error.errors[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { workspaceId, workflow } = bodyResult.data;

    const updatedWorkflow = await updateWorkflow(
      DEFAULT_ORG_ID,
      workflowId,
      workflow,
      workspaceId
    );

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error: unknown) {
    logger.error('Failed to update workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to update workflow';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows/[workflowId]
 * Update workflow status (activate/pause)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminApp) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth(adminApp).verifyIdToken(token);

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid workflowId' }, { status: 400 });
    }
    const { workflowId } = paramsResult.data;

    const body: unknown = await request.json();
    const bodyResult = patchBodySchema.safeParse(body);
    if (!bodyResult.success) {
      const firstError = bodyResult.error.errors[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'valid status (active|paused) is required' },
        { status: 400 }
      );
    }

    const { workspaceId, status } = bodyResult.data;

    const updatedWorkflow = await setWorkflowStatus(
      DEFAULT_ORG_ID,
      workflowId,
      status,
      workspaceId
    );

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error: unknown) {
    logger.error('Failed to update workflow status', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to update workflow status';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[workflowId]
 * Delete a workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminApp) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth(adminApp).verifyIdToken(token);

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid workflowId' }, { status: 400 });
    }
    const { workflowId } = paramsResult.data;

    const { searchParams } = new URL(request.url);
    const queryResult = deleteQuerySchema.safeParse({
      workspaceId: searchParams.get('workspaceId') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { workspaceId } = queryResult.data;
    await deleteWorkflow(DEFAULT_ORG_ID, workflowId, workspaceId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to delete workflow';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
