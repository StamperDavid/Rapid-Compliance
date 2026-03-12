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
export type ScriptEngine = 'hedra';

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
    voiceProvider: string | null;  // 'elevenlabs' | 'unrealspeech' | 'custom' | etc.
    voiceName?: string | null;     // human-readable voice label
  };
}

// ============================================================================
// Zod Schema for AI Response Validation
// ============================================================================

const AISceneSchema = z.object({
  sceneNumber: z.number(),
  title: z.string(),
  scriptText: z.string(),
  visualDescription: z.string(),
  suggestedDuration: z.number(),
  // Accept any engine string from the AI but normalize to 'hedra' (sole engine)
  engine: z.string().nullable().transform(() => 'hedra' as const),
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
  let prompt = `You are an elite video scriptwriter and cinematic director producing broadcast-quality content for SalesVelocity.ai. Your scripts are written to be SPOKEN ALOUD by an AI avatar — every word matters.

## VIDEO ENGINE — HEDRA
All scenes use **Hedra** — an AI video engine that generates short clips (up to 5 seconds each) featuring a character avatar speaking to camera. Multiple clips are stitched together to form the final video.

**What this means for your scripts:**
- Every scene = one short Hedra clip (5-12 seconds of speech, stitched from multiple 5s generations)
- Every scene has a character speaking — no silent B-roll, no empty scripts
- The avatar's face and voice carry the entire video
- backgroundPrompt describes what appears BEHIND the character
- Write scripts that flow naturally when scenes are played back-to-back

## CINEMATIC SCRIPTWRITING

### Voice & Delivery
- Write for the EAR, not the eye. Read every line aloud in your head. If it sounds stilted, rewrite it.
- Use contractions: "you'll", "we've", "it's", "that's". Nobody says "you will" in conversation.
- Vary sentence length. Short punchy sentences for impact. Longer flowing ones for explanation. Mix them.
- Match vocabulary to emotional intent: urgent scenes get sharp, clipped phrasing. Warm scenes get softer, more melodic language.

### Narrative Arc (CRITICAL)
Structure the video like a short film, not a slide deck:
1. **HOOK** — First scene grabs attention in 3 seconds. Bold claim, surprising stat, or visceral pain point. Make them FEEL something.
2. **TENSION** — Build emotional stakes. Show what's at risk, what's broken, what keeps them up at night. Use concrete scenarios, not abstract problems.
3. **TURN** — The pivot moment. Introduce the solution/insight with energy. This is the "but here's the thing..." moment.
4. **PROOF** — Make it real. Specific numbers, tangible outcomes, vivid before/after scenarios. Paint the picture of life AFTER the solution.
5. **CLOSE** — End with confident momentum. Clear next step, emotional resonance, callback to the hook.

Not every video needs all 5 beats, but every video needs an emotional arc — a journey from problem to possibility.

### Scene-to-Scene Flow
- Each scene MUST end with a **transition hook** — an incomplete thought, a question, or a teaser that pulls the viewer into the next scene.
- Each scene MUST begin by picking up the thread from the previous scene. No jarring topic jumps.
- The emotional temperature should BUILD across scenes — start conversational, peak with conviction, close with warmth.
- Think of scenes as chapters, not slides.

### Emotional Direction
For EVERY scene, write the script with a specific emotional tone in mind:
- Scene 1 might be **curious and conspiratorial** — like sharing a secret
- Scene 2 might be **empathetic and frustrated** — showing you get the pain
- Scene 3 might be **excited and confident** — the energy of a breakthrough
- Scene 4 might be **authoritative and precise** — backing claims with proof
- Scene 5 might be **warm and inviting** — genuine, open, personal

Vary the emotional register. A video where every scene sounds the same is boring. A video with emotional dynamics is compelling.

### Visual Descriptions (visualDescription field)
This describes what the VIEWER SEES — the full cinematic scene description that will be sent to the video AI:
- **CHARACTER APPEARANCE (MANDATORY — COPY FROM USER PROMPT)**: The user's Topic field contains the character descriptions. You MUST use EXACTLY the character details the user provided — their specified age, gender, ethnicity, clothing, and physical features. DO NOT invent a different character. DO NOT default to any generic character. If the user says "older Black man in his 50s with gray temples wearing a rumpled polo shirt", that is EXACTLY who appears in every scene — not a woman, not a younger person, not different clothing. Copy their character description faithfully.
- **CHARACTER IN MOTION**: The character should be ACTIVE within the environment — NOT a static talking head. Describe them moving through the space, interacting with objects, walking, turning, working. Every scene should feel like a moment captured from a real person's day, not a webcam recording.
- **EMOTIONAL ENERGY**: Layer in body language and emotional state ON TOP of the action.
- **SHOT COMPOSITION**: Camera framing and feel — tracking shots, medium shots, over-the-shoulder, wide establishing shots, etc.
- **IMPORTANT**: The character description should be CONSISTENT across all scenes — same person, same wardrobe, same look. Only vary their actions, emotional energy, and camera angle per scene.
- Match the visual energy to the script's emotional tone
- **AVOID**: Static talking-head shots where the character just stands and speaks to camera. Prefer characters IN the scene, doing things, moving naturally.

## WHAT TO AVOID
- Corporate jargon: "leverage", "synergize", "paradigm shift", "ecosystem", "streamline", "optimize your workflow"
- Cliché openers: "Did you know", "Are you tired of", "In today's fast-paced world", "Imagine a world where"
- Filler phrases: "It's important to note that", "At the end of the day", "When it comes to"
- Generic claims: "Save time and money", "Take your business to the next level", "Transform your business"
- Monotone delivery: Every scene sounding the same emotionally
- Disconnected scenes: Topics that jump without narrative thread
- Be SPECIFIC. Instead of "save time", say "cut your follow-up emails from 2 hours to 10 minutes"

## PRODUCT POSITIONING — MANDATORY
SalesVelocity.ai is a SaaS platform with a BUILT-IN CRM. Pricing is CRM slot-based.
- The CRM is BUILT INTO the platform — contacts, deals, pipeline, activities, AI scoring. All native.
- NEVER say "connect your CRM", "sync your data", "import from Salesforce/HubSpot", or suggest external CRM integration.
- CORRECT: "Your contacts, deals, and pipeline live right inside SalesVelocity", "everything runs from one dashboard", "the built-in CRM handles your entire pipeline".
- The platform REPLACES external CRMs — it doesn't connect to them. Clients get their own AI-powered CRM with a 52-agent AI swarm managing it.

## BACKGROUND PROMPTS (REQUIRED for every scene)
Write cinematic descriptions for the environment/setting of each scene.
- Think like a FILM DIRECTOR choosing locations for a commercial — the setting should feel like one continuous world.
- Most scenes should share the SAME primary location (e.g. the same office, the same studio). Only introduce a new location when the story demands it (e.g. a flashback, a contrast shot, or a dramatic reveal).
- Even within the same location, vary the CAMERA ANGLE and FRAMING — wide establishing shot, then close-up at the desk, then over-the-shoulder at the whiteboard. Same room, different perspectives.
- Describe the setting, lighting quality, color palette, and atmosphere.
- Include subtle detail: "warm golden hour light", "soft bokeh in background", "cool blue ambient glow", "dramatic side lighting".
- Match the background mood to the script's emotional tone.
- Think CINEMATIC — these are film set descriptions.
- Example (same location, different angles): Scene 1: "Modern office with floor-to-ceiling windows, wide establishing shot, morning light casting long shadows, warm amber tones" → Scene 2: "Same modern office, close-up at a standing desk, monitors glowing with dashboards, shallow depth of field" → Scene 3: "Same office, glass conference room, team gathered around a screen, natural light from windows"
- Only change location for NARRATIVE reasons: "Rooftop terrace at sunset — the tone shifts to personal reflection, warm string lights, city skyline blurred in background"

## VISUAL CONSISTENCY (CRITICAL)
All scenes in a video MUST share the same visual DNA:
- Same PRIMARY LOCATION for most scenes — only change when the story requires it
- Same color temperature (warm or cool) across all backgrounds
- Same lighting style (natural, studio, dramatic, ambient)
- Same level of formality (casual spaces vs corporate offices)
- Think of it like a film: different shots of the SAME WORLD, one cinematographer's vision
- A location change is a DELIBERATE storytelling choice, not a default`;

  if (!avatarContext) {
    prompt += `\n\n## CHARACTER / PRESENTER (NO AVATAR SELECTED)
No specific avatar has been chosen — the video AI will generate the character automatically from your descriptions.
- **DERIVE the character from the user's prompt.** If the user says "male sales rep in his 30s", write a male character in his 30s. If the user says "female CEO", write a female CEO. NEVER override the user's character description.
- You MUST describe the presenter/character in the visualDescription of EVERY scene.
- Keep the SAME character description consistent across all scenes: same age, gender, clothing, grooming, presence.
- Vary only their emotional energy, body language, and camera angle — NOT their appearance.
- If the user's prompt does not specify a character, invent one that fits the video's tone and audience.
- If the video concept has NO on-screen presenter (e.g. product demo, cinematic B-roll), describe the subjects and actions instead.`;
  }

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
      "title": "Scene Title — also conveys the emotional beat (e.g. 'The Wake-Up Call', 'The Breakthrough')",
      "scriptText": "Natural spoken script with emotional direction. Write EXACTLY what the avatar says — conversational, specific, compelling. 15-25 words per 5 seconds of duration.",
      "visualDescription": "Full scene description: character appearance (age, gender, clothing, grooming), their demeanor (leaning in, gesturing, serious gaze), shot framing (close-up, medium), mood (warm, tense, excited). Keep character appearance CONSISTENT across all scenes.",
      "suggestedDuration": 12,
      "engine": "hedra",
      "backgroundPrompt": "Cinematic background: setting + lighting + color palette + atmosphere. Must match the script's emotional tone."
    }
  ]
}

