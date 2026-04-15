/**
 * Rollback Specialist Golden Master API
 *
 * POST /api/training/grade-specialist/[specialistId]/rollback
 * Body: { industryKey: string, targetVersion: number, reason?: string }
 *
 * Deploys a previous Golden Master version, effectively rolling back a
 * Prompt Engineer edit that turned out to harm specialist performance.
 * Uses the existing deployIndustryGMVersion primitive which atomically
 * deactivates the current active version and activates the target,
 * then invalidates the in-memory GM cache so the next specialist call
 * immediately uses the rolled-back prompt.
 *
 * The `reason` field is optional for M2c — we're going with single
 * confirmation instead of required explanation per Q1's Option A. If
 * provided, we log it for audit trail but don't require it.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { deployIndustryGMVersion } from '@/lib/training/specialist-golden-master-service';

export const dynamic = 'force-dynamic';

const RollbackSchema = z.object({
  industryKey: z.string().min(1).max(100),
  targetVersion: z.number().int().min(1).max(10000),
  reason: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ specialistId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  const { specialistId } = await params;
  if (!specialistId) {
    return NextResponse.json(
      { success: false, error: 'specialistId is required' },
      { status: 400 },
    );
  }

  try {
    const body: unknown = await request.json();
    const parsed = RollbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { industryKey, targetVersion, reason } = parsed.data;

    logger.info('[SpecialistRollback] Rolling back', {
      specialistId,
      industryKey,
      targetVersion,
      operator: user.uid,
      reason: reason ?? '(none)',
    });

    const result = await deployIndustryGMVersion(specialistId, industryKey, targetVersion);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Rollback deploy failed' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      specialistId,
      industryKey,
      rolledBackToVersion: targetVersion,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      '[SpecialistRollback] POST failed',
      error instanceof Error ? error : new Error(errorMessage),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
