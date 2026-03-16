/**
 * Creative Studio — Providers
 * GET /api/studio/providers — List available providers and their status
 *
 * Returns every registered provider with its capabilities, whether an
 * API key is configured, and a basic health flag.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAvailableProviders } from '@/lib/ai/provider-router';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // 2. Fetch providers with config/health status
    const providers = await getAvailableProviders();

    logger.info('Studio providers: listed providers', {
      count: providers.length,
      configured: providers.filter((p) => p.isConfigured).length,
    });

    return NextResponse.json({
      success: true,
      data: providers,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio providers: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
