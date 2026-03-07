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
export type ScriptEngine = 'heygen' | 'runway' | 'sora' | 'kling';

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
  /** Visual theme/vibe for consistent aesthetics across all scenes.
   *  Examples: "warm corporate", "tech noir", "golden hour cinematic",
   *  "bright minimalist", "industrial creative". Constrains all background
   *  descriptions to maintain visual coherence throughout the video. */
  vibe?: string;
  /** Avatar profile context — tells the AI which avatar is available and what it can do */
  avatar?: {
    name: string;
    description?: string | null;
    hasReferenceImages: boolean;   // true = character-in-action scenes possible (Kling Reference)
    hasFullBodyImage: boolean;     // true = full body shots possible
    voiceProvider: string | null;  // 'elevenlabs' | 'heygen' | etc.
    voiceName?: string | null;     // human-readable voice label
  };
}

// ============================================================================
// Zod Schema for AI Response Validation
// ============================================================================

const EngineValues = ['heygen', 'runway', 'sora', 'kling'] as const;

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
  avatarContext?: ScriptGenerationParams['avatar'],
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
Our system uses **cinematic two-track compositing**: the avatar is rendered on a green screen, then composited over an AI-generated video background using chroma key. This produces broadcast-quality videos where the presenter appears IN real environments with motion, lighting, and cinematic depth — NOT static images.

### Scene Types:
1. **Presenter/avatar scenes (kling)** — Avatar speaks on green screen. The backgroundPrompt drives a CINEMATIC VIDEO background generated by a separate engine. The two are composited together.
2. **Character-in-action scenes (kling)** — Avatar's likeness placed IN a described scenario (e.g., superhero flying, explorer in a jungle, presenter walking through an office). Uses reference images for character consistency. scriptText contains narration/voiceover. ONLY possible when avatar has reference images.
3. **B-roll scenes (runway or kling)** — Pure cinematic footage with NO avatar. scriptText MUST be empty "". Used for visual storytelling transitions, product close-ups, atmospheric shots.

