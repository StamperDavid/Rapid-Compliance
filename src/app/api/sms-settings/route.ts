/**
 * SMS Settings API
 *
 * GET   /api/sms-settings — fetch current SMS config
 * PATCH /api/sms-settings — update SMS config fields (partial update)
 *
 * Single document, not a collection. The SMS Specialist loads this at
 * runtime for maxCharCap injection. The future sending layer reads it
 * for strict enforcement before handing messages to the carrier API.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getSmsSettings,
  updateSmsSettings,
} from '@/lib/services/sms-settings-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/sms-settings/route.ts';

const UpdateBodySchema = z.object({
  maxCharCap: z.number().int().min(160).max(1600).optional(),
  defaultSenderId: z.string().max(20).optional(),
  complianceRegion: z.enum(['US', 'CA', 'UK', 'EU', 'AU', 'OTHER']).optional(),
  requireComplianceFooter: z.boolean().optional(),
  defaultShortenerDomain: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const settings = await getSmsSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    logger.error('Failed to fetch SMS settings', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SMS settings' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const { user } = authResult;

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

    const updated = await updateSmsSettings(result.data, user.uid);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    logger.error('Failed to update SMS settings', error as Error, { file: FILE });
    return NextResponse.json(
      { success: false, error: 'Failed to update SMS settings' },
      { status: 500 },
    );
  }
}
