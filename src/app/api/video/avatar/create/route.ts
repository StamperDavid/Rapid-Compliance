/**
 * Avatar Creation API
 * POST /api/video/avatar/create
 *
 * Instant Avatar creation via the old third-party provider has been removed.
 * Avatar profiles are now managed via the Avatar Profiles system (Character Library).
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
      error: 'This path has been removed. Use Avatar Profiles (the Character Library) instead.',
      migration: 'POST /api/video/avatar-profiles',
    },
    { status: 410 },
  );
}
