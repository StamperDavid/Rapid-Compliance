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

/**
 * Phrases that mark a scene as the closing BRAND CLOSE / CTA / outro shot. For these
 * scenes the preview must be a deterministic branded card (real logo + tagline),
 * NOT an AI render — the normal prompt strips all branding language, so the model
 * would otherwise invent a fake "BRAND CLOSE" text card.
 */
const BRAND_CLOSE_PATTERN =
  /\b(brand close|brand shot|call to action|cta|outro|end card|end ?screen|sign[-\s]?off|closing shot)\b/i;

/** Is this the closing brand / CTA / outro scene? (title or visual description). */
export function isBrandCloseScene(scene: PipelineScene): boolean {
  return BRAND_CLOSE_PATTERN.test(scene.title ?? '') || BRAND_CLOSE_PATTERN.test(scene.visualDescription ?? '');
}

/**
 * Hard rule appended to every storyboard image prompt: the image model must NEVER
 * invent branding. The REAL brand logo is composited onto the still afterward, so
 * the generated scene itself must contain zero text and zero logos — otherwise the
 * model paints a fake logo / title card (e.g. a made-up logo + "Free Trial").
 */
const NO_FAKE_BRANDING =
  'Absolute rule: render NO text, letters, words, captions, titles, logos, brand marks, ' +
  'watermarks, company names, or signage anywhere in the image. Zero on-screen lettering ' +
  'of any kind. Do not invent or depict any logo — the real brand logo is added separately.';

/**
 * Phrases that, in a scene description, instruct the model to PAINT branding/on-screen
 * text — which produces a fake logo + garbled lettering. The real logo is composited
 * as a watermark and any tagline/CTA is a clean post-production text overlay, so the
 * image model must only paint the visual scene. We strip these clauses (and the brand
 * name + any quoted on-screen text) before the prompt reaches the model — otherwise a
 * "show the logo and tagline" instruction fights, and beats, the NO_FAKE_BRANDING rule.
 */
const BRANDING_CLAUSE =
  /\b(logos?|wordmarks?|word marks?|brand ?marks?|taglines?|title cards?|text overlays?|on[-\s]?screen text|lower thirds?|captions?|signage|cta text|text reads?|displayed text|watermarks?)\b/i;
const BRAND_NAME = /\bsales\s*velocity(?:\.ai|\.com)?\b/gi;

/** Remove any "draw the logo / tagline / on-screen text" language from an image prompt. */
function stripBrandingLanguage(text: string): string {
  const clauses = text.split(/(?<=[.;,:])\s+|\s+—\s+/);
  let out = clauses.filter((clause) => !BRANDING_CLAUSE.test(clause)).join(' ');
  // Drop quoted on-screen text (e.g. a tagline) and any lingering brand name.
  out = out.replace(/"[^"]*"/g, '').replace(BRAND_NAME, '');
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}

/** Build the auto-thumbnail prompt from the storyboard's plain-language fields. */
export function buildThumbnailPrompt(scene: PipelineScene): string {
  const cine = cinematicSummary(scene.cinematicConfig);
  const descriptive = stripBrandingLanguage(
    [
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
      .join(' '),
  );

  // Trim the descriptive part so the no-branding rule ALWAYS survives the length cap.
  const maxDescLen = 1000 - NO_FAKE_BRANDING.length - 1;
  const trimmed = descriptive.length > maxDescLen ? `${descriptive.slice(0, maxDescLen - 3)}...` : descriptive;
  return `${trimmed} ${NO_FAKE_BRANDING}`;
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
  // The closing brand / CTA / outro scene gets a deterministic branded card (real
  // logo + tagline) rendered server-side — never an AI guess that paints a fake
  // "BRAND CLOSE" text card.
  if (isBrandCloseScene(scene)) {
    try {
      const response = await authFetch('/api/video/brand-outro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspectRatio,
          name: hasText(scene.title)
            ? `Storyboard ${scene.sceneNumber}: ${scene.title}`
            : `Storyboard ${scene.sceneNumber} brand outro`,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: boolean; url?: string; error?: string }
        | null;
      if (!response.ok || !data?.success || !data.url) {
        return { error: data?.error ?? `brand outro failed (${response.status})` };
      }
      return { url: data.url };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'brand outro failed' };
    }
  }

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
