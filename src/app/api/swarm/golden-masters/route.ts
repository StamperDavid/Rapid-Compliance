/**
 * Specialist Golden Masters API
 *
 * GET  /api/swarm/golden-masters?specialistId=SCRAPER_SPECIALIST
 *      → List all GM versions for a specialist
 *
 * POST /api/swarm/golden-masters   { specialistId, specialistName }
 *      → Seed v1 if none exists
 *
 * PUT  /api/swarm/golden-masters   { specialistId, version }
 *      → Deploy a specific version
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import {
  ListSpecialistGMsRequestSchema,
  SeedSpecialistGMRequestSchema,
  DeploySpecialistGMRequestSchema,
} from '@/lib/training/agent-training-validation';
import {
  listSpecialistGMVersions,
  getOrCreateSpecialistGM,
  deploySpecialistGM,
} from '@/lib/training/specialist-golden-master-service';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_KEY = '/api/swarm/golden-masters';

/**
 * GET — List all Golden Master versions for a specialist
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMIT_KEY);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const parseResult = ListSpecialistGMsRequestSchema.safeParse({
      specialistId: searchParams.get('specialistId') ?? '',
    });

    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'specialistId is required');
    }

    const { specialistId } = parseResult.data;
    const versions = await listSpecialistGMVersions(specialistId);

    return NextResponse.json({
      success: true,
      specialistId,
      versions,
      count: versions.length,
    });
  } catch (error) {
    logger.error(
      '[SpecialistGMAPI] GET failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to list Golden Master versions'
    );
  }
}

/**
 * POST — Seed v1 if none exists
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMIT_KEY);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body = await request.json() as unknown;
    const parseResult = SeedSpecialistGMRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { specialistId, specialistName } = parseResult.data;
    const createdBy = 'user' in authResult ? authResult.user.uid : 'unknown';

    const gm = await getOrCreateSpecialistGM(specialistId, specialistName, createdBy);

    if (!gm) {
      return errors.internal('Failed to seed Golden Master');
    }

    logger.info('[SpecialistGMAPI] Seeded/returned v1', { specialistId });

    return NextResponse.json({
      success: true,
      goldenMaster: gm,
    });
  } catch (error) {
    logger.error(
      '[SpecialistGMAPI] POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to seed Golden Master'
    );
  }
}

/**
 * PUT — Deploy a specific version
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMIT_KEY);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body = await request.json() as unknown;
    const parseResult = DeploySpecialistGMRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { specialistId, version } = parseResult.data;
    const result = await deploySpecialistGM(specialistId, version);

    if (!result.success) {
      return errors.badRequest(result.error ?? 'Deploy failed');
    }

    logger.info('[SpecialistGMAPI] Deployed', { specialistId, version });

    return NextResponse.json({
      success: true,
      message: `Deployed Golden Master v${version} for ${specialistId}`,
      specialistId,
      version,
    });
  } catch (error) {
    logger.error(
      '[SpecialistGMAPI] PUT failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to deploy Golden Master'
    );
  }
}
