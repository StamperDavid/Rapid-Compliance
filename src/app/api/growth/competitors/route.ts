/**
 * GET/POST /api/growth/competitors
 *
 * List tracked competitors and add new ones.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getCompetitorMonitorService } from '@/lib/growth/competitor-monitor';
import {
  AddCompetitorSchema,
  CompetitorListQuerySchema,
} from '@/lib/growth/growth-validation';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const url = new URL(request.url);
    const parsed = CompetitorListQuerySchema.safeParse({
      active: url.searchParams.get('active') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid query' },
        { status: 400 }
      );
    }

    const service = getCompetitorMonitorService();
    const competitors = await service.listCompetitors({
      activeOnly: parsed.data.active,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ success: true, data: competitors });
  } catch (err) {
    logger.error('Growth competitors list error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to list competitors', err instanceof Error ? err : undefined);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = AddCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getCompetitorMonitorService();
    const competitor = await service.addCompetitor(
      parsed.data.domain,
      parsed.data.name,
      parsed.data.niche,
      authResult.user.uid
    );

    return NextResponse.json({ success: true, data: competitor }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already being tracked')) {
      return errors.badRequest(message);
    }
    logger.error('Growth competitor add error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to add competitor', err instanceof Error ? err : undefined);
  }
}
