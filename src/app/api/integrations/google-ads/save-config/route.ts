/**
 * Save Google Ads developer token + customer ID.
 *
 * POST /api/integrations/google-ads/save-config
 *   Body: { developerToken: string, customerId: string, loginCustomerId?: string }
 *
 * Gated by requireRole(['owner', 'admin']). Does NOT touch the OAuth tokens —
 * those come from the central Google connect flow.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { saveGoogleAdsConfig } from '@/lib/integrations/google-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  developerToken: z.string().min(8).max(200),
  customerId: z.string().min(9).max(20),
  loginCustomerId: z.string().min(9).max(20).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}

  try {
    const body: unknown = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const result = await saveGoogleAdsConfig(parsed.data);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[GoogleAdsSaveConfigAPI] failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
