/**
 * API Route: Specialist Recent Work
 *
 * GET /api/agents/specialist/{id}/recent-work?limit=10
 *
 * Returns up to `limit` recent COMPLETED step outputs the specialist
 * produced, with grade hooks attached. Default limit 10, max 50. Read-
 * only — never modifies feedback (Standing Rule #2).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import {
  getSpecialistRecentWork,
  resolveSpecialistIdentity,
} from '@/lib/agents/specialist-introspection-service';

export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().min(1, 'specialist id is required').max(100),
});

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/agents/specialist/recent-work',
    );
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const rawParams = await params;
    const parsedParams = ParamsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid specialist id', details: parsedParams.error.flatten() },
        { status: 422 },
      );
    }

    const url = new URL(request.url);
    const parsedQuery = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query', details: parsedQuery.error.flatten() },
        { status: 422 },
      );
    }

    const specialistId = parsedParams.data.id;
    const { limit } = parsedQuery.data;

    const identity = resolveSpecialistIdentity(specialistId);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: `Specialist '${specialistId}' is not registered` },
        { status: 404 },
      );
    }

    const recentWork = await getSpecialistRecentWork(specialistId, limit);

    return NextResponse.json({
      success: true,
      recentWork,
    });
  } catch (error: unknown) {
    logger.error(
      'Specialist Recent Work API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load specialist recent work' },
      { status: 500 },
    );
  }
}
