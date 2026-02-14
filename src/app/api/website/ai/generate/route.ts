/**
 * POST /api/website/ai/generate
 * Generate a website page using AI from a natural language prompt
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { generatePageFromPrompt } from '@/lib/website-builder/ai-page-generator';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const generatePageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  pageType: z.string().max(100).optional(),
  style: z.object({
    primaryColor: z.string().max(20).optional(),
    tone: z.string().max(100).optional(),
  }).optional(),
  brandInfo: z.object({
    name: z.string().max(200).optional(),
    tagline: z.string().max(500).optional(),
    industry: z.string().max(100).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (AI operations — more restrictive)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/website/ai/generate');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validation
    const body: unknown = await request.json();
    const parseResult = generatePageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { prompt, pageType, style, brandInfo } = parseResult.data;

    const result = await generatePageFromPrompt(prompt, {
      pageType,
      style,
      brandInfo,
    });

    return NextResponse.json({
      success: true,
      title: result.title,
      slug: result.slug,
      sections: result.sections,
      seo: result.seo,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Website AI generation API failed', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/ai/generate',
    });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
