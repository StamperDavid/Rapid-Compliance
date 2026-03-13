/**
 * Hedra Prompt Agent
 *
 * AI-powered translation layer that converts approved storyboard scenes into
 * optimized Hedra prompts. Runs AFTER storyboard approval, BEFORE generation.
 *
 * Key responsibilities:
 * - Read ALL scenes together to understand character continuity
 * - Identify which scenes share the same character
 * - Craft detailed, consistent character descriptions across scenes
 * - Describe characters presenting/delivering content on camera (TTS audio handles speech)
 * - Structure prompts the way Hedra responds best to
 * - Return one optimized prompt per scene
 */

import { logger } from '@/lib/logger/logger';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { PipelineScene } from '@/types/video-pipeline';

// ============================================================================
// Types
// ============================================================================

export interface HedraOptimizedPrompt {
  sceneId: string;
  sceneNumber: number;
  textPrompt: string;
}

// ============================================================================
// System Prompt
// ============================================================================

const HEDRA_PROMPT_AGENT_SYSTEM = `You are an expert Hedra prompt engineer. Your job is to convert approved video storyboard scenes into optimized text prompts that produce the best possible results from Hedra's text-to-video AI models.

## HOW HEDRA WORKS
- Each scene is generated INDEPENDENTLY. Hedra has ZERO memory between scenes.
- The \`text_prompt\` is the ONLY input Hedra uses to determine what appears on screen.
- If you want the same character in scenes 1 and 4, you must describe that character with IDENTICAL physical details in both prompts. Hedra will NOT "remember" scene 1 when generating scene 4.
- Characters in the video WILL speak via TTS audio that is attached separately. Describe characters as presenting, delivering, or discussing content — NOT as "speaking into the camera" or "lip-syncing" (the audio handles that). Focus on what the character is DOING while speaking: gesturing, walking, demonstrating, etc.

## YOUR TASK
You receive a full storyboard (all scenes). For each scene, produce a single text_prompt string optimized for Hedra.

## PROMPT STRUCTURE (for each scene)
Build the prompt in this order:
1. **SETTING** — Environment, location, lighting, time of day, atmosphere, color palette
2. **CHARACTER** — FULL physical description every time: ethnicity/skin tone, age, gender, build, height, hair (or lack of), facial features, clothing, accessories. Copy this VERBATIM across scenes with the same character.
3. **ACTION** — What the character is physically doing (walking, presenting, gesturing, demonstrating, engaging with the environment). The character will be speaking via TTS audio — describe their physical actions and body language while delivering content.
4. **MOOD/CAMERA** — Emotional energy, camera angle, depth of field, cinematic style

## CHARACTER CONSISTENCY RULES
- When the storyboard indicates the same character across multiple scenes, you MUST use the EXACT SAME character description word-for-word in every prompt.
- Build one canonical description per character and paste it identically into every scene where that character appears.
- Include: ethnicity, skin tone, approximate age, gender, build, height indicators, hair description, facial hair, clothing with colors and fit.
- Example canonical description: "A tall bald Caucasian man in his early 40s with light skin, clean-shaven face, strong jawline, athletic build, wearing a fitted black henley shirt"
- That EXACT string appears in every scene featuring that character. No paraphrasing.

## WHAT TO AVOID
- Do NOT mention "lip-syncing" or "audio sync" in prompts — TTS is handled separately
- Do NOT use vague character references like "the man" or "a presenter" — always use the full canonical description
- Do NOT add text overlays, titles, or UI elements to the prompt
- Do NOT reference other scenes ("same as scene 1") — Hedra doesn't know what scene 1 is
- Do NOT include the literal script/narration text in the prompt — just describe the visual scene and character actions

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code fences):
{
  "characters": {
    "character_A": "Full canonical description used in scenes X, Y, Z",
    "character_B": "Full canonical description used in scene W"
  },
  "prompts": [
    {
      "sceneNumber": 1,
      "textPrompt": "The complete optimized Hedra prompt for this scene"
    }
  ]
}`;

// ============================================================================
// Agent Implementation
// ============================================================================

interface AgentResponse {
  characters: Record<string, string>;
  prompts: Array<{ sceneNumber: number; textPrompt: string }>;
}

export async function translateStoryboardToHedraPrompts(
  scenes: PipelineScene[],
): Promise<HedraOptimizedPrompt[]> {
  if (scenes.length === 0) { return []; }

  // Build the storyboard context for the agent
  const storyboardContext = scenes.map((scene) => ({
    sceneNumber: scene.sceneNumber,
    sceneId: scene.id,
    title: scene.title ?? '',
    scriptText: scene.scriptText,
    visualDescription: scene.visualDescription ?? '',
    backgroundPrompt: scene.backgroundPrompt ?? '',
    duration: scene.duration,
  }));

  const userPrompt = `Here is the approved storyboard with ${scenes.length} scenes. Translate each scene into an optimized Hedra text_prompt.

STORYBOARD:
${JSON.stringify(storyboardContext, null, 2)}

Identify which scenes share the same character, build canonical character descriptions, and produce one optimized text_prompt per scene. Return as JSON.`;

  try {
    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: HEDRA_PROMPT_AGENT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Low temperature for consistency
      maxTokens: 4000,
    });

    if (!response.content) {
      logger.warn('Hedra Prompt Agent returned empty content', {
        file: 'hedra-prompt-agent.ts',
      });
      return fallbackPrompts(scenes);
    }

    // Parse JSON response
    let jsonStr = response.content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) { jsonStr = fenceMatch[1].trim(); }
    if (!jsonStr.startsWith('{')) {
      const braceStart = jsonStr.indexOf('{');
      const braceEnd = jsonStr.lastIndexOf('}');
      if (braceStart !== -1 && braceEnd > braceStart) {
        jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
      }
    }

    const parsed = JSON.parse(jsonStr) as AgentResponse;

    if (!parsed.prompts || !Array.isArray(parsed.prompts)) {
      logger.warn('Hedra Prompt Agent returned invalid structure', {
        file: 'hedra-prompt-agent.ts',
      });
      return fallbackPrompts(scenes);
    }

    logger.info('Hedra Prompt Agent translated storyboard', {
      sceneCount: scenes.length,
      promptCount: parsed.prompts.length,
      characterCount: Object.keys(parsed.characters ?? {}).length,
      file: 'hedra-prompt-agent.ts',
    });

    // Map prompts back to scene IDs
    return parsed.prompts.map((p) => {
      const scene = scenes.find((s) => s.sceneNumber === p.sceneNumber);
      return {
        sceneId: scene?.id ?? `scene-${p.sceneNumber}`,
        sceneNumber: p.sceneNumber,
        textPrompt: p.textPrompt,
      };
    });
  } catch (error) {
    logger.error('Hedra Prompt Agent failed', error as Error, {
      file: 'hedra-prompt-agent.ts',
    });
    return fallbackPrompts(scenes);
  }
}

// ============================================================================
// Fallback — if the AI agent fails, use the old concatenation approach
// ============================================================================

function fallbackPrompts(scenes: PipelineScene[]): HedraOptimizedPrompt[] {
  return scenes.map((scene) => {
    const parts: string[] = [];
    if (scene.backgroundPrompt?.trim()) { parts.push(scene.backgroundPrompt.trim()); }
    if (scene.visualDescription?.trim()) { parts.push(scene.visualDescription.trim()); }
    if (parts.length === 0 && scene.title?.trim()) { parts.push(scene.title.trim()); }
    parts.push('Cinematic quality, professional lighting, 4K film look');
    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      textPrompt: parts.join('. '),
    };
  });
}
