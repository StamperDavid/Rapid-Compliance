/**
 * Storyboard thumbnail helpers — shared by the manual storyboard builder and
 * the Content Assistant so both generate previews the same way.
 *
 * The thumbnail is a single still rendered from the storyboard's plain-language
 * fields + cinematic config via the Studio image generator
 * (/api/content/asset-generator/generate), which also persists it to storage +
 * the media library.
 */

import type { PipelineScene } from '@/types/video-pipeline';
import type { CinematicConfig } from '@/types/creative-studio';

export function hasText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Summarize the cinematic config into a short prompt fragment. */
export function cinematicSummary(config?: CinematicConfig): string {
  if (!config) {
    return '';
  }
  return Object.entries(config)
    .filter(([key, val]) =>
      val !== undefined &&
      val !== null &&
      val !== '' &&
      key !== 'temperature' &&
      key !== 'subjectUnawareOfCamera',
    )
    .map(([, val]) => (Array.isArray(val) ? val.join(', ') : String(val)))
    .join(', ');
}

/** Does the storyboard have enough description to picture it? */
export function sceneHasDescription(scene: PipelineScene): boolean {
  return hasText(scene.title) || hasText(scene.visualDescription) || hasText(scene.location);
}

/** Build the auto-thumbnail prompt from the storyboard's plain-language fields. */
export function buildThumbnailPrompt(scene: PipelineScene): string {
  const cine = cinematicSummary(scene.cinematicConfig);
  const prompt = [
    'Cinematic film still, photorealistic, professional color grade.',
    hasText(scene.title) ? `Scene: ${scene.title}.` : '',
    hasText(scene.visualDescription) ? `Action: ${scene.visualDescription}.` : '',
    hasText(scene.location) ? `Location: ${scene.location}.` : '',
    hasText(scene.timeOfDay) ? `Time of day: ${scene.timeOfDay}.` : '',
    hasText(scene.weather) ? `Weather/light: ${scene.weather}.` : '',
    hasText(scene.wardrobe) ? `Wardrobe: ${scene.wardrobe}.` : '',
    cine ? `Style: ${cine}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return prompt.length > 1000 ? `${prompt.slice(0, 997)}...` : prompt;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Render a thumbnail for a storyboard and return its permanent URL (or an
 * error). Reused by the manual builder and the Content Assistant.
 */
export async function requestStoryboardThumbnail(
  authFetch: AuthFetch,
  scene: PipelineScene,
  aspectRatio: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const response = await authFetch('/api/content/asset-generator/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: buildThumbnailPrompt(scene),
        aspectRatio,
        name: hasText(scene.title)
          ? `Storyboard ${scene.sceneNumber}: ${scene.title}`
          : `Storyboard ${scene.sceneNumber} thumbnail`,
      }),
    });
    const data = (await response.json().catch(() => null)) as
      | { success: boolean; url?: string; error?: string }
      | null;
    if (!response.ok || !data?.success || !data.url) {
      return { error: data?.error ?? `thumbnail failed (${response.status})` };
    }
    return { url: data.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'thumbnail failed' };
  }
}
