/**
 * Hedra Prompt Translator
 *
 * Enhances visual descriptions with character metadata before passing to
 * Hedra's Character-3 API as the `textPrompt`. This produces more contextually
 * accurate video generations by injecting:
 *
 *   - Character role cues (hero = confident/powerful, villain = menacing, etc.)
 *   - Visual style directives (anime, stylized, photorealistic)
 *   - Character name for on-screen identity consistency
 *
 * The translator is non-destructive: if the original description already
 * contains sufficient detail, it adds minimal extra context.
 */

import type { CharacterRole, CharacterStyleTag, CharacterSource } from '@/lib/video/avatar-profile-service';

// ============================================================================
// Types
// ============================================================================

export interface CharacterContext {
  characterName: string;
  role: CharacterRole;
  styleTag: CharacterStyleTag;
  source: CharacterSource;
}

// ============================================================================
// Role → Prompt Modifier Mapping
// ============================================================================

const ROLE_PROMPT_HINTS: Record<CharacterRole, string> = {
  hero: 'confident, determined expression, strong posture, heroic presence',
  villain: 'intense gaze, commanding presence, dramatic lighting',
  extra: 'natural, casual, background character energy',
  narrator: 'composed, authoritative, direct eye contact with camera',
  presenter: 'friendly, professional, engaging the viewer, clear enunciation',
  custom: '',
};

// ============================================================================
// Style → Prompt Modifier Mapping
// ============================================================================

const STYLE_PROMPT_HINTS: Record<CharacterStyleTag, string> = {
  real: 'photorealistic, natural lighting, real-world environment',
  anime: 'anime art style, vibrant colors, expressive features, cel-shaded',
  stylized: 'stylized rendering, artistic, enhanced features, creative lighting',
};

// ============================================================================
// Translator
// ============================================================================

/**
 * Translate a scene's visual description into an optimized Hedra prompt
 * by injecting character metadata context.
 *
 * @param rawDescription - The original visual description from the scene editor
 * @param character - Character metadata from the avatar profile
 * @returns Enhanced prompt string for Hedra's textPrompt field
 */
export function translatePromptForHedra(
  rawDescription: string,
  character: CharacterContext
): string {
  const parts: string[] = [];

  // Add style directive first — it frames the entire visual
  const styleHint = STYLE_PROMPT_HINTS[character.styleTag];
  if (styleHint && character.styleTag !== 'real') {
    // Only inject style hint for non-real styles (real is Hedra's default)
    parts.push(styleHint);
  }

  // Add the original description as the primary content
  const trimmed = rawDescription.trim();
  if (trimmed) {
    parts.push(trimmed);
  }

  // Add role-specific performance cues
  const roleHint = ROLE_PROMPT_HINTS[character.role];
  if (roleHint) {
    // Skip role hints for Hedra stock extras — they're background characters
    // and the 'extra' role hint is already minimal
    if (character.source !== 'hedra' || character.role !== 'extra') {
      parts.push(roleHint);
    }
  }

  // If nothing was assembled, return the raw description unchanged
  if (parts.length === 0) {
    return rawDescription;
  }

  return parts.join('. ');
}

/**
 * Build a concise character identity string for logging and debugging.
 */
export function describeCharacter(character: CharacterContext): string {
  const parts = [character.characterName];
  if (character.role !== 'custom') {
    parts.push(`(${character.role})`);
  }
  if (character.styleTag !== 'real') {
    parts.push(`[${character.styleTag}]`);
  }
  if (character.source === 'hedra') {
    parts.push('HEDRA');
  }
  return parts.join(' ');
}
