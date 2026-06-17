/**
 * AI Video Generation API (Magic Studio video tool)
 * POST /api/content/video/generate
 *
 * Auth-gated. The legacy quick-video generator has been removed. Video creation
 * now lives in the Shot Plan tool (Content → Video), which renders shot-by-shot
 * on fal / Seedance and hands the clips to the editor.
 *
 * This endpoint is intentionally inert: it returns a clear, actionable message
 * pointing the operator at the Shot Plan tool rather than failing silently or
 * pretending to start a render. (If we later wire the Studio composer's Video
 * tool to Seedance directly, this is where that generation call goes.)
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/video/generate/route.ts';

const MOVED_MESSAGE =
  'Quick video generation has moved to the Shot Plan tool. Open Content → Video to build ' +
  'and render videos on Seedance, then finish them in the editor.';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  logger.info('[video-generate] Inert endpoint hit — directing operator to Shot Plan', { file: FILE });

  return NextResponse.json(
    {
      success: false,
      error: MOVED_MESSAGE,
      redirectTo: '/content/video',
    },
    { status: 410 },
  );
}
