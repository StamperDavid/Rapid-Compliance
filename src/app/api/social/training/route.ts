/**
 * API Route: Social Training Settings
 *
 * GET  /api/social/training → Get social training settings + brand DNA + history
 * POST /api/social/training → Save social training settings
 * PUT  /api/social/training → Save a generated post to history
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { COLLECTIONS, getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { SOCIAL_PLATFORMS } from '@/types/social';

export const dynamic = 'force-dynamic';

const TRAINING_COLLECTION = getSubCollection('toolTraining');
const HISTORY_COLLECTION = getSubCollection('socialGenerationHistory');
const KNOWLEDGE_COLLECTION = getSubCollection('socialKnowledge');

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
  platform: z.enum(SOCIAL_PLATFORMS),
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

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    // Fetch settings, brand DNA, history, and knowledge in parallel
    const [settingsData, orgData, historySnapshot, knowledgeSnapshot] = await Promise.all([
      AdminFirestoreService.get(TRAINING_COLLECTION, 'social'),
      AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID),
      AdminFirestoreService.collection(HISTORY_COLLECTION).orderBy('generatedAt', 'desc').limit(50).get(),
      AdminFirestoreService.collection(KNOWLEDGE_COLLECTION).orderBy('uploadedAt', 'desc').limit(50).get(),
    ]);

    const orgRecord = orgData as { brandDNA?: BrandDNA } | null | undefined;

    return NextResponse.json({
      success: true,
      settings: settingsData ?? null,
      brandDNA: orgRecord?.brandDNA ?? null,
      history: historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      knowledge: knowledgeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
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

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = saveSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    await AdminFirestoreService.set(TRAINING_COLLECTION, 'social', {
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

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = saveHistorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    await AdminFirestoreService.set(HISTORY_COLLECTION, validation.data.id, {
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
