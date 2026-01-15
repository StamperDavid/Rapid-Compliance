/**
 * Admin Growth Settings API
 * GET/POST SEO settings, content queue, scraper jobs
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Return platform growth settings
    // In production, this would come from Firestore
    return NextResponse.json({
      seo: {
        title: 'AI Sales Platform - GoHighLevel Killer',
        description: 'The only AI-native business automation platform you need.',
        keywords: ['AI sales', 'voice agents', 'CRM automation'],
        ogImage: '',
        googleAnalyticsId: '',
        googleTagManagerId: '',
      },
      content: [],
      scraperJobs: [],
    });
  } catch (error) {
    logger.error('[AdminGrowthSettings] GET failed:', error, { file: 'settings/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
