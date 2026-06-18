'use client';

/**
 * useClippableMoments — the real "auto-highlight" call behind the Make Clips
 * panel's "Find clippable moments" button.
 *
 * It collects the project timeline clips, sends each clip's URL + effective
 * duration to the real POST /api/video/editor/clippable-moments route, and
 * returns the Video Editor Specialist's highlight spans (start/end + reason +
 * a suggested caption + a 0-1 hook score).
 *
 * Honesty: nothing here is faked. If the transcription service isn't connected
 * the route returns a 503 and we surface that in plain English; if it errors we
 * surface the real reason. We never fabricate a moment.
 */

import { useCallback, useState } from 'react';
import type { EditorClip } from '../../types';
import { effectiveClipDuration } from '../../modes/social-repurpose/segment-utils';

/** One highlight span returned by the route (mirrors the specialist contract). */
export interface ClippableMoment {
  startSec: number;
  endSec: number;
  reason: string;
  suggestedCaption: string;
  score: number;
}

interface MomentsSuccess {
  success: true;
  moments: ClippableMoment[];
}
interface MomentsFailure {
  success: false;
  code: 'not_connected' | 'invalid_request' | 'error';
  error: string;
}
type MomentsResponse = MomentsSuccess | MomentsFailure;

function isMomentsResponse(v: unknown): v is MomentsResponse {
  return typeof v === 'object' && v !== null && 'success' in v;
}

function isMoment(v: unknown): v is ClippableMoment {
  if (typeof v !== 'object' || v === null) {
    return false;
  }
  const m = v as Record<string, unknown>;
  return (
    typeof m.startSec === 'number' &&
    typeof m.endSec === 'number' &&
    typeof m.reason === 'string' &&
    typeof m.suggestedCaption === 'string' &&
    typeof m.score === 'number'
  );
}

export interface UseClippableMoments {
  isFinding: boolean;
  /** Plain-English status surfaced under the button after a run. */
  status: string | null;
  /** Run the analysis; resolves with the found moments (empty array on none). */
  find: () => Promise<ClippableMoment[]>;
}

export function useClippableMoments(
  clips: EditorClip[],
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
): UseClippableMoments {
  const [isFinding, setIsFinding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const find = useCallback(async (): Promise<ClippableMoment[]> => {
    const usableClips = clips
      .map((c) => ({ url: c.url, durationSeconds: effectiveClipDuration(c) }))
      .filter((c) => c.url.length > 0 && c.durationSeconds > 0);

    if (usableClips.length === 0) {
      setStatus('Add a clip to the timeline first.');
      return [];
    }

    setIsFinding(true);
    setStatus('Reviewing your video for clippable moments…');
    try {
      const response = await authFetch('/api/video/editor/clippable-moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: usableClips }),
      });
      const json: unknown = await response.json();

      if (!isMomentsResponse(json)) {
        setStatus('The auto-highlight came back in an unexpected format.');
        return [];
      }
      if (!json.success) {
        setStatus(
          json.code === 'not_connected'
            ? 'Finding clippable moments needs a Deepgram key. Add one in Settings to turn this on.'
            : json.error,
        );
        return [];
      }

      const moments = json.moments.filter(isMoment);
      setStatus(
        moments.length === 0
          ? 'No clear clippable moments found in this video — try adding your own short instead.'
          : `Added ${moments.length} clippable moment${moments.length === 1 ? '' : 's'} — review and tweak them below.`,
      );
      return moments;
    } catch {
      setStatus('Could not reach the auto-highlight service.');
      return [];
    } finally {
      setIsFinding(false);
    }
  }, [clips, authFetch]);

  return { isFinding, status, find };
}
