import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getWorkflow, updateWorkflow, deleteWorkflow, setWorkflowStatus } from '@/lib/workflows/workflow-service';

/**
 * GET /api/workflows/[workflowId]
 * Get a single workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
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

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId') || 'default';

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const workflow = await getWorkflow(organizationId, params.workflowId, workspaceId);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error: any) {
    logger.error('Failed to get workflow', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get workflow' },
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
  { params }: { params: { workflowId: string } }
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

    const body = await request.json();
    const { organizationId, workspaceId = 'default', workflow } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (!workflow) {
      return NextResponse.json({ error: 'workflow data is required' }, { status: 400 });
    }

    const updatedWorkflow = await updateWorkflow(
      organizationId,
      params.workflowId,
      workflow,
      workspaceId
    );

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error: any) {
    logger.error('Failed to update workflow', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update workflow' },
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
  { params }: { params: { workflowId: string } }
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

    const body = await request.json();
    const { organizationId, workspaceId = 'default', status } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (!status || !['active', 'paused'].includes(status)) {
      return NextResponse.json({ error: 'valid status (active|paused) is required' }, { status: 400 });
    }

    const updatedWorkflow = await setWorkflowStatus(
      organizationId,
      params.workflowId,
      status,
      workspaceId
    );

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error: any) {
    logger.error('Failed to update workflow status', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update workflow status' },
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
  { params }: { params: { workflowId: string } }
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

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId') || 'default';

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    await deleteWorkflow(organizationId, params.workflowId, workspaceId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete workflow', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
