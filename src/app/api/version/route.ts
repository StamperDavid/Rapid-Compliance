import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Version endpoint — hit /api/version in the browser to see which build is live.
 */
export function GET() {
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
