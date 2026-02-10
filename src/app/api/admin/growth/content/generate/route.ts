/**
 * Admin Content Generation API
 * POST to generate blog posts or social media content using AI
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface ContentGenerationRequest {
  type: 'blog' | 'social';
  topic: string;
  brandVoice?: string;
}

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

    const body = (await request.json()) as ContentGenerationRequest;
    const { type, topic, brandVoice } = body;

    // Generate content using AI
    const { generateText } = await import('@/lib/ai/gemini-service');

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

    const response = await generateText(prompt);
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
