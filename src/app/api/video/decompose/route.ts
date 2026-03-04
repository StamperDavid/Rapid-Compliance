/**
 * Video Decomposition API
 * POST /api/video/decompose - Generate AI-driven scene breakdown from video description
 *
 * Uses OpenRouter (Claude 3.5 Sonnet) with Brand DNA and product context to
 * generate compelling, natural scripts with multi-engine scene direction.
 * Falls back to templates if AI call fails.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const VideoTypeValues = ['tutorial', 'explainer', 'product-demo', 'sales-pitch', 'testimonial', 'social-ad'] as const;
const PlatformValues = ['youtube', 'tiktok', 'instagram', 'linkedin', 'website'] as const;
const ToneValues = ['conversational', 'professional', 'energetic', 'empathetic'] as const;
const EngineValues = ['heygen', 'runway', 'sora'] as const;

const DecomposeSchema = z.object({
  description: z.string().min(1, 'Video description required'),
  videoType: z.enum(VideoTypeValues),
  platform: z.enum(PlatformValues),
  duration: z.number().min(10).max(600).default(60),
  targetAudience: z.string().optional(),
  painPoints: z.string().optional(),
  talkingPoints: z.string().optional(),
  tone: z.enum(ToneValues).optional(),
  callToAction: z.string().optional(),
});

// Zod schema for validating AI response
const AISceneSchema = z.object({
  sceneNumber: z.number(),
  title: z.string(),
  scriptText: z.string(),
  visualDescription: z.string(),
  suggestedDuration: z.number(),
  engine: z.enum(EngineValues),
  backgroundPrompt: z.string().nullable(),
});

const AIResponseSchema = z.object({
  targetAudience: z.string(),
  keyMessages: z.array(z.string()),
  scenes: z.array(AISceneSchema),
});

type VideoType = typeof VideoTypeValues[number];

interface DecomposePlan {
  videoType: string;
  targetAudience: string;
  keyMessages: string[];
  scenes: Array<{
    sceneNumber: number;
    title: string;
    scriptText: string;
    visualDescription: string;
    suggestedDuration: number;
    engine: 'heygen' | 'runway' | 'sora' | null;
    backgroundPrompt: string | null;
  }>;
  assetsNeeded: string[];
  avatarRecommendation: null;
  estimatedTotalDuration: number;
  generatedBy: 'ai' | 'template';
}

// ============================================================================
// AI Script Generation
// ============================================================================

function buildSystemPrompt(
  brandContext: string | null,
  productContext: string | null,
): string {
  let prompt = `You are a professional video scriptwriter for SalesVelocity.ai. You write scripts that sound natural when spoken aloud — conversational, engaging, and human.

## CRITICAL RULES
- Write scripts as SPOKEN WORDS, not marketing copy. Use contractions, natural pauses, and conversational language.
- Never use corporate jargon like "leverage", "synergize", "paradigm shift", or "ecosystem".
- Never start with "Did you know" or "Are you tired of" — these are cliché and boring.
- Scripts should feel like a smart friend explaining something, not a telemarketer reading a script.
- Keep sentences short. Average 10-15 words per sentence for spoken delivery.
- For B-roll scenes (runway/sora), scriptText MUST be empty string "".

## ENGINE ASSIGNMENT RULES
Assign each scene one of these engines:
- **heygen**: Avatar talking-head scenes. Use for dialogue, explanations, introductions, CTAs. ALWAYS include a backgroundPrompt for these scenes.
- **runway**: Cinematic B-roll, product demonstrations, real-world footage. scriptText must be empty.
- **sora**: Abstract visuals, motion graphics, data visualizations, dramatic transitions. scriptText must be empty.

Mix engines for visual variety. A 5-scene video should typically have 3 heygen + 1-2 B-roll scenes.

## BACKGROUND PROMPTS (for heygen scenes only)
Write DALL-E 3 image prompts that create professional, visually rich backgrounds.
- The presenter wears a casual polo shirt in a professional setting — NO suits, NO ties.
- Modern, well-lit environments. Think: modern office with plants, creative studio, bright co-working space.
- Include specific details: lighting, depth of field, color palette.
- Example: "Modern bright office with large monitors showing analytics dashboards, indoor plants, warm LED lighting, shallow depth of field, clean minimal desk"`;

  if (brandContext) {
    prompt += `\n\n## BRAND CONTEXT\n${brandContext}`;
  }

  if (productContext) {
    prompt += `\n\n## PRODUCTS & SERVICES\nReference these real offerings in scripts where relevant:\n${productContext}`;
  }

  prompt += `\n\n## RESPONSE FORMAT
Return ONLY valid JSON (no markdown, no code fences) matching this structure:
{
  "targetAudience": "string describing the ideal viewer",
  "keyMessages": ["3 key takeaways"],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene Title",
      "scriptText": "Spoken words for heygen scenes, empty string for B-roll",
      "visualDescription": "What the viewer sees",
      "suggestedDuration": 12,
      "engine": "heygen" | "runway" | "sora",
      "backgroundPrompt": "DALL-E prompt for heygen scenes, null for B-roll"
    }
  ]
}`;

  return prompt;
}

function buildUserPrompt(
  description: string,
  videoType: string,
  platform: string,
  duration: number,
  sceneCount: number,
  targetAudience?: string,
  painPoints?: string,
  talkingPoints?: string,
  tone?: string,
  callToAction?: string,
): string {
  let prompt = `Create a ${sceneCount}-scene ${videoType.replace('-', ' ')} video script for ${platform}.

**Topic:** ${description}
**Total duration:** ${duration} seconds (distribute evenly across scenes)`;

  if (targetAudience) {
    prompt += `\n**Target audience:** ${targetAudience}`;
  }
  if (painPoints) {
    prompt += `\n**Pain points to address:** ${painPoints}`;
  }
  if (talkingPoints) {
    prompt += `\n**Key talking points:** ${talkingPoints}`;
  }
  if (tone) {
    prompt += `\n**Tone:** ${tone}`;
  }
  if (callToAction) {
    prompt += `\n**Call to action:** ${callToAction}`;
  }

  prompt += `\n\nWrite the complete scene breakdown as JSON.`;

  return prompt;
}

async function loadBrandContext(): Promise<string | null> {
  try {
    const { buildToolSystemPrompt } = await import('@/lib/brand/brand-dna-service');
    const brandPrompt = await buildToolSystemPrompt('voice');
    return brandPrompt || null;
  } catch {
    return null;
  }
}

async function loadProductContext(): Promise<string | null> {
  try {
    // Use adminDb directly for server-side access
    const { adminDb } = await import('@/lib/firebase/admin');
    if (!adminDb) { return null; }
    const snapshot = await adminDb.collection('products').limit(5).get();
    if (snapshot.empty) { return null; }

    const products = snapshot.docs.map((doc) => {
      const data = doc.data();
      const name = String(data.name ?? 'Unnamed');
      const desc = data.description ? ` — ${String(data.description).substring(0, 100)}` : '';
      const price = data.price ? ` ($${String(data.price)})` : '';
      return `- ${name}${desc}${price}`;
    });

    return products.join('\n');
  } catch {
    return null;
  }
}

async function generateAISceneBreakdown(
  description: string,
  videoType: string,
  platform: string,
  duration: number,
  sceneCount: number,
  targetAudience?: string,
  painPoints?: string,
  talkingPoints?: string,
  tone?: string,
  callToAction?: string,
): Promise<DecomposePlan | null> {
  try {
    // Load brand + product context in parallel (non-blocking)
    const [brandContext, productContext] = await Promise.all([
      loadBrandContext(),
      loadProductContext(),
    ]);

    const provider = new OpenRouterProvider(PLATFORM_ID);

    const systemPrompt = buildSystemPrompt(brandContext, productContext);
    const userPrompt = buildUserPrompt(
      description, videoType, platform, duration, sceneCount,
      targetAudience, painPoints, talkingPoints, tone, callToAction,
    );

    const response = await provider.chat({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });

    if (!response.content) {
      logger.warn('AI scene generation returned empty content');
      return null;
    }

    // Strip markdown code fences if present
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = AIResponseSchema.parse(parsed);

    const totalDuration = validated.scenes.reduce((sum, s) => sum + s.suggestedDuration, 0);

    return {
      videoType,
      targetAudience: validated.targetAudience,
      keyMessages: validated.keyMessages,
      scenes: validated.scenes.map((s) => ({
        ...s,
        engine: s.engine,
        backgroundPrompt: s.backgroundPrompt,
      })),
      assetsNeeded: determineAssetsNeeded(videoType as VideoType, platform),
      avatarRecommendation: null,
      estimatedTotalDuration: totalDuration,
      generatedBy: 'ai',
    };
  } catch (error) {
    logger.warn('AI scene generation failed, falling back to templates', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Template Fallback
// ============================================================================

function generateFallbackScenes(
  description: string,
  videoType: VideoType,
  _platform: string,
  duration: number,
  sceneCount: number,
): DecomposePlan {
  const scenes: DecomposePlan['scenes'] = [];
  const durationPerScene = Math.floor(duration / sceneCount);
  const topic = description.substring(0, 120);

  switch (videoType) {
    case 'tutorial': {
      scenes.push({
        sceneNumber: 1,
        title: 'Introduction',
        scriptText: `Hey, welcome! Today I'm going to walk you through ${topic}. By the end, you'll know exactly how to do this yourself.`,
        visualDescription: 'Title card with tutorial topic, professional background',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern bright office with large monitor showing tutorial interface, indoor plants, warm lighting, clean desk',
      });

      for (let i = 2; i < sceneCount; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Step ${i - 1}`,
          scriptText: `Now let me show you step ${i - 1}. This is where things get interesting.`,
          visualDescription: `Screen recording showing step ${i - 1} in action`,
          suggestedDuration: durationPerScene,
          engine: 'heygen',
          backgroundPrompt: 'Clean workspace with soft ambient lighting, monitor displaying software interface, shallow depth of field',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Summary & Next Steps',
        scriptText: `And that's it! You've got everything you need to get started. Try it out and let me know how it goes.`,
        visualDescription: 'Summary slide with key takeaways',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Bright creative studio with motivational backdrop, warm tones, professional lighting',
      });
      break;
    }

    case 'explainer': {
      scenes.push({
        sceneNumber: 1,
        title: 'Hook',
        scriptText: `Here's something that might surprise you about ${topic}. Let me break it down.`,
        visualDescription: 'Attention-grabbing visual with bold text overlay',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Sleek modern conference room with glass walls, city skyline visible, dramatic lighting, shallow depth of field',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Challenge',
        scriptText: `Most teams waste hours on this. The old way of doing things just doesn't cut it anymore.`,
        visualDescription: 'Visualization of common pain points',
        suggestedDuration: durationPerScene,
        engine: 'runway',
        backgroundPrompt: null,
      });

      scenes.push({
        sceneNumber: 3,
        title: 'The Solution',
        scriptText: `That's exactly why we built this. It takes what used to be a headache and makes it automatic.`,
        visualDescription: 'Product demonstration',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern tech office with large displays showing dashboards and analytics, blue accent lighting, clean aesthetic',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Key Benefits',
          scriptText: `The results speak for themselves. Teams are saving hours every week and getting better outcomes.`,
          visualDescription: 'Benefits with icons and metrics',
          suggestedDuration: durationPerScene,
          engine: 'sora',
          backgroundPrompt: null,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Call to Action',
        scriptText: `Ready to see this in action? Head over to the link below and try it free.`,
        visualDescription: 'CTA with website URL',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Bright professional studio with branded backdrop, warm inviting lighting, casual setting',
      });
      break;
    }

    case 'sales-pitch': {
      scenes.push({
        sceneNumber: 1,
        title: 'The Pain Point',
        scriptText: `If you're dealing with ${topic}, I get it. It's frustrating, and you're not alone.`,
        visualDescription: 'Relatable scenario',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Warm cozy office with bookshelves, soft lighting, plants, inviting atmosphere',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'Introducing the Solution',
        scriptText: `What if this whole process could run on autopilot? That's exactly what we built.`,
        visualDescription: 'Product introduction',
        suggestedDuration: durationPerScene,
        engine: 'runway',
        backgroundPrompt: null,
      });

      scenes.push({
        sceneNumber: 3,
        title: 'Why It Works',
        scriptText: `Unlike anything else out there, this actually delivers. It's fast, simple, and the results are real.`,
        visualDescription: 'Feature benefits comparison',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern creative workspace with whiteboard showing strategy diagrams, bright natural light',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Social Proof',
          scriptText: '',
          visualDescription: 'Customer testimonials and success metrics montage',
          suggestedDuration: durationPerScene,
          engine: 'sora',
          backgroundPrompt: null,
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Offer',
        scriptText: `Want to see these results yourself? Click below and let's get you started. Seriously, you'll thank yourself later.`,
        visualDescription: 'Offer with pricing',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Professional studio with clean branded backdrop, confident warm lighting, inviting atmosphere',
      });
      break;
    }

    default: {
      // product-demo, testimonial, social-ad, and generic fallback
      scenes.push({
        sceneNumber: 1,
        title: 'Opening',
        scriptText: `Hey! I want to show you something that's going to change how you think about ${topic}.`,
        visualDescription: 'Opening title with eye-catching visual',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern bright office with clean desk, large monitor, indoor plants, warm professional lighting',
      });

      for (let i = 2; i < sceneCount; i++) {
        if (i % 3 === 0) {
          // B-roll scene
          scenes.push({
            sceneNumber: i,
            title: `Visual Break ${Math.ceil(i / 3)}`,
            scriptText: '',
            visualDescription: 'Cinematic B-roll showcasing the product in action',
            suggestedDuration: durationPerScene,
            engine: 'runway',
            backgroundPrompt: null,
          });
        } else {
          scenes.push({
            sceneNumber: i,
            title: `Point ${i - 1}`,
            scriptText: `Let me show you how this works in practice. It's simpler than you'd think.`,
            visualDescription: `Demonstration of key feature ${i - 1}`,
            suggestedDuration: durationPerScene,
            engine: 'heygen',
            backgroundPrompt: 'Clean modern workspace with ambient lighting, shallow depth of field, professional setting',
          });
        }
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Wrap Up',
        scriptText: `That's a wrap! If any of this clicked for you, check out the link below. Let's make it happen.`,
        visualDescription: 'CTA with contact info',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Bright creative studio space with branded elements, warm inviting lighting',
      });
      break;
    }
  }

  return {
    videoType,
    targetAudience: 'Business professionals and teams',
    keyMessages: extractKeyMessages(description, videoType),
    scenes,
    assetsNeeded: determineAssetsNeeded(videoType, _platform),
    avatarRecommendation: null,
    estimatedTotalDuration: scenes.reduce((sum, s) => sum + s.suggestedDuration, 0),
    generatedBy: 'template',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractKeyMessages(description: string, videoType: VideoType): string[] {
  const messages: string[] = [];

  if (videoType === 'tutorial') {
    messages.push('Step-by-step guidance', 'Practical implementation');
  } else if (videoType === 'explainer') {
    messages.push('Clear problem-solution narrative', 'Educational value');
  } else if (videoType === 'product-demo') {
    messages.push('Feature showcase', 'Practical use cases');
  } else if (videoType === 'sales-pitch') {
    messages.push('Value proposition', 'ROI and benefits');
  } else if (videoType === 'testimonial') {
    messages.push('Authentic customer story', 'Real-world results');
  } else if (videoType === 'social-ad') {
    messages.push('Immediate engagement', 'Clear call-to-action');
  }

  const descLower = description.toLowerCase();
  if (descLower.includes('save time') || descLower.includes('efficiency')) {
    messages.push('Time savings and efficiency');
  }

  return messages.slice(0, 3);
}

function determineAssetsNeeded(videoType: VideoType, _platform: string): string[] {
  const baseAssets = ['Brand logo', 'Background music'];

  if (videoType === 'tutorial' || videoType === 'product-demo') {
    return [...baseAssets, 'Screen recordings', 'Product screenshots'];
  } else if (videoType === 'testimonial') {
    return [...baseAssets, 'Customer video footage', 'B-roll clips'];
  } else if (videoType === 'social-ad') {
    return [...baseAssets, 'Eye-catching graphics', 'Motion graphics'];
  } else if (videoType === 'explainer') {
    return [...baseAssets, 'Infographics', 'Icon set', 'Animation assets'];
  } else if (videoType === 'sales-pitch') {
    return [...baseAssets, 'Product images', 'Statistics graphics', 'Testimonial clips'];
  }

  return baseAssets;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parseResult = DecomposeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { description, videoType, platform, duration,
            targetAudience, painPoints, talkingPoints, tone, callToAction } = parseResult.data;

    logger.info('Video Decompose API: Generating scene breakdown', {
      videoType,
      platform,
      duration,
    });

    const sceneCount = Math.max(2, Math.min(8, Math.ceil(duration / 15)));

    // Try AI-powered generation first
    const aiPlan = await generateAISceneBreakdown(
      description, videoType, platform, duration, sceneCount,
      targetAudience, painPoints, talkingPoints, tone, callToAction,
    );

    const plan: DecomposePlan = aiPlan ?? generateFallbackScenes(
      description, videoType, platform, duration, sceneCount,
    );

    logger.info('Video Decompose API: Scene breakdown generated', {
      generatedBy: plan.generatedBy,
      sceneCount: plan.scenes.length,
    });

    return NextResponse.json({
      success: true,
      plan,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video decompose API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
