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
  organizationId?: string;
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
    const { websiteUrl, organizationId } = body;

    // Validation
    if (!websiteUrl || typeof websiteUrl !== 'string') {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    logger.info('Prefill API request received', {
      websiteUrl,
      organizationId,
    });

    // Call prefill engine
    const result = await prefillOnboardingData(websiteUrl);

    logger.info('Prefill API request complete', {
      websiteUrl,
      organizationId,
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
