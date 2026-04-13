/**
 * SMS Purpose Types API — list + create
 *
 * GET  /api/sms-purpose-types              — list active types (UI combobox)
 * GET  /api/sms-purpose-types?all=true     — list all types incl. archived
 * POST /api/sms-purpose-types              — create a new type
 *
 * Parallel to /api/email-purpose-types — same design, separate collection.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getActiveSmsPurposeTypes,
  listAllSmsPurposeTypes,
  createSmsPurposeType,
} from '@/lib/services/sms-purpose-types-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/sms-purpose-types/route.ts';

const CreateBodySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(300),
  slug: z.string().min(2).max(60).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = request.nextUrl;
    const includeArchived = searchParams.get('all') === 'true';

    const types = includeArchived
      ? await listAllSmsPurposeTypes()
      : await getActiveSmsPurposeTypes();

    return NextResponse.json({ success: true, types, total: types.length });
  } catch (error) {
    logger.error('Failed to list SMS purpose types', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to list SMS purpose types' },
      { status: 500 },
    );
  }
}

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

    const created = await createSmsPurposeType(result.data, user.uid);
    return NextResponse.json({ success: true, type: created }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create SMS purpose type', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to create SMS purpose type' },
      { status: 500 },
    );
  }
}
