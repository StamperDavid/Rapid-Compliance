/**
 * Saved View item API
 * GET    /api/crm/views/[viewId] - fetch one view
 * PATCH  /api/crm/views/[viewId] - update name / filters / match / sort / shared
 * DELETE /api/crm/views/[viewId] - delete a view
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSavedView,
  updateSavedView,
  deleteSavedView,
  filterConditionsSchema,
  matchModeSchema,
  savedViewSortSchema,
} from '@/lib/crm/saved-views-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const updateViewSchema = z
  .object({
    name: z.string().min(1).optional(),
    filters: filterConditionsSchema.optional(),
    match: matchModeSchema.optional(),
    sort: savedViewSortSchema.optional(),
    shared: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { viewId } = await params;
    const view = await getSavedView(viewId);
    if (!view) {
      return NextResponse.json({ success: false, error: 'View not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, view });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch saved view';
    logger.error('Saved view GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { viewId } = await params;
    const body: unknown = await request.json();
    const parsed = updateViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const view = await updateSavedView(viewId, parsed.data);
    if (!view) {
      return NextResponse.json({ success: false, error: 'View not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, view });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update saved view';
    logger.error('Saved view PATCH failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { viewId } = await params;
    const deleted = await deleteSavedView(viewId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'View not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete saved view';
    logger.error('Saved view DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
