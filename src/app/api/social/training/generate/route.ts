/**
 * API Route: Social Training - Generate Test Post
 *
 * POST /api/social/training/generate → Generate a test post using AI
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { COLLECTIONS, getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { ModelName } from '@/types/ai-models';

export const dynamic = 'force-dynamic';

const TRAINING_COLLECTION = getSubCollection('toolTraining');
const HISTORY_COLLECTION = getSubCollection('socialGenerationHistory');

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
};

const generateSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'instagram']),
  topic: z.string().min(1, 'Topic is required'),
  saveToHistory: z.boolean().optional().default(false),
});

interface TrainingSettings {
  emojiUsage?: string;
  ctaStyle?: string;
  contentThemes?: string[];
  hashtagStrategy?: string;
  postingPersonality?: string;
}

interface BrandDNA {
  companyDescription?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/training/generate');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { platform, topic, saveToHistory } = validation.data;
    const platformLimit = PLATFORM_LIMITS[platform] ?? 280;

    // Load training settings and brand DNA in parallel
    const [settingsData, orgData] = await Promise.all([
      AdminFirestoreService.get(TRAINING_COLLECTION, 'social'),
      AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID),
    ]);

    const settings = settingsData as TrainingSettings | null | undefined;
    const orgRecord = orgData as { brandDNA?: BrandDNA } | null | undefined;
    const brandDNA = orgRecord?.brandDNA;

    // Build prompt from settings
    const emojiInstruction = (settings?.emojiUsage ?? 'light') === 'none'
      ? 'Do not use any emojis.'
      : (settings?.emojiUsage ?? 'light') === 'light'
        ? 'Use 1-2 relevant emojis sparingly.'
        : 'Use emojis liberally to add personality.';

    const ctaInstruction = (settings?.ctaStyle ?? 'soft') === 'soft'
      ? 'Include a subtle, non-pushy call to action.'
      : (settings?.ctaStyle ?? 'soft') === 'direct'
        ? 'Include a clear, direct call to action.'
        : 'End with an engaging question to drive discussion.';

    const brandContext = brandDNA
      ? `Brand context: ${brandDNA.companyDescription ?? ''}. Tone: ${brandDNA.toneOfVoice ?? 'professional'}. Key phrases to consider: ${(brandDNA.keyPhrases ?? []).join(', ')}.`
      : '';

    const prompt = `Generate a ${platform} post about: ${topic}

Platform: ${platform}
Character limit: ${platformLimit}
${brandContext}
Personality: ${settings?.postingPersonality ?? 'Professional and engaging'}
${emojiInstruction}
${ctaInstruction}
Hashtag strategy: ${settings?.hashtagStrategy ?? 'Include 3-5 relevant hashtags'}
Content themes to align with: ${(settings?.contentThemes ?? []).join(', ')}

Generate ONLY the post content, keeping it under ${platformLimit} characters. Include relevant hashtags at the end.`;

    // Try AI generation
    let responseText = '';
    try {
      const adminKeysRaw = await AdminFirestoreService.get('admin', 'platform-api-keys');
      const adminKeys = adminKeysRaw as { openrouter?: { apiKey?: string } } | null | undefined;

      if (adminKeys?.openrouter?.apiKey) {
        const { OpenRouterProvider } = await import('@/lib/ai/openrouter-provider');
        const provider = new OpenRouterProvider({ apiKey: adminKeys.openrouter.apiKey });

        const modelName: ModelName = 'openrouter/anthropic/claude-3.5-sonnet' as const;
        const response = await provider.chat({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });

        responseText = response.content;
      }
    } catch (aiError) {
      logger.warn('Training Generate: AI provider failed, using fallback', {
        error: aiError instanceof Error ? aiError.message : String(aiError),
      });
    }

    // Fallback if AI not available
    if (!responseText) {
      const demoResponses: Record<string, string> = {
        twitter: `${topic} is transforming how we approach business. The future is AI-powered, and the results speak for themselves.\n\n#SalesTech #AI #Innovation`,
        linkedin: `I've been thinking about ${topic} lately.\n\nIn today's rapidly evolving landscape, staying ahead means embracing new approaches. Here's what I've learned:\n\n1. Innovation drives results\n2. Data-informed decisions matter\n3. Customer success is the ultimate metric\n\nWhat strategies are working for your team?\n\n#Leadership #Innovation #Sales #AI #B2B`,
        instagram: `${topic}\n\nWe're on a mission to transform how teams work. Every day brings new opportunities to innovate and grow.\n\nDouble tap if you agree!\n\n#innovation #tech #business #growth #sales #ai #startup`,
      };
      responseText = demoResponses[platform] ?? demoResponses.twitter;
    }

    // Extract hashtags
    const hashtagMatches = responseText.match(/#\w+/g) ?? [];
    const hashtags = hashtagMatches.map(tag => tag.substring(1));

    const postId = `post_${Date.now()}`;
    const post = {
      id: postId,
      platform,
      content: responseText,
      hashtags,
      characterCount: responseText.length,
      generatedAt: new Date().toISOString(),
      topic,
    };

    // Optionally save to history
    if (saveToHistory) {
      await AdminFirestoreService.set(HISTORY_COLLECTION, postId, {
        ...post,
        saved: true,
      }, false);
    }

    return NextResponse.json({ success: true, post });
  } catch (error: unknown) {
    logger.error('Training Generate: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to generate post' },
      { status: 500 }
    );
  }
}
