/**
 * API Route: Specialist Identity + Active GM + Last Grade + Currently Working
 *
 * GET /api/agents/specialist/{id}
 *
 * Returns identity, the currently active industry-scoped Golden Master,
 * the most recent training-feedback grade, and any in-flight missions
 * the specialist is currently contributing to. Read-only — never modifies
 * GMs or feedback (Standing Rule #2).
 *
 * Industry key is hardcoded to `'saas_sales_ops'` to match what the
 * marketing specialists (Bluesky, Mastodon, Twitter/X, …) use today.
 * When per-tenant industry resolution lands, this becomes a query-string
 * parameter.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import {
  getSpecialistActiveGMSummary,
  getSpecialistCurrentlyWorking,
  getSpecialistLastGrade,
  resolveSpecialistIdentity,
} from '@/lib/agents/specialist-introspection-service';

export const dynamic = 'force-dynamic';

const INDUSTRY_KEY = 'saas_sales_ops';

const ParamsSchema = z.object({
  id: z.string().min(1, 'specialist id is required').max(100),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/agents/specialist',
    );
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const rawParams = await params;
    const parsed = ParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid specialist id', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const specialistId = parsed.data.id;

    const identity = resolveSpecialistIdentity(specialistId);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: `Specialist '${specialistId}' is not registered` },
        { status: 404 },
      );
    }

    const [activeGM, lastGrade, currentlyWorking] = await Promise.all([
      getSpecialistActiveGMSummary(specialistId, INDUSTRY_KEY),
      getSpecialistLastGrade(specialistId),
      getSpecialistCurrentlyWorking(specialistId),
    ]);

    return NextResponse.json({
      success: true,
      specialist: {
        id: identity.id,
        name: identity.name,
        role: identity.role,
        reportsTo: identity.reportsTo,
        capabilities: identity.capabilities,
        activeGM,
        lastGrade,
        currentlyWorking,
      },
    });
  } catch (error: unknown) {
    logger.error(
      'Specialist Identity API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load specialist details' },
      { status: 500 },
    );
  }
}
