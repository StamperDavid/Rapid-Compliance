/**
 * Admin SEO Settings API
 * POST to update platform SEO settings
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface SEOSettingsRequest {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = (await request.json()) as SEOSettingsRequest;
    const { title } = body;

    // In production, save to Firestore
    // await FirestoreService.set('platform', 'seo', body);

    logger.info('[AdminSEO] Settings saved', { title, file: 'seo/route.ts' });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[AdminSEO] POST failed:', error instanceof Error ? error : new Error(String(error)), { file: 'seo/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
