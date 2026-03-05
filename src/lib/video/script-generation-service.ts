/**
 * AI Video Script Generation Service
 *
 * Shared service used by both:
 * - /api/video/decompose (manual pipeline UI)
 * - Jasper's create_video tool (chat-initiated videos)
 *
 * Uses OpenRouter (Claude 3.5 Sonnet) with Brand DNA and product context.
 * Falls back to improved templates if AI is unavailable.
 */

import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getMemoryVault, shareInsight } from '@/lib/agents/shared';

// ============================================================================
// Types
// ============================================================================

export type ScriptVideoType = 'tutorial' | 'explainer' | 'product-demo' | 'sales-pitch' | 'testimonial' | 'social-ad';
export type ScriptEngine = 'heygen' | 'runway' | 'sora';

export interface ScriptScene {
  sceneNumber: number;
  title: string;
  scriptText: string;
  visualDescription: string;
  suggestedDuration: number;
  engine: ScriptEngine | null;
  backgroundPrompt: string | null;
}

export interface ScriptGenerationResult {
  videoType: string;
  targetAudience: string;
  keyMessages: string[];
  scenes: ScriptScene[];
  assetsNeeded: string[];
  avatarRecommendation: null;
  estimatedTotalDuration: number;
  generatedBy: 'ai' | 'template';
}

export interface ScriptGenerationParams {
  description: string;
  videoType: ScriptVideoType;
  platform: string;
  duration: number;
  targetAudience?: string;
  painPoints?: string;
  talkingPoints?: string;
  tone?: string;
  callToAction?: string;
}

// ============================================================================
// Zod Schema for AI Response Validation
// ============================================================================

const EngineValues = ['heygen', 'runway', 'sora'] as const;

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

// ============================================================================
// AI Prompt Construction
// ============================================================================

