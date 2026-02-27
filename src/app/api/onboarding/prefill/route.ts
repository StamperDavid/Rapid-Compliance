/**
 * Onboarding Prefill API Route
 * 
 * Server-side endpoint for prefilling onboarding data using the Discovery Engine.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { prefillOnboardingData } from '@/lib/onboarding/prefill-engine';
import { requireAuth } from '@/lib/auth/api-auth';

const PrefillSchema = z.object({
  websiteUrl: z.string().url(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = PrefillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { websiteUrl } = parsed.data;

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
