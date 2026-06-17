/**
 * Storyboard thumbnail helpers — shared by the manual storyboard builder and
 * the Content Assistant so both generate previews the same way.
 *
 * The thumbnail is a single still rendered from the storyboard's plain-language
 * fields + cinematic config via the Studio image generator
 * (/api/content/asset-generator/generate), which also persists it to storage +
 * the media library.
 */

import type { PipelineScene, SceneReference } from '@/types/video-pipeline';
import type { CinematicConfig } from '@/types/creative-studio';
import type { IntentSubject, SubjectFidelity } from '@/lib/content/content-intent';

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
 * Pick the operator's reference image whose name best matches what's IN this scene
 * (a "Velocity" scene → the Velocity art; a "Bully" scene → the Bully art), so the
 * scene is generated FROM that actual character instead of reinvented from text.
 * Bidirectional token-substring match so e.g. scene "velocity" matches file
 * "SalesVelocity Hero". Returns undefined when nothing matches (falls back to text).
 */
export function matchReferenceForScene(
  scene: PipelineScene,
  pool: SceneReference[],
): string | undefined {
  const images = pool.filter((r) => r.type === 'image' && hasText(r.url));
  if (images.length === 0) {
    return undefined;
  }
  const tokenize = (s: string): string[] =>
    s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  const sceneTokens = tokenize(
    `${scene.title ?? ''} ${scene.visualDescription ?? ''} ${scene.wardrobe ?? ''}`,
  );
  let best: SceneReference | undefined;
  let bestScore = 0;
  for (const ref of images) {
    const refTokens = tokenize(ref.name.replace(/\.[a-z0-9]+$/i, ''));
    let score = 0;
    for (const rt of refTokens) {
      if (sceneTokens.some((st) => rt.includes(st) || st.includes(rt))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = ref;
    }
  }
  return bestScore > 0 ? best?.url : undefined;
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
 * Identity-lock instruction prepended ONLY when the scene is generated from a
 * reference character image (image-to-image). It locks the person's IDENTITY (face)
 * but DEFERS clothing/setting/pose to the scene description — otherwise it copies the
 * reference's outfit too, which put civilian "David" in the suited Velocity costume.
 * The scene description is the Content Manager's instruction and must win on wardrobe.
 */
const IDENTITY_LOCK =
  'The reference image shows a SPECIFIC, established PERSON. Keep their identity EXACT — ' +
  'same face, head shape, hair, beard and facial features — so they are unmistakably the ' +
  'same person. But FOLLOW THE SCENE DESCRIPTION below for everything else: their clothing ' +
  'and wardrobe, the location/setting, the pose, the action, and their expression may all ' +
  'differ from the reference (e.g. the SAME person in everyday civilian clothes instead of ' +
  'a costume/suit). Do NOT copy the reference image\'s outfit or background when the ' +
  'description calls for something different. Never invent a different person.';

/**
 * Softer branding rule used WITH a reference image: we still must not let the model
 * invent a fake SalesVelocity logo, but the strict NO_FAKE_BRANDING rule also wipes
 * branding that is PART of the reference character (e.g. the villain's "pipedrive"
 * armband), erasing the character's identity. This blocks only NEW/invented lettering
 * while preserving markings carried over from the reference.
 */
const NO_INVENTED_BRANDING =
  'Do not ADD any new on-screen text, captions, titles, or invented logos. Keep markings ' +
  'that are already part of the referenced character or scene. The real brand logo is added separately.';

/**
 * Note used when fidelity is "inspired" — the operator wants something LIKE the
 * reference, not a faithful copy. We anchor to the reference for mood/look but
 * explicitly allow a distinct result, the opposite of the identity-lock.
 */
const INSPIRED_NOTE =
  'Use the reference image as loose inspiration for the look and feel — a similar but ' +
  'distinct character is welcome. Do not feel bound to copy it exactly.';

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

/**
 * Build the auto-thumbnail prompt from the storyboard's plain-language fields.
 *
 * `fidelity` controls how the reference character is used (set only when the scene
 * is generated image-to-image from the operator's art):
 *  - 'exact'    — identity-lock: recreate THAT EXACT character; keep its markings.
 *  - 'inspired' — anchor loosely; a similar-but-distinct character is fine.
 *  - undefined  — no reference (text-to-image); strict no-branding rule.
 */
export function buildThumbnailPrompt(
  scene: PipelineScene,
  fidelity?: SubjectFidelity,
): string {
  const hasReference = fidelity === 'exact' || fidelity === 'inspired';
  const cine = cinematicSummary(scene.cinematicConfig);
  // With a reference, "photorealistic film still" fights the character's own style;
  // let the reference + the scene's own style fields drive the look instead.
  const opener = hasReference
    ? 'Keep the reference character; render the scene below.'
    : 'Cinematic film still, photorealistic, professional color grade.';
  const descriptive = stripBrandingLanguage(
    [
      opener,
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

  const prefix = fidelity === 'exact' ? `${IDENTITY_LOCK} ` : fidelity === 'inspired' ? `${INSPIRED_NOTE} ` : '';
  const brandingRule = hasReference ? NO_INVENTED_BRANDING : NO_FAKE_BRANDING;
  // Trim the descriptive part so the identity-lock + branding rule ALWAYS survive the
  // 1000-char cap (the asset-generator route rejects prompts longer than that). The
  // trademark/IP guardrail is appended centrally in the asset-generator route so it
  // covers every image path (thumbnails AND chat images) and can be tailored to
  // whether a reference image is present.
  const maxDescLen = 1000 - prefix.length - brandingRule.length - 2;
  const trimmed =
    descriptive.length > maxDescLen ? `${descriptive.slice(0, maxDescLen - 3)}...` : descriptive;
  return `${prefix}${trimmed} ${brandingRule}`;
}

/** The minimal scene text a name-match needs — satisfied by PipelineScene AND AssistantStoryboard. */
type SceneTextFields = {
  title?: string | null;
  visualDescription?: string | null;
  wardrobe?: string | null;
};

const subjectTokenize = (s: string): string[] =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);

/**
 * Pick the CONFIRMED intent subject a scene is about, by matching the scene's text
 * to each subject's name. Shared by the client thumbnail picker (refUrl resolution)
 * and the server-side storyboard build (binding a saved character's avatarId per
 * scene), so both agree on which character a scene features. Returns undefined when
 * no subject scores (the scene names nobody in the cast).
 */
export function pickSubjectForScene(
  scene: SceneTextFields,
  subjects: IntentSubject[],
): IntentSubject | undefined {
  if (subjects.length === 0) {
    return undefined;
  }
  const sceneTokens = subjectTokenize(
    `${scene.title ?? ''} ${scene.visualDescription ?? ''} ${scene.wardrobe ?? ''}`,
  );
  let best: IntentSubject | undefined;
  let bestScore = 0;
  for (const subject of subjects) {
    const nameTokens = subjectTokenize(subject.name);
    let score = 0;
    for (const nt of nameTokens) {
      if (sceneTokens.includes(nt)) {
        // Exact token hit (the scene literally names this character) — weighted high so
        // "David starting his business" matches DAVID, not the "Businessman" villain.
        score += 3;
      } else if (sceneTokens.some((st) => st.includes(nt) || nt.includes(st))) {
        // Loose substring overlap is a weak signal and must never outweigh an exact hit.
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = subject;
    }
  }
  return bestScore > 0 ? best : undefined;
}

/**
 * Pick the right reference + fidelity for a scene from the CONFIRMED intent subjects.
 * Matches the scene's text to a subject by name, then resolves that subject's
 * reference image from the seeded pool. Falls back to filename matching (fidelity
 * 'exact') when no subjects were provided. Returns no refUrl for 'new' subjects.
 */
export function matchSubjectForScene(
  scene: PipelineScene,
  subjects: IntentSubject[],
  pool: SceneReference[],
): { refUrl?: string; fidelity?: SubjectFidelity } {
  const images = pool.filter((r) => r.type === 'image' && hasText(r.url));
  if (subjects.length === 0) {
    // No confirmed subjects — fall back to the legacy filename match, treated as exact.
    const refUrl = matchReferenceForScene(scene, pool);
    return refUrl ? { refUrl, fidelity: 'exact' } : {};
  }

  const best = pickSubjectForScene(scene, subjects);
  if (!best) {
    return {};
  }
  if (best.fidelity === 'new') {
    return { fidelity: 'new' };
  }
  // Resolve the subject's reference image from the pool by name overlap.
  let refUrl: string | undefined;
  for (const refName of best.referenceNames) {
    const refTokens = subjectTokenize(refName.replace(/\.[a-z0-9]+$/i, ''));
    const match = images.find((img) => {
      const imgTokens = subjectTokenize(img.name.replace(/\.[a-z0-9]+$/i, ''));
      return refTokens.some((rt) => imgTokens.some((it) => it.includes(rt) || rt.includes(it)));
    });
    if (match) {
      refUrl = match.url;
      break;
    }
  }
  // Saved character: it has no attached referenceNames (its identity comes from the
  // profile), but the build seeds its face/Look images onto the pool NAMED by the
  // subject. Fall back to matching those by the subject's own name so the scene is
  // still conditioned on the saved character's art.
  if (!refUrl && best.characterId) {
    const nameTokens = subjectTokenize(best.name);
    const match = images.find((img) => {
      const imgTokens = subjectTokenize(img.name.replace(/\.[a-z0-9]+$/i, ''));
      return nameTokens.some((nt) => imgTokens.some((it) => it.includes(nt) || nt.includes(it)));
    });
    if (match) {
      refUrl = match.url;
    }
  }
  return { ...(refUrl ? { refUrl } : {}), fidelity: best.fidelity };
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
  /**
   * When set, the scene is generated CONDITIONED on this reference image
   * (image-to-image) — so it's built from the operator's actual character art
   * instead of reinvented from text.
   */
  referenceImageUrl?: string,
  /**
   * How faithfully to reproduce the referenced character: 'exact' identity-locks
   * it, 'inspired' anchors loosely. Defaults to 'exact' when a reference is given.
   */
  fidelity?: SubjectFidelity,
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
        prompt: buildThumbnailPrompt(scene, referenceImageUrl ? (fidelity ?? 'exact') : undefined),
        aspectRatio,
        ...(referenceImageUrl ? { referenceImageUrl } : {}),
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
