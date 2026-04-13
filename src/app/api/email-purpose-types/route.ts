/**
 * Email Purpose Types API — list + create
 *
 * GET  /api/email-purpose-types              — list active types (UI combobox)
 * GET  /api/email-purpose-types?all=true     — list all types incl. archived (admin)
 * POST /api/email-purpose-types              — create a new type (inline from campaign form)
 *
 * See Task #43 rebuild notes in CONTINUATION_PROMPT.md for the design rationale.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getActiveEmailPurposeTypes,
  listAllEmailPurposeTypes,
  createEmailPurposeType,
} from '@/lib/services/email-purpose-types-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/email-purpose-types/route.ts';

const CreateBodySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(300),
  slug: z.string().min(2).max(60).optional(),
});

// ============================================================================
// GET — list types
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = request.nextUrl;
    const includeArchived = searchParams.get('all') === 'true';

    const types = includeArchived
      ? await listAllEmailPurposeTypes()
      : await getActiveEmailPurposeTypes();

    return NextResponse.json({ success: true, types, total: types.length });
  } catch (error) {
    logger.error('Failed to list email purpose types', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to list email purpose types' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — create a new type
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

    const rawBody: unknown = await request.json();
    const result = CreateBodySchema.safeParse(rawBody);
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

    const created = await createEmailPurposeType(result.data, user.uid);

    return NextResponse.json({ success: true, type: created }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create email purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to create email purpose type' },
      { status: 500 },
    );
  }
}
