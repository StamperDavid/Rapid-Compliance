/**
 * Email Purpose Types API — single-type operations
 *
 * GET    /api/email-purpose-types/[typeId] — fetch one type by slug
 * PATCH  /api/email-purpose-types/[typeId] — update name / description / active
 * DELETE /api/email-purpose-types/[typeId] — archive (soft-delete, preserves history)
 *
 * `typeId` is the stable slug, not a Firestore-generated id, so these
 * routes are human-readable: `/api/email-purpose-types/cold_intro`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getEmailPurposeTypeBySlug,
  updateEmailPurposeType,
  archiveEmailPurposeType,
} from '@/lib/services/email-purpose-types-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/email-purpose-types/[typeId]/route.ts';

const UpdateBodySchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().min(10).max(300).optional(),
  active: z.boolean().optional(),
});

// ============================================================================
// GET — fetch single type
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { typeId } = await params;
    const type = await getEmailPurposeTypeBySlug(typeId);
    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Email purpose type not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, type });
  } catch (error) {
    logger.error('Failed to fetch email purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email purpose type' },
      { status: 500 },
    );
  }
}

// ============================================================================
// PATCH — update type
// ============================================================================

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

    const updated = await updateEmailPurposeType(typeId, result.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Email purpose type not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, type: updated });
  } catch (error) {
    logger.error('Failed to update email purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to update email purpose type' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — archive (soft-delete)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { typeId } = await params;
    const existing = await getEmailPurposeTypeBySlug(typeId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Email purpose type not found' },
        { status: 404 },
      );
    }

    await archiveEmailPurposeType(typeId);
    return NextResponse.json({ success: true, archived: typeId });
  } catch (error) {
    logger.error('Failed to archive email purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to archive email purpose type' },
      { status: 500 },
    );
  }
}
