/**
 * GET /api/seo/gsc/properties
 *
 * Returns the list of Google Search Console properties for the connected account.
 * Auth-gated via requireAuth().
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { getGSCService } from '@/lib/integrations/seo/gsc-service';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const gsc = getGSCService();
    const result = await gsc.getProperties();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, data: null },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      cached: result.cached,
    });
  } catch (err) {
    return errors.internal(
      'Failed to fetch GSC properties',
      err instanceof Error ? err : undefined
    );
  }
}
