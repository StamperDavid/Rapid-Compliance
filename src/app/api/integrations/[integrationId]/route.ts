import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import {
  getIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  syncIntegration,
} from '@/lib/integrations/integration-manager';

/**
 * GET /api/integrations/[integrationId] - Get integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const integration = await getIntegration(user.organizationId, params.integrationId);

    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      integration,
    });
  } catch (error: any) {
    console.error('Error getting integration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get integration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/integrations/[integrationId] - Update integration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { user } = authResult;

    await updateIntegration(user.organizationId, params.integrationId, body);

    return NextResponse.json({
      success: true,
      message: 'Integration updated',
    });
  } catch (error: any) {
    console.error('Error updating integration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update integration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/[integrationId] - Delete integration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    await deleteIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: true,
      message: 'Integration deleted',
    });
  } catch (error: any) {
    console.error('Error deleting integration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete integration' },
      { status: 500 }
    );
  }
}













