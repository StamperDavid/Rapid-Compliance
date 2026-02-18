/**
 * API Route: Social Training Settings
 *
 * GET  /api/social/training → Get social training settings + brand DNA + history
 * POST /api/social/training → Save social training settings
 * PUT  /api/social/training → Save a generated post to history
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const TRAINING_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/toolTraining`;
const HISTORY_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/socialGenerationHistory`;
const KNOWLEDGE_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/socialKnowledge`;

interface BrandDNA {
  companyDescription?: string;
  uniqueValue?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  communicationStyle?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  industry?: string;
  competitors?: string[];
}

const saveHistorySchema = z.object({
  id: z.string().min(1),
  platform: z.enum(['twitter', 'linkedin', 'instagram']),
  content: z.string().min(1),
  topic: z.string(),
  hashtags: z.array(z.string()).optional(),
  characterCount: z.number().optional(),
  generatedAt: z.string(),
});

const saveSettingsSchema = z.object({
  emojiUsage: z.enum(['none', 'light', 'heavy']),
  ctaStyle: z.enum(['soft', 'direct', 'question']),
  contentThemes: z.array(z.string()),
  hashtagStrategy: z.string(),
  postingPersonality: z.string(),
  platformPreferences: z.object({
    twitter: z.object({ maxLength: z.number(), style: z.string() }).optional(),
    linkedin: z.object({ format: z.string(), tone: z.string() }).optional(),
    instagram: z.object({ captionStyle: z.string(), hashtagCount: z.number() }).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Fetch settings, brand DNA, history, and knowledge in parallel
    const [settingsData, orgData, historyResult, knowledgeResult] = await Promise.all([
      FirestoreService.get(TRAINING_COLLECTION, 'social'),
      FirestoreService.get(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID),
      FirestoreService.getAllPaginated(HISTORY_COLLECTION, [orderBy('generatedAt', 'desc')], 50),
      FirestoreService.getAllPaginated(KNOWLEDGE_COLLECTION, [orderBy('uploadedAt', 'desc')], 50),
    ]);

    const orgRecord = orgData as { brandDNA?: BrandDNA } | null | undefined;

    return NextResponse.json({
      success: true,
      settings: settingsData ?? null,
      brandDNA: orgRecord?.brandDNA ?? null,
      history: historyResult.data ?? [],
      knowledge: knowledgeResult.data ?? [],
    });
  } catch (error: unknown) {
    logger.error('Training API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to load training settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = saveSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    await FirestoreService.set(TRAINING_COLLECTION, 'social', {
      ...validation.data,
      updatedAt: new Date().toISOString(),
      updatedBy: authResult.user.uid,
    }, true);

    logger.info('Training API: Settings saved', { userId: authResult.user.uid });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Training API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to save training settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = saveHistorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    await FirestoreService.set(HISTORY_COLLECTION, validation.data.id, {
      ...validation.data,
      saved: true,
    }, false);

    logger.info('Training API: Post saved to history', { postId: validation.data.id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Training API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to save to history' },
      { status: 500 }
    );
  }
}
