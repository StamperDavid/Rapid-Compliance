'use client';

/**
 * useBrollGenerator — the real generation engine behind the Generative VFX & B-Roll
 * workspace. It calls our OWN fal/image endpoint and tracks the resulting B-roll so
 * the operator can insert it onto the shared editor timeline.
 *
 * WIRING: this hook posts to /api/content/asset-generator/generate — the real,
 * auth-gated, synchronous fal.ai image generator. On success it returns the
 * permanent Firebase Storage URL of the generated B-roll frame. No faked output:
 * if the endpoint errors (e.g. missing API key) the error message is surfaced
 * verbatim to the operator and nothing is added to the timeline.
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

/** A single piece of generated B-roll the operator can insert or discard. */
export interface GeneratedBroll {
  id: string;
  name: string;
  url: string;
  prompt: string;
  aspectRatio: BrollAspect['value'];
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

export interface UseBrollGeneratorResult {
  gallery: GeneratedBroll[];
  isGenerating: boolean;
  error: string | null;
  /** Generate one piece of B-roll from a prompt. Returns the new item, or null on failure. */
  generate: (prompt: string, aspectRatio: BrollAspect['value']) => Promise<GeneratedBroll | null>;
  /** Mark a gallery item as inserted onto the timeline. */
  markInserted: (brollId: string) => void;
  /** Remove a piece of B-roll from the gallery. */
  discard: (brollId: string) => void;
  /** Clear the most recent error message. */
  clearError: () => void;
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

const GENERATE_ENDPOINT = '/api/content/asset-generator/generate';

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

  const generate = useCallback(
    async (prompt: string, aspectRatio: BrollAspect['value']): Promise<GeneratedBroll | null> => {
      const trimmed = prompt.trim();
      if (trimmed.length === 0) {
        setError('Describe the B-roll you want before generating.');
        return null;
      }

      setIsGenerating(true);
      setError(null);

      try {
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

        const name =
          payload.asset?.name ?? (trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed);

        const item: GeneratedBroll = {
          id: payload.asset?.id ?? `broll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          url,
          prompt: trimmed,
          aspectRatio,
          inserted: false,
        };

        setGallery((prev) => [item, ...prev]);
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
    [authFetch],
  );

  return { gallery, isGenerating, error, generate, markInserted, discard, clearError };
}
