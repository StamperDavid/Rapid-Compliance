/**
 * POST /api/growth/competitors/discover
 *
 * Discover competitors in a given niche using the CompetitorResearcher agent.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getCompetitorMonitorService } from '@/lib/growth/competitor-monitor';
import { DiscoverCompetitorsSchema } from '@/lib/growth/growth-validation';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = DiscoverCompetitorsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getCompetitorMonitorService();
    const result = await service.discoverCompetitors(
      parsed.data.niche,
      parsed.data.location,
      parsed.data.limit,
      authResult.user.uid
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('Growth competitor discover error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to discover competitors', err instanceof Error ? err : undefined);
  }
}
