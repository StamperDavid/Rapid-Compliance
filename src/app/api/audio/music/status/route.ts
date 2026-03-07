/**
 * AI Music Status API
 * GET /api/audio/music/status — Check if MiniMax API key is configured
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'minimax');
    return NextResponse.json({ configured: typeof key === 'string' && key.length > 0 });
  } catch {
    return NextResponse.json({ configured: false });
  }
}
