import { type NextRequest, NextResponse } from 'next/server';
import { searchWorkspace } from '@/lib/search/search-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { searchQuerySchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/search');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    // Auth verified - user is authenticated (penthouse, no org check needed)
    const { user: _user } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const workspaceId = searchParams.get('workspaceId') ?? 'default';
    const limitParam = searchParams.get('limit');
    const limit = parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50');

    // Validate input
    const validation = validateInput(searchQuerySchema, {
      q: query,
      PLATFORM_ID,
      workspaceId,
      limit,
    });

    if (!validation.success) {
      const zodErrors = validation.errors.errors.map((e) => ({
        message: e.message,
        path: e.path.map(String),
        code: e.code,
      }));

      return errors.validation('Validation failed', { errors: zodErrors });
    }

    const { workspaceId: validatedWorkspaceId, q: validatedQuery, limit: validatedLimit } = validation.data;

    const results = await searchWorkspace(validatedWorkspaceId, validatedQuery, { limit: validatedLimit });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error: unknown) {
    logger.error('Search error', error instanceof Error ? error : new Error(String(error)), { route: '/api/search' });
    return errors.database('Failed to search workspace', error instanceof Error ? error : undefined);
  }
}
