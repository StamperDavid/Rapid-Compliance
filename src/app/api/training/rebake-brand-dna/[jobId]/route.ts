/**
 * Rebake Brand DNA Job Status API Route
 * GET /api/training/rebake-brand-dna/[jobId] — fetch a single rebake job by id
 *   for progress polling. Returns 404 if the job does not exist.
 *
 * Mirrors the auth gate of `api/settings/brand-identity/route.ts`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getRebakeJob } from '@/lib/brand/rebake-job-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/training/rebake-brand-dna/[jobId]/route.ts';

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { jobId } = await params;
    const job = await getRebakeJob(jobId);

    if (job === null) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    logger.error(
      'Failed to fetch brand DNA rebake job',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to fetch brand DNA rebake job' },
      { status: 500 },
    );
  }
}
