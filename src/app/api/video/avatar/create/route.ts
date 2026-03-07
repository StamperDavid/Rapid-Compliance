/**
 * Avatar Creation API
 * POST /api/video/avatar/create
 *
 * HeyGen Instant Avatar creation has been removed. Avatar profiles are now
 * managed via the Kling-based Avatar Profiles system.
 * Use POST /api/video/avatar-profiles instead.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return NextResponse.json(
    {
      success: false,
      error: 'HeyGen has been replaced by Kling Avatar. Use Avatar Profiles instead.',
      migration: 'POST /api/video/avatar-profiles',
    },
    { status: 410 },
  );
}
