/**
 * Executive Briefing API Endpoint
 *
 * GET /api/orchestrator/executive-briefing
 *   Returns the latest executive briefing for the authenticated user.
 *   Jasper generates a "while you were away" summary from all 9 departments.
 *
 * Authentication: Required (owner or admin)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getJasperCommandAuthority } from '@/lib/orchestrator/jasper-command-authority';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Require owner or admin role
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const authority = getJasperCommandAuthority();
    const briefing = await authority.generateExecutiveBriefing();

    return NextResponse.json({
      success: true,
      briefing: {
        ...briefing,
        generatedAt: briefing.generatedAt.toISOString(),
        periodStart: briefing.periodStart.toISOString(),
        periodEnd: briefing.periodEnd.toISOString(),
        pendingApprovals: briefing.pendingApprovals.map(a => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          expiresAt: a.expiresAt?.toISOString() ?? null,
        })),
      },
    });
  } catch (error: unknown) {
    logger.error(
      'Executive briefing generation failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/executive-briefing' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
