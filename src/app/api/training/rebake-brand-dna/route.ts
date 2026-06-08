/**
 * Rebake Brand DNA API Route
 * POST /api/training/rebake-brand-dna — publish brand voice → re-bake every agent
 *   Golden Master as a tracked background job. Returns the job id immediately (202).
 * GET  /api/training/rebake-brand-dna — returns the latest rebake job (may be null).
 *
 * Mirrors the auth gate of `api/settings/brand-identity/route.ts`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/auth/api-auth';
import { createRebakeJob, getLatestRebakeJob } from '@/lib/brand/rebake-job-service';
import { runRebakeJob } from '@/lib/brand/rebake-all-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/training/rebake-brand-dna/route.ts';

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const permResult = await requirePermission(request, 'canManageTheme');
    if (permResult instanceof NextResponse) {
      return permResult;
    }

    const job = await createRebakeJob({
      triggeredBy: permResult.user.uid,
      trigger: 'manual-publish',
    });

    // Fire-and-forget the long-running rebake. We intentionally do NOT await it so
    // the caller gets a 202 immediately and polls the job for progress.
    //
    // NOTE: this relies on the detached promise outliving the HTTP response. That
    // holds on a long-running Node server (our dev server / non-serverless deploy).
    // On strict serverless the function could be torn down mid-run after the response
    // is flushed; that is acceptable for current single-tenant dev usage. The
    // .catch() guard ensures an unhandled rejection can never crash the process.
    void runRebakeJob(job.id, permResult.user.uid).catch((error: unknown) => {
      logger.error(
        'Detached rebake job runner failed',
        error instanceof Error ? error : new Error(String(error)),
        { file: FILE, jobId: job.id },
      );
    });

    return NextResponse.json({ success: true, jobId: job.id }, { status: 202 });
  } catch (error) {
    logger.error(
      'Failed to start brand DNA rebake job',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to start brand DNA rebake job' },
      { status: 500 },
    );
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const job = await getLatestRebakeJob();
    return NextResponse.json({ success: true, job });
  } catch (error) {
    logger.error(
      'Failed to fetch latest brand DNA rebake job',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to fetch latest brand DNA rebake job' },
      { status: 500 },
    );
  }
}