QUALITY CHECK — Before returning, verify:
1. Does the opening scene hook within 3 seconds?
2. Does each scene end with a reason to keep watching?
3. Do the emotional tones VARY across scenes (not all the same energy)?
4. Are the background prompts visually consistent (same color temperature, lighting style)?
5. Are scripts specific and concrete (no generic claims)?
6. Would you want to watch this? If not, rewrite it.`;

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
  let prompt = `Create a cinematic ${sceneCount}-scene ${videoType.replace('-', ' ')} video for ${platform}.

**Topic:** ${description}
**Total duration:** ${duration} seconds (distribute across scenes — vary durations for pacing, not all equal)
**Scenes:** EXACTLY ${sceneCount} scenes — no more, no less. Each stitched from short Hedra clips.

CRITICAL: The Topic above contains the user's creative direction. If they describe specific characters (age, gender, ethnicity, clothing, setting), you MUST use those EXACT descriptions in your visualDescription fields. Do NOT substitute a different character.

Remember: This video must feel like a SHORT FILM, not a corporate slide deck. Build an emotional arc. Vary the energy between scenes. Make every word count.`;

  if (targetAudience) {
    prompt += `\n**Target audience:** ${targetAudience}`;
  }
  if (painPoints) {
    prompt += `\n**Pain points to address:** ${painPoints} — Use these to create EMOTIONAL TENSION in the early scenes. Make the viewer feel the frustration before offering the solution.`;
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

  prompt += `\n\nWrite the complete cinematic scene breakdown as JSON. Make it compelling enough that YOU would watch it.`;

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
  // Step 1: Load context in parallel
  let brandContext: string | null = null;
  let productContext: string | null = null;
  let personaResult: Awaited<ReturnType<typeof loadMarketingPersona>> = null;

  try {
    [brandContext, productContext, personaResult] = await Promise.all([
      loadBrandContext(),
      loadProductContext(),
      loadMarketingPersona(),
    ]);
    logger.info('Script generation context loaded', {
      hasBrand: Boolean(brandContext),
      hasProducts: Boolean(productContext),
      hasPersona: Boolean(personaResult),
      file: 'script-generation-service.ts',
    });
  } catch (ctxError) {
    logger.warn('Failed to load script generation context (continuing without)', {
      error: ctxError instanceof Error ? ctxError.message : String(ctxError),
      file: 'script-generation-service.ts',
    });
  }

  // Step 2: Build prompts
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

  // Step 3: Call AI model
  let response: { content: string };
  try {
    response = await provider.chat({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 6000,
    });
  } catch (aiError) {
    logger.error('OpenRouter API call failed for script generation',
      aiError instanceof Error ? aiError : new Error(String(aiError)),
      { file: 'script-generation-service.ts', model: 'claude-3-5-sonnet' },
    );
    return null;
  }

  if (!response.content) {
    logger.warn('AI scene generation returned empty content', { file: 'script-generation-service.ts' });
    return null;
  }

  // Step 4: Extract JSON — robust extraction that handles text before/after the JSON
  let jsonStr = response.content.trim();

  // Try 1: Strip code fences (```json ... ```)
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Try 2: If no code fences, find the first { ... } block
  if (!jsonStr.startsWith('{')) {
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
    }
  }

  // Step 5: Parse and validate
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    logger.error('JSON parse failed for AI script response',
      parseError instanceof Error ? parseError : new Error(String(parseError)),
      {
        file: 'script-generation-service.ts',
        responsePreview: response.content.substring(0, 300),
        extractedPreview: jsonStr.substring(0, 300),
      },
    );
    return null;
  }

  let validated: { targetAudience: string; keyMessages: string[]; scenes: Array<{ sceneNumber: number; title: string; scriptText: string; visualDescription: string; suggestedDuration: number; engine: 'hedra'; backgroundPrompt: string | null }> };
  try {
    validated = AIResponseSchema.parse(parsed);
  } catch (zodError) {
    logger.error('Zod validation failed for AI script response',
      zodError instanceof Error ? zodError : new Error(String(zodError)),
      {
        file: 'script-generation-service.ts',
        parsedKeys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [],
        sceneCount: typeof parsed === 'object' && parsed !== null && 'scenes' in parsed && Array.isArray((parsed as Record<string, unknown>).scenes) ? (parsed as Record<string, unknown[]>).scenes.length : 0,
      },
    );
    return null;
  }

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

  logger.info('AI scripts generated successfully', {
    sceneCount: validated.scenes.length,
    totalDuration,
    file: 'script-generation-service.ts',
  });

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
        engine: 'hedra',
        backgroundPrompt: 'Modern bright office with large monitor showing tutorial interface, indoor plants, warm lighting, clean desk',
      });

      for (let i = 2; i < sceneCount; i++) {
        scenes.push({
          sceneNumber: i,
          title: `Step ${i - 1}`,
          scriptText: `Now let me show you step ${i - 1}. This is where things get interesting.`,
          visualDescription: `Screen recording showing step ${i - 1} in action`,
          suggestedDuration: durationPerScene,
          engine: 'hedra',
          backgroundPrompt: 'Clean workspace with soft ambient lighting, monitor displaying software interface, shallow depth of field',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Summary & Next Steps',
        scriptText: `And that's it! You've got everything you need to get started. Try it out and let me know how it goes.`,
        visualDescription: 'Summary slide with key takeaways',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
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
        engine: 'hedra',
        backgroundPrompt: 'Sleek modern conference room with glass walls, city skyline visible, dramatic lighting, shallow depth of field',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'The Challenge',
        scriptText: `Most teams waste hours on this. The old way of doing things just doesn't cut it anymore.`,
        visualDescription: 'Presenter explains the pain point with empathy',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
        backgroundPrompt: 'Creative studio with exposed brick walls, warm pendant lighting, comfortable setting with plants and books',
      });

      scenes.push({
        sceneNumber: 3,
        title: 'The Solution',
        scriptText: `That's exactly why we built this. It takes what used to be a headache and makes it automatic.`,
        visualDescription: 'Presenter introduces the solution with enthusiasm',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
        backgroundPrompt: 'Modern tech office with large displays showing dashboards and analytics, blue accent lighting, clean aesthetic',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Key Benefits',
          scriptText: `The results speak for themselves. Teams are saving hours every week and getting better outcomes.`,
          visualDescription: 'Presenter highlights key metrics and results',
          suggestedDuration: durationPerScene,
          engine: 'hedra',
          backgroundPrompt: 'Bright co-working space with whiteboard showing growth charts, natural window light, green plants, energetic atmosphere',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Call to Action',
        scriptText: `Ready to see this in action? Head over to the link below and try it free.`,
        visualDescription: 'Presenter delivers CTA with confident smile',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
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
        engine: 'hedra',
        backgroundPrompt: 'Warm cozy office with bookshelves, soft lighting, plants, inviting atmosphere',
      });

      scenes.push({
        sceneNumber: 2,
        title: 'Introducing the Solution',
        scriptText: `What if this whole process could run on autopilot? That's exactly what we built.`,
        visualDescription: 'Presenter introduces the product with excitement',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
        backgroundPrompt: 'Modern tech lab with holographic displays, cool blue ambient lighting, futuristic minimal design',
      });

      scenes.push({
        sceneNumber: 3,
        title: 'Why It Works',
        scriptText: `Unlike anything else out there, this actually delivers. It's fast, simple, and the results are real.`,
        visualDescription: 'Presenter walks through key differentiators',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
        backgroundPrompt: 'Modern creative workspace with whiteboard showing strategy diagrams, bright natural light',
      });

      if (sceneCount > 4) {
        scenes.push({
          sceneNumber: 4,
          title: 'Social Proof',
          scriptText: `Our customers are seeing real results. One team cut their prospecting time by 80% in the first week. Another closed three new deals in their first month.`,
          visualDescription: 'Presenter shares testimonials with conviction',
          suggestedDuration: durationPerScene,
          engine: 'hedra',
          backgroundPrompt: 'Bright open-plan office with team celebration in background, motivational wall art, warm afternoon light',
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Offer',
        scriptText: `Want to see these results yourself? Click below and let's get you started. Seriously, you'll thank yourself later.`,
        visualDescription: 'Presenter delivers confident CTA',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
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
        engine: 'hedra',
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
          engine: 'hedra',
          backgroundPrompt: bgPrompts[(i - 2) % bgPrompts.length],
        });
      }

      scenes.push({
        sceneNumber: sceneCount,
        title: 'Wrap Up',
        scriptText: `That's a wrap! If any of this clicked for you, check out the link below. Let's make it happen.`,
        visualDescription: 'CTA with contact info',
        suggestedDuration: durationPerScene,
        engine: 'hedra',
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
  // If the user's description explicitly requests a scene count, respect it.
  // E.g. "Create a 4-scene video..." → use 4 scenes.
  const userSceneMatch = params.description.match(/(\d+)[- ]scene/i);
  const userSceneCount = userSceneMatch ? parseInt(userSceneMatch[1], 10) : null;
  const sceneCount = userSceneCount
    ? Math.max(2, Math.min(12, userSceneCount))
    : Math.max(3, Math.min(8, Math.ceil(params.duration / 8)));

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
