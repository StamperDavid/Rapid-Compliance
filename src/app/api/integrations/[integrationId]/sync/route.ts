import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { syncIntegration } from '@/lib/integrations/integration-manager';

/**
 * POST /api/integrations/[integrationId]/sync - Sync integration data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const result = await syncIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Error syncing integration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync integration' },
      { status: 500 }
    );
  }
}


















