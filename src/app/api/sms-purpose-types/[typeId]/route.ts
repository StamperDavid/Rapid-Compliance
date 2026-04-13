/**
 * SMS Purpose Types API — single-type operations
 *
 * GET    /api/sms-purpose-types/[typeId] — fetch one type by slug
 * PATCH  /api/sms-purpose-types/[typeId] — update name / description / active
 * DELETE /api/sms-purpose-types/[typeId] — archive (soft-delete)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getSmsPurposeTypeBySlug,
  updateSmsPurposeType,
  archiveSmsPurposeType,
} from '@/lib/services/sms-purpose-types-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/sms-purpose-types/[typeId]/route.ts';

const UpdateBodySchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().min(10).max(300).optional(),
  active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { typeId } = await params;
    const type = await getSmsPurposeTypeBySlug(typeId);
    if (!type) {
      return NextResponse.json(
        { success: false, error: 'SMS purpose type not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, type });
  } catch (error) {
    logger.error('Failed to fetch SMS purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SMS purpose type' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { typeId } = await params;
    const rawBody: unknown = await request.json();
    const result = UpdateBodySchema.safeParse(rawBody);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.') || 'unknown',
            message: e.message || 'Validation error',
          })),
        },
        { status: 400 },
      );
    }

    const updated = await updateSmsPurposeType(typeId, result.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'SMS purpose type not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, type: updated });
  } catch (error) {
    logger.error('Failed to update SMS purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to update SMS purpose type' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { typeId } = await params;
    const existing = await getSmsPurposeTypeBySlug(typeId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'SMS purpose type not found' },
        { status: 404 },
      );
    }

    await archiveSmsPurposeType(typeId);
    return NextResponse.json({ success: true, archived: typeId });
  } catch (error) {
    logger.error('Failed to archive SMS purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to archive SMS purpose type' },
      { status: 500 },
    );
  }
}