function buildSystemPrompt(
  brandContext: string | null,
  productContext: string | null,
): string {
  let prompt = `You are an elite video scriptwriter producing broadcast-quality content for SalesVelocity.ai. Your scripts are written to be SPOKEN ALOUD by an AI avatar — every word matters.

## SCRIPTWRITING CRAFT
- Write for the EAR, not the eye. Read every sentence aloud in your head. If it sounds stilted, rewrite it.
- Use contractions: "you'll", "we've", "it's", "that's". Nobody says "you will" in conversation.
- Vary sentence length. Short punchy sentences for impact. Longer flowing ones for explanation. Mix them.
- Start strong. The first 3 seconds determine if someone keeps watching. Open with a bold statement, a surprising fact, or a direct address to a pain point.
- End each scene with a transition hook — a reason to keep watching the next scene.
- Write a COMPLETE thought per scene. Don't split ideas awkwardly across scenes.
- For B-roll scenes (runway/sora), scriptText MUST be empty string "".

## WHAT TO AVOID
- Corporate jargon: "leverage", "synergize", "paradigm shift", "ecosystem", "streamline", "optimize your workflow"
- Cliché openers: "Did you know", "Are you tired of", "In today's fast-paced world", "Imagine a world where"
- Filler phrases: "It's important to note that", "At the end of the day", "When it comes to"
- Generic claims: "Save time and money", "Take your business to the next level", "Transform your business"
- Be SPECIFIC. Instead of "save time", say "cut your follow-up emails from 2 hours to 10 minutes"

## PRODUCT POSITIONING — MANDATORY
SalesVelocity.ai is a SaaS platform with a BUILT-IN CRM. Pricing is CRM slot-based.
- The CRM is BUILT INTO the platform — contacts, deals, pipeline, activities, AI scoring. All native.
- NEVER say "connect your CRM", "sync your data", "import from Salesforce/HubSpot", or suggest external CRM integration.
- CORRECT: "Your contacts, deals, and pipeline live right inside SalesVelocity", "everything runs from one dashboard", "the built-in CRM handles your entire pipeline".
- The platform REPLACES external CRMs — it doesn't connect to them. Clients get their own AI-powered CRM with a 52-agent AI swarm managing it.

## ENGINE ASSIGNMENT RULES
The default video style is **presenter-led** — the avatar speaks throughout the entire video. This creates a cohesive, professional result like a real person presenting on camera.

Assign **ALL scenes** to **heygen** unless the user specifically requests B-roll or cinematic footage. Each scene should have the presenter speaking with a DIFFERENT backgroundPrompt for visual variety.

Only use these engines if the user explicitly asks for B-roll or cinematic inserts:
- **runway**: Cinematic B-roll — real-world footage style. scriptText must be empty. Only use when explicitly requested.
- **sora**: Currently unreliable — do NOT assign sora to any scene. Use runway instead if B-roll is needed.

## BACKGROUND PROMPTS (REQUIRED for every scene)
Write detailed DALL-E 3 prompts for professional, visually rich backgrounds behind the avatar presenter.
- Each scene MUST have a DIFFERENT background to maintain visual variety without cutting away from the presenter.
- Modern, well-lit environments: creative studios, bright co-working spaces, modern offices with plants.
- The presenter wears a casual polo in a professional setting — NO suits, NO ties.
- Include: specific lighting (warm LEDs, natural window light), depth of field, color palette, props/details.
- Example: "Modern bright office with large monitors showing analytics dashboards, indoor plants, warm LED lighting, shallow depth of field, clean minimal desk"
- Example: "Creative studio with exposed brick, colorful post-it wall, standing desk, warm afternoon light through large windows, bokeh background"
- Example: "Rooftop terrace with city skyline at golden hour, modern outdoor furniture, warm sunset glow, soft bokeh lights"
- Example: "Minimalist white studio with neon accent lighting, geometric shelving, potted succulents, clean modern aesthetic"`;

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

// ============================================================================
// Context Loaders
// ============================================================================

async function loadBrandContext(): Promise<string | null> {
  try {
    const { buildToolSystemPrompt } = await import('@/lib/brand/brand-dna-service');
    const brandPrompt = await buildToolSystemPrompt('voice');
    return brandPrompt || null;
  } catch {
    return null;
  }
}

interface MarketingPersona {
  who?: {
    jobTitles?: string[];
    companySize?: string;
    ageRange?: string;
    industries?: string[];
  };
  psychographics?: {
    mainPainPoints?: string[];
    motivations?: string[];
    buyingTriggers?: string[];
  };
  messagingAngle?: {
    emotionalVsLogical?: string;
    resonantLanguage?: string[];
    languageToAvoid?: string[];
    emotionalHooks?: string[];
  };
  contentPreferences?: {
    formats?: string[];
    style?: string;
  };
}

async function loadMarketingPersona(): Promise<{ persona: MarketingPersona; contextBlock: string } | null> {
  try {
    const vault = getMemoryVault();
    const entries = await vault.query('SCRIPT_GENERATOR', {
      category: 'PROFILE',
      tags: ['marketing-persona'],
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 1,
    });

    if (entries.length === 0) {
      logger.warn('No marketing persona found in MemoryVault — scripts will use description-only context', {
        file: 'script-generation-service.ts',
      });
      return null;
    }

    const entryValue = entries[0].value as Record<string, unknown> | undefined;
    const persona = entryValue?.persona as MarketingPersona | undefined;
    if (!persona) {
      return null;
    }

    const lines: string[] = [];

    if (persona.who) {
      const who = persona.who;
      if (who.jobTitles?.length) {
        lines.push(`**Target roles:** ${who.jobTitles.join(', ')}`);
      }
      if (who.companySize) {
        lines.push(`**Company size:** ${who.companySize}`);
      }
      if (who.ageRange) {
        lines.push(`**Age range:** ${who.ageRange}`);
      }
      if (who.industries?.length) {
        lines.push(`**Industries:** ${who.industries.join(', ')}`);
      }
    }

    if (persona.psychographics) {
      const psych = persona.psychographics;
      if (psych.mainPainPoints?.length) {
        lines.push(`**Pain points:** ${psych.mainPainPoints.join('; ')}`);
      }
      if (psych.motivations?.length) {
        lines.push(`**Motivations:** ${psych.motivations.join('; ')}`);
      }
      if (psych.buyingTriggers?.length) {
        lines.push(`**Buying triggers:** ${psych.buyingTriggers.join('; ')}`);
      }
    }

    if (persona.messagingAngle) {
      const msg = persona.messagingAngle;
      if (msg.emotionalVsLogical) {
        lines.push(`**Tone approach:** ${msg.emotionalVsLogical}`);
      }
      if (msg.resonantLanguage?.length) {
        lines.push(`**Resonant language:** ${msg.resonantLanguage.join(', ')}`);
      }
      if (msg.languageToAvoid?.length) {
        lines.push(`**Avoid using:** ${msg.languageToAvoid.join(', ')}`);
      }
      if (msg.emotionalHooks?.length) {
        lines.push(`**Emotional hooks:** ${msg.emotionalHooks.join('; ')}`);
      }
    }

    if (persona.contentPreferences) {
      const cp = persona.contentPreferences;
      if (cp.formats?.length) {
        lines.push(`**Preferred formats:** ${cp.formats.join(', ')}`);
      }
      if (cp.style) {
        lines.push(`**Content style:** ${cp.style}`);
      }
    }

    if (lines.length === 0) {
      return null;
    }

    return {
      persona,
      contextBlock: lines.join('\n'),
    };
  } catch (error) {
    logger.warn('Failed to load marketing persona from MemoryVault', {
      error: error instanceof Error ? error.message : String(error),
      file: 'script-generation-service.ts',
    });
    return null;
  }
}

async function loadProductContext(): Promise<string | null> {
  try {
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

// ============================================================================
// AI-Powered Script Generation
// ============================================================================

async function generateAIScripts(
  params: ScriptGenerationParams,
  sceneCount: number,
): Promise<ScriptGenerationResult | null> {
  try {
    const [brandContext, productContext, personaResult] = await Promise.all([
      loadBrandContext(),
      loadProductContext(),
      loadMarketingPersona(),
    ]);

    const provider = new OpenRouterProvider(PLATFORM_ID);

    let systemPrompt = buildSystemPrompt(brandContext, productContext);
    if (personaResult) {
      systemPrompt += `\n\n## MARKETING PERSONA (from Growth Strategist analysis)\nUse this audience intelligence to tailor tone, pain points, and messaging:\n${personaResult.contextBlock}`;
    }
    const userPrompt = buildUserPrompt(
      params.description, params.videoType, params.platform, params.duration, sceneCount,
      params.targetAudience, params.painPoints, params.talkingPoints, params.tone, params.callToAction,
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

    const result: ScriptGenerationResult = {
      videoType: params.videoType,
      targetAudience: validated.targetAudience,
      keyMessages: validated.keyMessages,
      scenes: validated.scenes.map((s) => ({
        ...s,
        engine: s.engine,
        backgroundPrompt: s.backgroundPrompt,
      })),
      assetsNeeded: determineAssetsNeeded(params.videoType, params.platform),
      avatarRecommendation: null,
      estimatedTotalDuration: totalDuration,
      generatedBy: 'ai',
    };

    // Share storyboard to MemoryVault for cross-agent access
    try {
      await shareInsight(
        'SCRIPT_GENERATOR',
        'CONTENT',
        `Video Script: ${params.description.slice(0, 50)}`,
        `Generated ${validated.scenes.length} scenes for ${params.videoType} video targeting ${validated.targetAudience}`,
        {
          confidence: 85,
          tags: ['video-script', 'storyboard'],
        },
      );
    } catch (vaultError) {
      logger.warn('Failed to share script insight to MemoryVault', {
        error: vaultError instanceof Error ? vaultError.message : String(vaultError),
      });
    }

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('AI scene generation FAILED — falling back to templates',
      error instanceof Error ? error : new Error(errMsg),
      { file: 'script-generation-service.ts' },
    );
    return null;
  }
}

// ============================================================================
// Template Fallback
// ============================================================================

function generateFallbackScripts(
  params: ScriptGenerationParams,
  sceneCount: number,
): ScriptGenerationResult {
  const scenes: ScriptScene[] = [];
  const durationPerScene = Math.floor(params.duration / sceneCount);
  const topic = params.description.substring(0, 120);

  switch (params.videoType) {
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
        visualDescription: 'Presenter opens with a bold statement, direct to camera',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Sleek modern conference room with glass walls, city skyline visible, dramatic lighting, shallow depth of field',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Challenge',
        scriptText: `Most teams waste hours on this. The old way of doing things just doesn't cut it anymore.`,
        visualDescription: 'Presenter explains the pain point with empathy',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Creative studio with exposed brick walls, warm pendant lighting, comfortable setting with plants and books',
      });

      scenes.push({
        sceneNumber: 3,
        title: 'The Solution',
        scriptText: `That's exactly why we built this. It takes what used to be a headache and makes it automatic.`,
        visualDescription: 'Presenter introduces the solution with enthusiasm',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern tech office with large displays showing dashboards and analytics, blue accent lighting, clean aesthetic',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Key Benefits',
          scriptText: `The results speak for themselves. Teams are saving hours every week and getting better outcomes.`,
          visualDescription: 'Presenter highlights key metrics and results',
          suggestedDuration: durationPerScene,
          engine: 'heygen',
          backgroundPrompt: 'Bright co-working space with whiteboard showing growth charts, natural window light, green plants, energetic atmosphere',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Call to Action',
        scriptText: `Ready to see this in action? Head over to the link below and try it free.`,
        visualDescription: 'Presenter delivers CTA with confident smile',
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
        visualDescription: 'Presenter connects empathetically with the viewer',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Warm cozy office with bookshelves, soft lighting, plants, inviting atmosphere',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'Introducing the Solution',
        scriptText: `What if this whole process could run on autopilot? That's exactly what we built.`,
        visualDescription: 'Presenter introduces the product with excitement',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern tech lab with holographic displays, cool blue ambient lighting, futuristic minimal design',
      });

      scenes.push({
        sceneNumber: 3,
        title: 'Why It Works',
        scriptText: `Unlike anything else out there, this actually delivers. It's fast, simple, and the results are real.`,
        visualDescription: 'Presenter walks through key differentiators',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern creative workspace with whiteboard showing strategy diagrams, bright natural light',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Social Proof',
          scriptText: `Our customers are seeing real results. One team cut their prospecting time by 80% in the first week. Another closed three new deals in their first month.`,
          visualDescription: 'Presenter shares testimonials with conviction',
          suggestedDuration: durationPerScene,
          engine: 'heygen',
          backgroundPrompt: 'Bright open-plan office with team celebration in background, motivational wall art, warm afternoon light',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Offer',
        scriptText: `Want to see these results yourself? Click below and let's get you started. Seriously, you'll thank yourself later.`,
        visualDescription: 'Presenter delivers confident CTA',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Professional studio with clean branded backdrop, confident warm lighting, inviting atmosphere',
      });
      break;
    }

    default: {
      scenes.push({
        sceneNumber: 1,
        title: 'Opening',
        scriptText: `Hey! I want to show you something that's going to change how you think about ${topic}.`,
        visualDescription: 'Opening title with eye-catching visual',
        suggestedDuration: durationPerScene,
        engine: 'heygen',
        backgroundPrompt: 'Modern bright office with clean desk, large monitor, indoor plants, warm professional lighting',
      });

      const bgPrompts = [
        'Creative open workspace with colorful accent wall, modern furniture, warm pendant lighting, plants',
        'Rooftop terrace with city skyline, golden hour light, modern outdoor lounge furniture, warm atmosphere',
        'Minimalist white studio with neon accent lighting, geometric shelving, potted succulents, clean aesthetic',
        'Industrial chic office with exposed beams, brick walls, warm Edison bulbs, comfortable seating area',
        'Bright library with floor-to-ceiling bookshelves, reading nook, natural light, cozy academic atmosphere',
      ];
      for (let i = 2; i < sceneCount; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Point ${i - 1}`,
          scriptText: `Let me show you how this works in practice. It's simpler than you'd think.`,
          visualDescription: `Presenter demonstrates key feature ${i - 1}`,
          suggestedDuration: durationPerScene,
          engine: 'heygen',
          backgroundPrompt: bgPrompts[(i - 2) % bgPrompts.length],
        });
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
    videoType: params.videoType,
    targetAudience: params.targetAudience ?? 'Business professionals and teams',
    keyMessages: extractKeyMessages(params.description, params.videoType),
    scenes,
    assetsNeeded: determineAssetsNeeded(params.videoType, params.platform),
    avatarRecommendation: null,
    estimatedTotalDuration: scenes.reduce((sum, s) => sum + s.suggestedDuration, 0),
    generatedBy: 'template',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractKeyMessages(description: string, videoType: ScriptVideoType): string[] {
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

function determineAssetsNeeded(videoType: ScriptVideoType, _platform: string): string[] {
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
// Main Export — Single entry point for all callers
// ============================================================================

/**
 * Generate AI-powered video scripts with Brand DNA and product context.
 * Falls back to templates if AI generation fails.
 *
 * Used by:
 * - /api/video/decompose (manual Video Studio pipeline)
 * - Jasper's create_video tool (chat-initiated videos)
 */
export async function generateVideoScripts(
  params: ScriptGenerationParams,
): Promise<ScriptGenerationResult> {
  const sceneCount = Math.max(2, Math.min(8, Math.ceil(params.duration / 15)));

  const aiResult = await generateAIScripts(params, sceneCount);

  if (aiResult) {
    logger.info('AI video scripts generated', {
      videoType: params.videoType,
      sceneCount: aiResult.scenes.length,
      generatedBy: 'ai',
      file: 'script-generation-service.ts',
    });
    return aiResult;
  }

  logger.info('Using template fallback for video scripts', {
    videoType: params.videoType,
    file: 'script-generation-service.ts',
  });

  return generateFallbackScripts(params, sceneCount);
}
