export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getWorkflow, updateWorkflow, deleteWorkflow, setWorkflowStatus } from '@/lib/workflows/workflow-service';

/**
 * MAJ-45: This workflow route uses Firebase Admin SDK auth (getAuth().verifyIdToken)
 * instead of the standard requireAuth() pattern. This is acceptable for admin-SDK routes
 * that need direct access to Firebase Admin features. The auth pattern is consistent
 * with other workflow endpoints.
 */

const paramsSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
});

const putBodySchema = z.object({
  workflow: z.record(z.unknown()),
});

const patchBodySchema = z.object({
  status: z.enum(['active', 'paused']),
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

    const workflow = await getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, workflow });
  } catch (error: unknown) {
    logger.error('Failed to get workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to get workflow';
    return NextResponse.json(
      { success: false, error: message },
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

    const { workflow } = bodyResult.data;

    const updatedWorkflow = await updateWorkflow(
      workflowId,
      workflow
    );

    return NextResponse.json({ success: true, workflow: updatedWorkflow });
  } catch (error: unknown) {
    logger.error('Failed to update workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to update workflow';
    return NextResponse.json(
      { success: false, error: message },
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

    const { status } = bodyResult.data;

    const updatedWorkflow = await setWorkflowStatus(
      workflowId,
      status
    );

    return NextResponse.json({ success: true, workflow: updatedWorkflow });
  } catch (error: unknown) {
    logger.error('Failed to update workflow status', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to update workflow status';
    return NextResponse.json(
      { success: false, error: message },
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

    // MAJ-13: Referential integrity — prevent deleting active workflows
    const existingWorkflow = await getWorkflow(workflowId);
    if (!existingWorkflow) {
      return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 });
    }
    const workflowData = existingWorkflow as unknown as Record<string, unknown>;
    if (workflowData.status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete an active workflow. Pause it first.' },
        { status: 409 }
      );
    }

    await deleteWorkflow(workflowId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete workflow', error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Failed to delete workflow';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
