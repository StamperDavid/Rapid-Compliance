import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { searchWorkspace } from '@/lib/search/search-service';
import { requireOrganization } from '@/lib/auth/api-auth';
import { searchQuerySchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { formatValidationErrors } from '@/lib/validation/error-formatter';

export const dynamic = 'force-dynamic';

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
    const limitParam = searchParams.get('limit');
    const limit = parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50');

    // Validate input
    const validation = validateInput(searchQuerySchema, {
      q: query,
      orgId,
      workspaceId,
      limit,
    });

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = formatValidationErrors(validationError);
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { orgId: validatedOrgId } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== validatedOrgId) {
      return errors.forbidden('Access denied to this organization');
    }

    const results = await searchWorkspace(validatedOrgId, workspaceId!, query!, { limit });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    logger.error('Search error', error, { route: '/api/search' });
    return errors.database('Failed to search workspace', error);
  }
}
