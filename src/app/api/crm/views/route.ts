/**
 * Saved Views API
 * GET  /api/crm/views?object=contact|company|deal|lead - list visible views
 * POST /api/crm/views                                   - create a view
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  listSavedViews,
  createSavedView,
  filterConditionsSchema,
  matchModeSchema,
  savedViewObjectSchema,
  savedViewSortSchema,
} from '@/lib/crm/saved-views-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const createViewSchema = z.object({
  object: savedViewObjectSchema,
  name: z.string().min(1, 'A view name is required'),
  filters: filterConditionsSchema,
  match: matchModeSchema.optional().default('all'),
  sort: savedViewSortSchema.optional(),
  shared: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const objectResult = savedViewObjectSchema.safeParse(searchParams.get('object'));
    if (!objectResult.success) {
      return NextResponse.json(
        { success: false, error: 'A valid object (contact, company, deal or lead) is required' },
        { status: 400 }
      );
    }

    const views = await listSavedViews(objectResult.data, authResult.user.uid);
    return NextResponse.json({ success: true, data: views });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list saved views';
    logger.error('Saved views GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = createViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { object, name, filters, match, sort, shared } = parsed.data;
    const view = await createSavedView({
      object,
      name,
      filters,
      match,
      ...(sort ? { sort } : {}),
      shared,
      ownerId: authResult.user.uid,
    });

    return NextResponse.json({ success: true, view }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create saved view';
    logger.error('Saved views POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
