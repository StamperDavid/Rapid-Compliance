import { NextRequest, NextResponse } from 'next/server';
import { searchWorkspace } from '@/lib/search/search-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { searchQuerySchema, validateInput, organizationIdSchema } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/search');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const orgId = searchParams.get('orgId');
    const workspaceId = searchParams.get('workspaceId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate input
    const validation = validateInput(searchQuerySchema, {
      q: query,
      orgId,
      workspaceId,
      limit,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { orgId: validatedOrgId } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== validatedOrgId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    const results = await searchWorkspace(validatedOrgId, workspaceId!, query!, { limit });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error in search:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to search' },
      { status: 500 }
    );
  }
}
