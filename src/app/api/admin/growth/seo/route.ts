/**
 * Admin SEO Settings API
 * POST to update platform SEO settings
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// MAJ-31 & MAJ-32: Zod validation for SEO settings with proper length limits
const seoSettingsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(60, 'Title must be 60 characters or less'),
  description: z.string().min(1, 'Description is required').max(160, 'Description must be 160 characters or less'),
  keywords: z.array(z.string()).optional().default([]),
  ogImage: z.string().url('OG Image must be a valid URL').optional().default(''),
  googleAnalyticsId: z.string().optional().default(''),
  googleTagManagerId: z.string().optional().default(''),
});

interface _SEOSettingsRequest {
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

    const body: unknown = await request.json();
    const validation = seoSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const validatedBody = validation.data;
    const { title } = validatedBody;

    // Save SEO settings to Firestore
    await AdminFirestoreService.set(
      getSubCollection('platform_settings'),
      'seo',
      validatedBody as Record<string, unknown>
    );

    logger.info('[AdminSEO] Settings saved', { title, file: 'seo/route.ts' });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[AdminSEO] POST failed:', error instanceof Error ? error : new Error(String(error)), { file: 'seo/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
