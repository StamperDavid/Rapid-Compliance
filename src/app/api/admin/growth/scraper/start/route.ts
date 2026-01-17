/**
 * Admin Scraper API
 * POST to start a new scraper job
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

interface ScraperRequest {
  url: string;
  type: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = (await request.json()) as ScraperRequest;
    const { url, type } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Create scraper job
    const job = {
      id: `scraper_${Date.now()}`,
      url,
      type,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    // In production, queue the scraper job for background processing
    // await queueScraperJob(job);

    logger.info('[AdminScraper] Job started', { url, type, file: 'scraper/start/route.ts' });

    return NextResponse.json({ job });
  } catch (error) {
    logger.error('[AdminScraper] Start failed:', error instanceof Error ? error : new Error(String(error)), { file: 'scraper/start/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
