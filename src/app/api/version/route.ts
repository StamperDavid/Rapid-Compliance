import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * Version endpoint — returns build metadata for the currently deployed revision.
 * Restricted to owner and admin roles to prevent reconnaissance by unauthenticated callers.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    commitShort: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 8),
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? 'unknown',
    deployedAt: process.env.VERCEL_URL ?? 'localhost',
    jasperModel: 'anthropic/claude-3.5-sonnet',
    buildTime: new Date().toISOString(),
  });
}
