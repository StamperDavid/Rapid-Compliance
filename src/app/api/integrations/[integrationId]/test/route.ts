import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { testIntegration } from '@/lib/integrations/integration-manager';

/**
 * POST /api/integrations/[integrationId]/test - Test integration connection
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
    const result = await testIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Error testing integration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test integration' },
      { status: 500 }
    );
  }
}











