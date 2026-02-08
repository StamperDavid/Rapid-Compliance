/**
 * Onboarding Prefill API Route
 * 
 * Server-side endpoint for prefilling onboarding data using the Discovery Engine.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { prefillOnboardingData } from '@/lib/onboarding/prefill-engine';

interface PrefillRequestBody {
  websiteUrl?: string;
}

function isPrefillRequestBody(value: unknown): value is PrefillRequestBody {
  return typeof value === 'object' && value !== null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isPrefillRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { websiteUrl } = body;

    // Validation
    if (!websiteUrl || typeof websiteUrl !== 'string') {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    logger.info('Prefill API request received', {
      websiteUrl,
    });

    // Call prefill engine
    const result = await prefillOnboardingData(websiteUrl);

    logger.info('Prefill API request complete', {
      websiteUrl,
      overallConfidence: result.overallConfidence,
      fieldsPrefilledCount: Object.keys(result.fieldConfidences).length,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Prefill API error', error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/onboarding/prefill',
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Failed to prefill onboarding data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
