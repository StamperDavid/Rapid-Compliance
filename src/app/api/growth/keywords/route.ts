/**
 * GET/POST /api/growth/keywords
 *
 * List tracked keywords and add new ones.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getKeywordTrackerService } from '@/lib/growth/keyword-tracker';
import {
  AddKeywordSchema,
  KeywordListQuerySchema,
} from '@/lib/growth/growth-validation';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const url = new URL(request.url);
    const parsed = KeywordListQuerySchema.safeParse({
      active: url.searchParams.get('active') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid query' },
        { status: 400 }
      );
    }

    const service = getKeywordTrackerService();
    const keywords = await service.listKeywords({
      activeOnly: parsed.data.active,
      tag: parsed.data.tag,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ success: true, data: keywords });
  } catch (err) {
    logger.error('Growth keywords list error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to list keywords', err instanceof Error ? err : undefined);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = AddKeywordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getKeywordTrackerService();
    const keyword = await service.addKeyword(
      parsed.data.keyword,
      parsed.data.tags,
      authResult.user.uid
    );

    return NextResponse.json({ success: true, data: keyword }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already being tracked')) {
      return errors.badRequest(message);
    }
    logger.error('Growth keyword add error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to add keyword', err instanceof Error ? err : undefined);
  }
}
