/**
 * Brand DNA API Route
 * GET  /api/brand-dna  — returns current Brand DNA profile
 * PUT  /api/brand-dna  — updates Brand DNA profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { getBrandDNA, updateBrandDNA } from '@/lib/brand/brand-dna-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/brand-dna/route.ts';

const BrandDNASchema = z.object({
  companyDescription: z.string().min(1, 'Company description is required'),
  uniqueValue: z.string().min(1, 'Unique value proposition is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  toneOfVoice: z.enum([
    'professional',
    'casual',
    'friendly',
    'authoritative',
    'conversational',
    'inspirational',
  ]),
  communicationStyle: z.string().min(1, 'Communication style is required'),
  keyPhrases: z.array(z.string()),
  avoidPhrases: z.array(z.string()),
  industry: z.string().min(1, 'Industry is required'),
  competitors: z.array(z.string()),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const brandDNA = await getBrandDNA();

    return NextResponse.json({ success: true, data: brandDNA });
  } catch (error: unknown) {
    logger.error(
      'Failed to fetch Brand DNA',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE, method: 'GET' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Brand DNA' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    const rawBody: unknown = await request.json();
    const parseResult = BrandDNASchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await updateBrandDNA(parseResult.data, user.uid);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update Brand DNA' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Failed to update Brand DNA',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE, method: 'PUT' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update Brand DNA' },
      { status: 500 }
    );
  }
}