### Engine Capabilities — USE THIS TO PICK THE RIGHT ENGINE:
- **kling**: PRIMARY avatar engine. Creates talking head video from a single photo + audio. Also excels at:
  - Character consistency using reference images (avatar's face in ANY scenario)
  - Stylized/creative content (sci-fi, fantasy, abstract, artistic)
  - Action sequences and dynamic motion
  - Full-body character animation
  - Assign to ALL scenes where the presenter speaks (talking head)
  - Assign to character-in-action scenes (avatar doing things, not just talking)
  - Assign to stylized or creative B-roll (fantasy, sci-fi, abstract, neon, artistic)

- **runway**: Best for photorealistic environments and cinematic B-roll. Excels at:
  - Photorealistic environment/location footage
  - Slow, atmospheric, moody B-roll (golden hour, cityscapes, nature)
  - Smooth camera movements (dolly, pan, crane shots)
  - Professional product/office/workspace environments
  - Assign to B-roll that needs photorealistic cinematic quality
  - Assign to establishing shots, transitions, atmospheric footage

- **heygen**: Optional premium talking head. Only use if explicitly requested by the user. Do NOT default to heygen.

- **sora**: Currently unreliable — do NOT assign sora to any scene.

### Engine selection rules:
- Avatar speaks to camera → **kling** (primary), heygen ONLY if user explicitly requested it
- Avatar in a creative scenario (superhero, explorer, character role) → **kling** (character-in-action)
- Photorealistic environment B-roll → **runway**
- Stylized/fantasy/sci-fi B-roll → **kling**
- Action sequences or dynamic motion → **kling**
- Slow atmospheric/cinematic B-roll → **runway**
- Product screenshots or UI demos → **runway** (subtle motion over static UI)

### Mix it up!
A great video alternates between presenter scenes and B-roll/cinematic inserts. For a 5-scene video, consider: presenter → B-roll → presenter → B-roll → presenter. This creates visual rhythm like a real production.

## BACKGROUND PROMPTS (REQUIRED for every avatar/presenter scene)
Write cinematic VIDEO SCENE descriptions for the background behind the avatar. These drive AI video generation (Runway/Kling), NOT static images. Think of each as a film set description with MOTION and ATMOSPHERE.
- Each scene MUST have a DIFFERENT environment to maintain visual variety.
- Describe the setting, camera angle, lighting quality, movement, and atmosphere.
- Include subtle motion: "gentle camera dolly forward", "soft parallax movement", "light rays shifting through blinds", "subtle bokeh drifting".
- Think CINEMATIC — these are video backgrounds, not photographs.
- Example: "Slow dolly forward through a modern office with floor-to-ceiling windows, morning light casting long shadows, monitors glowing with analytics dashboards, subtle lens flare, shallow depth of field"
- Example: "Smooth pan across a creative studio with exposed brick walls, warm pendant lights swaying gently, colorful sticky notes on a glass wall, afternoon golden hour light streaming in"
- Example: "Aerial establishing shot of a city skyline at golden hour, slow zoom in, warm sunset glow reflecting off glass buildings, soft atmospheric haze"
- Example: "Close-up dolly along a sleek desk setup with a laptop screen showing growth charts, ambient neon accent lighting, slight rack focus, tech-modern aesthetic"
- Example: "Gentle handheld movement through a rooftop terrace, warm string lights, city skyline blurred in background, golden hour warmth, casual sophisticated atmosphere"

## VISUAL CONSISTENCY (CRITICAL)
All scenes in a video MUST share the same visual DNA:
- Same color temperature (warm or cool) across all backgrounds
- Same lighting style (natural, studio, dramatic, ambient)
- Same level of formality (casual spaces vs corporate offices)
- Scene variety comes from DIFFERENT LOCATIONS with the SAME MOOD, not different moods
- Think of it like a film: different shots, one cinematographer's vision`;

  if (avatarContext) {
    let avatarBlock = `\n\n## AVATAR / PRESENTER
The default avatar for this video is **"${avatarContext.name}"**.`;
    if (avatarContext.description) {
      avatarBlock += ` (${avatarContext.description})`;
    }
    avatarBlock += '\n';
    if (avatarContext.voiceProvider) {
      avatarBlock += `- Voice: ${avatarContext.voiceName ?? avatarContext.voiceProvider} (${avatarContext.voiceProvider}).\n`;
    }
    if (avatarContext.hasReferenceImages) {
      avatarBlock += `- This avatar has REFERENCE IMAGES — you CAN write character-in-action scenes (the avatar placed IN creative scenarios like exploring, flying, presenting on a stage, etc.).\n`;
      if (avatarContext.hasFullBodyImage) {
        avatarBlock += `- Full body reference available — full body and action shots are possible.\n`;
      }
    } else {
      avatarBlock += `- This avatar has a FRONTAL PHOTO ONLY — stick to talking-head/presenter scenes (no character-in-action). The avatar will be composited over video backgrounds.\n`;
    }
    avatarBlock += `- Use this avatar for ALL presenter scenes unless the creative concept calls for no avatar.`;
    prompt += avatarBlock;
  }

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
      "scriptText": "Spoken words for avatar scenes, empty string for B-roll",
      "visualDescription": "What the viewer sees — include character actions for character-in-action scenes",
      "suggestedDuration": 12,
      "engine": "kling" | "runway" | "heygen",
      "backgroundPrompt": "Cinematic video background prompt for avatar scenes, null for B-roll"
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
  vibe?: string,
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
  if (vibe) {
    prompt += `\n**Visual vibe/theme:** ${vibe} — ALL background descriptions must match this aesthetic consistently across every scene. Different locations, same cinematographic vision.`;
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

    let systemPrompt = buildSystemPrompt(brandContext, productContext, params.avatar);
    if (personaResult) {
      systemPrompt += `\n\n## MARKETING PERSONA (from Growth Strategist analysis)\nUse this audience intelligence to tailor tone, pain points, and messaging:\n${personaResult.contextBlock}`;
    }
    const userPrompt = buildUserPrompt(
      params.description, params.videoType, params.platform, params.duration, sceneCount,
      params.targetAudience, params.painPoints, params.talkingPoints, params.tone, params.callToAction,
      params.vibe,
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
        engine: 'kling',
        backgroundPrompt: 'Modern bright office with large monitor showing tutorial interface, indoor plants, warm lighting, clean desk',
      });

      for (let i = 2; i < sceneCount; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Step ${i - 1}`,
          scriptText: `Now let me show you step ${i - 1}. This is where things get interesting.`,
          visualDescription: `Screen recording showing step ${i - 1} in action`,
          suggestedDuration: durationPerScene,
          engine: 'kling',
          backgroundPrompt: 'Clean workspace with soft ambient lighting, monitor displaying software interface, shallow depth of field',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Summary & Next Steps',
        scriptText: `And that's it! You've got everything you need to get started. Try it out and let me know how it goes.`,
        visualDescription: 'Summary slide with key takeaways',
        suggestedDuration: durationPerScene,
        engine: 'kling',
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
        engine: 'kling',
        backgroundPrompt: 'Sleek modern conference room with glass walls, city skyline visible, dramatic lighting, shallow depth of field',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Challenge',
        scriptText: `Most teams waste hours on this. The old way of doing things just doesn't cut it anymore.`,
        visualDescription: 'Presenter explains the pain point with empathy',
        suggestedDuration: durationPerScene,
        engine: 'kling',
        backgroundPrompt: 'Creative studio with exposed brick walls, warm pendant lighting, comfortable setting with plants and books',
      });

      scenes.push({
        sceneNumber: 3,
        title: 'The Solution',
        scriptText: `That's exactly why we built this. It takes what used to be a headache and makes it automatic.`,
        visualDescription: 'Presenter introduces the solution with enthusiasm',
        suggestedDuration: durationPerScene,
        engine: 'kling',
        backgroundPrompt: 'Modern tech office with large displays showing dashboards and analytics, blue accent lighting, clean aesthetic',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Key Benefits',
          scriptText: `The results speak for themselves. Teams are saving hours every week and getting better outcomes.`,
          visualDescription: 'Presenter highlights key metrics and results',
          suggestedDuration: durationPerScene,
          engine: 'kling',
          backgroundPrompt: 'Bright co-working space with whiteboard showing growth charts, natural window light, green plants, energetic atmosphere',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Call to Action',
        scriptText: `Ready to see this in action? Head over to the link below and try it free.`,
        visualDescription: 'Presenter delivers CTA with confident smile',
        suggestedDuration: durationPerScene,
        engine: 'kling',
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
        engine: 'kling',
        backgroundPrompt: 'Warm cozy office with bookshelves, soft lighting, plants, inviting atmosphere',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'Introducing the Solution',
        scriptText: `What if this whole process could run on autopilot? That's exactly what we built.`,
        visualDescription: 'Presenter introduces the product with excitement',
        suggestedDuration: durationPerScene,
        engine: 'kling',
        backgroundPrompt: 'Modern tech lab with holographic displays, cool blue ambient lighting, futuristic minimal design',
      });

      scenes.push({
        sceneNumber: 3,
        title: 'Why It Works',
        scriptText: `Unlike anything else out there, this actually delivers. It's fast, simple, and the results are real.`,
        visualDescription: 'Presenter walks through key differentiators',
        suggestedDuration: durationPerScene,
        engine: 'kling',
        backgroundPrompt: 'Modern creative workspace with whiteboard showing strategy diagrams, bright natural light',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Social Proof',
          scriptText: `Our customers are seeing real results. One team cut their prospecting time by 80% in the first week. Another closed three new deals in their first month.`,
          visualDescription: 'Presenter shares testimonials with conviction',
          suggestedDuration: durationPerScene,
          engine: 'kling',
          backgroundPrompt: 'Bright open-plan office with team celebration in background, motivational wall art, warm afternoon light',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Offer',
        scriptText: `Want to see these results yourself? Click below and let's get you started. Seriously, you'll thank yourself later.`,
        visualDescription: 'Presenter delivers confident CTA',
        suggestedDuration: durationPerScene,
        engine: 'kling',
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
        engine: 'kling',
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
          engine: 'kling',
          backgroundPrompt: bgPrompts[(i - 2) % bgPrompts.length],
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Wrap Up',
        scriptText: `That's a wrap! If any of this clicked for you, check out the link below. Let's make it happen.`,
        visualDescription: 'CTA with contact info',
        suggestedDuration: durationPerScene,
        engine: 'kling',
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
