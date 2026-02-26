/**
 * Admin Content Generation API
 * POST to generate blog posts or social media content using AI
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const contentGenerationSchema = z.object({
  type: z.enum(['blog', 'social']),
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic too long'),
  brandVoice: z.string().max(100).optional(),
});

interface GeneratedContent {
  title: string;
  content: string;
  excerpt?: string;
  keywords?: string[];
  hashtags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Rate limiting (AI operations: 20 req/min)
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.AI_OPERATIONS);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    const validation = contentGenerationSchema.safeParse(body);

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

    const { type, topic, brandVoice } = validation.data;

    // Generate content using AI
    const { generateText } = await import('@/lib/ai/gemini-service');

    // Load Brand DNA for brand-aware content generation
    let brandDnaContext = '';
    try {
      const { buildToolSystemPrompt } = await import('@/lib/brand/brand-dna-service');
      const toolType = type === 'social' ? 'social' : 'seo';
      const brandPrompt = await buildToolSystemPrompt(toolType);
      if (brandPrompt) {
        brandDnaContext = brandPrompt;
      }
    } catch {
      // Non-blocking — generate without Brand DNA if unavailable
    }

    // Load Golden Playbook for social content generation
    let systemInstruction: string | undefined;
    if (type === 'social') {
      try {
        const { getActivePlaybook } = await import('@/lib/social/golden-playbook-builder');
        const activePlaybook = await getActivePlaybook();
        if (activePlaybook?.compiledPrompt) {
          systemInstruction = brandDnaContext
            ? `${brandDnaContext}\n\n${activePlaybook.compiledPrompt}`
            : activePlaybook.compiledPrompt;
        } else if (brandDnaContext) {
          systemInstruction = brandDnaContext;
        }
      } catch {
        if (brandDnaContext) {
          systemInstruction = brandDnaContext;
        }
        logger.warn('[AdminContent] Could not load Golden Playbook for social generation', { file: 'content/generate/route.ts' });
      }
    } else if (brandDnaContext) {
      // Blog generation — use Brand DNA as system instruction
      systemInstruction = brandDnaContext;
    }

    let prompt = '';
    if (type === 'blog') {
      prompt = `Write a professional blog post about the following topic.
Use a ${brandVoice ?? 'professional'} tone.
The blog should be SEO-optimized, informative, and include a clear call to action.

Topic: ${topic}

Return a JSON object with:
- title: SEO-friendly title
- excerpt: 2-3 sentence summary
- content: Full blog post in markdown format
- keywords: Array of 5 SEO keywords`;
    } else {
      prompt = `Write a LinkedIn post about the following topic.
Use a ${brandVoice ?? 'professional'} tone.
Keep it engaging, under 1300 characters, and include relevant hashtags.

Topic: ${topic}

Return a JSON object with:
- title: Hook/headline
- content: The full post text
- hashtags: Array of relevant hashtags`;
    }

    const response = await generateText(prompt, systemInstruction);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const generated = JSON.parse(jsonMatch[0]) as GeneratedContent;

      const content = {
        id: `content_${Date.now()}`,
        type,
        title: generated.title,
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
        content: generated.content,
        ...(type === 'blog' ? { excerpt: generated.excerpt, keywords: generated.keywords } : { hashtags: generated.hashtags }),
      };

      return NextResponse.json({ content });
    }

    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  } catch (error) {
    logger.error('[AdminContent] Generate failed:', error instanceof Error ? error : new Error(String(error)), { file: 'content/generate/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
