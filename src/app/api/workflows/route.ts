import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getWorkflows, createWorkflow } from '@/lib/workflows/workflow-service';

/**
 * GET /api/workflows
 * Get all workflows for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const status = searchParams.get('status');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const filters: any = {};
    if (status) {
      filters.status = status;
    }

    const result = await getWorkflows(organizationId, workspaceId, filters);

    return NextResponse.json({
      workflows: result.data,
      hasMore: result.hasMore,
    });
  } catch (error: any) {
    logger.error('Failed to get workflows', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);

    const body = await request.json();
    const { organizationId, workspaceId = 'default', workflow } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (!workflow) {
      return NextResponse.json({ error: 'workflow data is required' }, { status: 400 });
    }

    const newWorkflow = await createWorkflow(
      organizationId,
      workflow,
      decodedToken.uid,
      workspaceId
    );

    return NextResponse.json({ workflow: newWorkflow }, { status: 201 });
  } catch (error: any) {
    logger.error('Failed to create workflow', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
