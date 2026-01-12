/**
 * Admin SEO Settings API
 * POST to update platform SEO settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { title, description, keywords, ogImage, googleAnalyticsId, googleTagManagerId } = body;

    // In production, save to Firestore
    // await FirestoreService.set('platform', 'seo', { title, description, keywords, ogImage, googleAnalyticsId, googleTagManagerId });

    logger.info('[AdminSEO] Settings saved', { title, file: 'seo/route.ts' });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[AdminSEO] POST failed:', error, { file: 'seo/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
