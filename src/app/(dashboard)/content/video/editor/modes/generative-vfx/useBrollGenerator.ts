'use client';

/**
 * useBrollGenerator — the real generation engine behind the Generative VFX & B-Roll
 * workspace. It can produce either a still IMAGE frame or a real text-to-VIDEO clip,
 * and tracks the resulting B-roll so the operator can insert it onto the shared
 * editor timeline.
 *
 * WIRING (both paths are REAL fal/Seedance, auth-gated, no faked output):
 *   - 'image' → /api/content/asset-generator/generate (synchronous fal.ai image).
 *   - 'video' → /api/video/editor/broll (fal/Seedance text-to-video; submits,
 *     polls fal to completion, persists the clip to Firebase Storage). Takes
 *     meaningfully longer than an image — the UI shows a longer generating state.
 *
 * On success each path returns the permanent Firebase Storage URL of the generated
 * B-roll. No faked output: if an endpoint errors (e.g. missing API key) the error
 * message is surfaced verbatim to the operator and nothing is added to the timeline.
 */

import { useCallback, useState } from 'react';

/** Landscape/portrait/square presets the fal image endpoint accepts. */
export interface BrollAspect {
  value: '16:9' | '9:16' | '1:1';
  label: string;
}

export const BROLL_ASPECTS: readonly BrollAspect[] = [
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Vertical (9:16)' },
  { value: '1:1', label: 'Square (1:1)' },
];

/** What kind of B-roll to generate: a still image frame, or a real video clip. */
export type BrollKind = 'image' | 'video';

/** A single piece of generated B-roll the operator can insert or discard. */
export interface GeneratedBroll {
  id: string;
  name: string;
  url: string;
  prompt: string;
  aspectRatio: BrollAspect['value'];
  /** Whether this piece is a still image frame or a real video clip. */
  kind: BrollKind;
  /**
   * Clip length in seconds for a video B-roll. Undefined for an image frame (the
   * timeline applies its default still duration to images).
   */
  durationSeconds?: number;
  /**
   * True once this piece has been added to the timeline at least once. The shared
   * reducer owns the real clip ids, so we only track THAT it was inserted (to show an
   * "Added" state) — not a fabricated clip id we don't actually have.
   */
  inserted: boolean;
}

/** Shape of the asset-generator response we depend on (only the fields we read). */
interface GenerateImageResponse {
  success: boolean;
  url?: string;
  asset?: { id?: string; name?: string; url?: string };
  error?: string;
}

function isGenerateImageResponse(value: unknown): value is GenerateImageResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return typeof (value as { success?: unknown }).success === 'boolean';
}

/** Shape of the text-to-video B-roll response we depend on (only the fields we read). */
interface GenerateVideoResponse {
  success: boolean;
  url?: string;
  durationSeconds?: number;
  error?: string;
}

function isGenerateVideoResponse(value: unknown): value is GenerateVideoResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return typeof (value as { success?: unknown }).success === 'boolean';
}

export interface UseBrollGeneratorResult {
  gallery: GeneratedBroll[];
  isGenerating: boolean;
  error: string | null;
  /**
   * Generate one piece of B-roll from a prompt — a still image ('image') or a real
   * video clip ('video'). Returns the new item, or null on failure.
   */
  generate: (
    prompt: string,
    aspectRatio: BrollAspect['value'],
    kind: BrollKind,
  ) => Promise<GeneratedBroll | null>;
  /** Mark a gallery item as inserted onto the timeline. */
  markInserted: (brollId: string) => void;
  /** Remove a piece of B-roll from the gallery. */
  discard: (brollId: string) => void;
  /** Clear the most recent error message. */
  clearError: () => void;
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

const GENERATE_ENDPOINT = '/api/content/asset-generator/generate';
const GENERATE_VIDEO_ENDPOINT = '/api/video/editor/broll';

export function useBrollGenerator(authFetch: AuthFetch): UseBrollGeneratorResult {
  const [gallery, setGallery] = useState<GeneratedBroll[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const markInserted = useCallback((brollId: string) => {
    setGallery((prev) =>
      prev.map((item) => (item.id === brollId ? { ...item, inserted: true } : item)),
    );
  }, []);

  const discard = useCallback((brollId: string) => {
    setGallery((prev) => prev.filter((item) => item.id !== brollId));
  }, []);

  /** Fallback display name from a prompt when the endpoint doesn't supply one. */
  const nameFromPrompt = useCallback(
    (trimmed: string): string =>
      trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed,
    [],
  );

  /** REAL fal.ai still-image B-roll via /api/content/asset-generator/generate. */
  const generateImage = useCallback(
    async (
      trimmed: string,
      aspectRatio: BrollAspect['value'],
    ): Promise<GeneratedBroll | null> => {
      const response = await authFetch(GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          aspectRatio,
          // B-roll is supporting footage — keep the operator's own brand palette on,
          // but never stamp the logo on incidental scenery.
          brandDnaApplied: true,
          applyBrandLogo: false,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isGenerateImageResponse(payload) || !payload.success) {
        const message =
          isGenerateImageResponse(payload) && typeof payload.error === 'string'
            ? payload.error
            : `Generation failed (status ${response.status}). Please try again.`;
        setError(message);
        return null;
      }

      const url = payload.url ?? payload.asset?.url;
      if (typeof url !== 'string' || url.length === 0) {
        setError('The generator returned no image. Please try again.');
        return null;
      }

      const item: GeneratedBroll = {
        id: payload.asset?.id ?? `broll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: payload.asset?.name ?? nameFromPrompt(trimmed),
        url,
        prompt: trimmed,
        aspectRatio,
        kind: 'image',
        inserted: false,
      };
      return item;
    },
    [authFetch, nameFromPrompt],
  );

  /** REAL fal/Seedance text-to-video B-roll via /api/video/editor/broll. */
  const generateVideo = useCallback(
    async (
      trimmed: string,
      aspectRatio: BrollAspect['value'],
    ): Promise<GeneratedBroll | null> => {
      const response = await authFetch(GENERATE_VIDEO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, aspectRatio }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isGenerateVideoResponse(payload) || !payload.success) {
        const message =
          isGenerateVideoResponse(payload) && typeof payload.error === 'string'
            ? payload.error
            : `Video generation failed (status ${response.status}). Please try again.`;
        setError(message);
        return null;
      }

      const { url } = payload;
      if (typeof url !== 'string' || url.length === 0) {
        setError('The generator returned no video clip. Please try again.');
        return null;
      }

      const item: GeneratedBroll = {
        id: `broll-vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: nameFromPrompt(trimmed),
        url,
        prompt: trimmed,
        aspectRatio,
        kind: 'video',
        ...(typeof payload.durationSeconds === 'number'
          ? { durationSeconds: payload.durationSeconds }
          : {}),
        inserted: false,
      };
      return item;
    },
    [authFetch, nameFromPrompt],
  );

  const generate = useCallback(
    async (
      prompt: string,
      aspectRatio: BrollAspect['value'],
      kind: BrollKind,
    ): Promise<GeneratedBroll | null> => {
      const trimmed = prompt.trim();
      if (trimmed.length === 0) {
        setError('Describe the B-roll you want before generating.');
        return null;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const item =
          kind === 'video'
            ? await generateVideo(trimmed, aspectRatio)
            : await generateImage(trimmed, aspectRatio);
        if (item) {
          setGallery((prev) => [item, ...prev]);
        }
        return item;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not reach the generator. Please try again.';
        setError(message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [generateImage, generateVideo],
  );

  return { gallery, isGenerating, error, generate, markInserted, discard, clearError };
}
