'use client';

/**
 * useMakeClips — the real render + schedule engine behind the Make Clips panel.
 *
 * For every (short × chosen format) the operator queues, this hook:
 *   1. Slices the project timeline span into per-clip render instructions
 *      (`sliceTimelineToClips`) — the EXACT same math the editor uses, never a
 *      fabricated clip.
 *   2. Optionally fetches auto-captions for the short (real /captions route),
 *      windowing each source clip's captions to the kept span and re-basing them
 *      to the short's own 0-based timeline.
 *   3. Renders the short at the format's aspect via the real
 *      POST /api/video/editor/render route → a Library MediaItem with a real URL.
 *   4. Hands the rendered clip to the real social scheduler
 *      (POST /api/social/schedule) with the platform, caption, and schedule time.
 *
 * Honesty: nothing here is faked. If render fails, the job errors honestly. If
 * scheduling fails (or is skipped), the clip is still saved to the Library and
 * the job reports that plainly — we never claim a post was scheduled when it
 * wasn't.
 */

import { useCallback, useState } from 'react';
import type { EditorClip } from '../../types';
import {
  sliceTimelineToClips,
  resolveShortSourceSpans,
  type ShortSegment,
  type RenderReadyClip,
} from '../../modes/social-repurpose/segment-utils';
import { getClipFormat, type ClipFormat } from './platforms';

// ── Shapes returned by the routes we call ──────────────────────────────────

interface RenderedMediaItem {
  id: string;
  url: string;
  name: string;
}

interface RenderSuccess {
  success: true;
  item: RenderedMediaItem;
}
interface RenderFailure {
  success: false;
  error?: string;
}
type RenderResponse = RenderSuccess | RenderFailure;

interface CaptionOverlay {
  text: string;
  startTime: number;
  endTime: number;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
}
interface CaptionsSuccess {
  success: true;
  overlays: CaptionOverlay[];
}
interface CaptionsFailure {
  success: false;
  code: 'not_connected' | 'invalid_request' | 'error';
  error: string;
}
type CaptionsResponse = CaptionsSuccess | CaptionsFailure;

interface ScheduleSuccess {
  success: true;
  postId: string;
  scheduledAt: string;
  message?: string;
}
interface ScheduleFailure {
  success: false;
  error?: string;
}
type ScheduleResponse = ScheduleSuccess | ScheduleFailure;

// ── Per-job status surfaced in the UI ───────────────────────────────────────

export type JobPhase =
  | 'queued'
  | 'captioning'
  | 'rendering'
  | 'scheduling'
  | 'scheduled'
  | 'saved'
  | 'error';

export interface ClipJob {
  /** Unique per (short, format). */
  id: string;
  shortId: string;
  shortName: string;
  formatId: string;
  formatLabel: string;
  phase: JobPhase;
  /** Plain-English error when phase === 'error'. */
  error: string | null;
  /** Library URL once rendered. */
  libraryUrl: string | null;
  /** Scheduler post id once scheduled. */
  postId: string | null;
  /** Plain-English note (e.g. captions skipped, or saved-not-scheduled reason). */
  note: string | null;
}

// ── Type guards (no `any`, validate the wire shapes) ────────────────────────

function isRenderResponse(v: unknown): v is RenderResponse {
  return typeof v === 'object' && v !== null && 'success' in v;
}
function isCaptionsResponse(v: unknown): v is CaptionsResponse {
  return typeof v === 'object' && v !== null && 'success' in v;
}
function isScheduleResponse(v: unknown): v is ScheduleResponse {
  return typeof v === 'object' && v !== null && 'success' in v;
}

// ── Caption windowing ───────────────────────────────────────────────────────

/**
 * Build the short's caption overlays (re-based to the short's own 0 timeline).
 *
 * The /captions route transcribes a WHOLE source clip and offsets timestamps by
 * a `startOffset`. A short can be cut from one or more sources, so for each
 * source span we ask for captions with no offset, keep only the words whose
 * midpoint lands inside the kept window [sourceStart, sourceEnd], then shift
 * them by (offsetInShort - sourceStart) so they sit correctly in the short.
 *
 * Returns `{ overlays }` on success, or `{ notConnected: true }` when the
 * transcription service isn't configured (the short still renders, uncaptioned).
 * Throws only on an unexpected/error response so the caller can fail the job.
 */
async function buildShortCaptions(
  clips: EditorClip[],
  short: ShortSegment,
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<{ overlays: CaptionOverlay[] } | { notConnected: true }> {
  const spans = resolveShortSourceSpans(clips, short.startSec, short.endSec);
  const overlays: CaptionOverlay[] = [];

  for (const span of spans) {
    const response = await authFetch('/api/video/editor/captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: span.url, startOffset: 0 }),
    });
    const json: unknown = await response.json();
    if (!isCaptionsResponse(json)) {
      throw new Error('Auto-captions came back in an unexpected format.');
    }
    if (!json.success) {
      if (json.code === 'not_connected') {
        return { notConnected: true };
      }
      throw new Error(json.error);
    }
    const shift = span.offsetInShort - span.sourceStart;
    for (const overlay of json.overlays) {
      const mid = (overlay.startTime + overlay.endTime) / 2;
      if (mid < span.sourceStart || mid > span.sourceEnd) {
        continue;
      }
      overlays.push({
        ...overlay,
        startTime: Math.max(0, overlay.startTime + shift),
        endTime: Math.max(0, overlay.endTime + shift),
      });
    }
  }

  return { overlays };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface RunOptions {
  /** Caption text sent to the scheduler with each post. */
  caption: string;
  /** ISO datetime string the post should publish at; null = save to Library only. */
  scheduledAt: string | null;
  /** Burn auto-captions into the rendered short. */
  autoCaptions: boolean;
  /** '720p' | '1080p' — passed straight to the render route. */
  resolution: '720p' | '1080p';
}

export interface UseMakeClips {
  jobs: ClipJob[];
  isRunning: boolean;
  run: (shorts: ShortSegment[], formatIds: string[], options: RunOptions) => Promise<void>;
  reset: () => void;
}

export function useMakeClips(
  clips: EditorClip[],
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
): UseMakeClips {
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const patch = useCallback((id: string, updates: Partial<ClipJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  }, []);

  const run = useCallback(
    async (shorts: ShortSegment[], formatIds: string[], options: RunOptions) => {
      const formats: ClipFormat[] = formatIds
        .map((id) => getClipFormat(id))
        .filter((f): f is ClipFormat => f !== undefined);

      if (shorts.length === 0 || formats.length === 0) {
        return;
      }

      // Build the full job grid up front so the UI shows every pending item.
      const initial: ClipJob[] = [];
      for (const short of shorts) {
        for (const format of formats) {
          initial.push({
            id: `${short.id}__${format.id}`,
            shortId: short.id,
            shortName: short.name,
            formatId: format.id,
            formatLabel: format.label,
            phase: 'queued',
            error: null,
            libraryUrl: null,
            postId: null,
            note: null,
          });
        }
      }
      setJobs(initial);
      setIsRunning(true);

      try {
        for (const short of shorts) {
          const renderClips: RenderReadyClip[] = sliceTimelineToClips(
            clips,
            short.startSec,
            short.endSec,
          );

          // Per-short caption build (shared across this short's formats). Only
          // fetched when at least one render will use it.
          let captionOverlays: CaptionOverlay[] = [];
          let captionNote: string | null = null;
          let captionFailed: string | null = null;
          const wantCaptions = options.autoCaptions && renderClips.length > 0;

          for (const format of formats) {
            const jobId = `${short.id}__${format.id}`;

            if (renderClips.length === 0) {
              patch(jobId, {
                phase: 'error',
                error: 'This short lands outside the video. Adjust its in/out points.',
              });
              continue;
            }

            // Captions (lazily, once per short).
            if (wantCaptions && captionOverlays.length === 0 && captionNote === null && captionFailed === null) {
              patch(jobId, { phase: 'captioning' });
              try {
                const result = await buildShortCaptions(clips, short, authFetch);
                if ('notConnected' in result) {
                  captionNote = 'Auto-captions need a Deepgram key — rendered without captions.';
                } else {
                  captionOverlays = result.overlays;
                }
              } catch (err) {
                captionFailed = err instanceof Error ? err.message : 'Auto-captions failed.';
              }
            }
            if (captionFailed) {
              patch(jobId, { phase: 'error', error: captionFailed });
              continue;
            }

            // Render.
            patch(jobId, { phase: 'rendering', note: captionNote });
            let item: RenderedMediaItem;
            try {
              const renderBody = {
                name: `${short.name} — ${format.label}`,
                clips: renderClips.map((c) => ({
                  id: c.id,
                  url: c.url,
                  trimStart: c.trimStart,
                  trimEnd: c.trimEnd,
                  transitionType: 'cut' as const,
                  ...(c.effect ? { effect: c.effect } : {}),
                })),
                textOverlays: captionOverlays,
                resolution: options.resolution,
                aspect: format.aspect,
              };
              const response = await authFetch('/api/video/editor/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(renderBody),
              });
              const json: unknown = await response.json();
              if (!isRenderResponse(json) || !json.success) {
                const message =
                  isRenderResponse(json) && !json.success && json.error
                    ? json.error
                    : 'Render failed.';
                patch(jobId, { phase: 'error', error: message });
                continue;
              }
              item = json.item;
            } catch {
              patch(jobId, { phase: 'error', error: 'Could not reach the render service.' });
              continue;
            }

            patch(jobId, { libraryUrl: item.url });

            // No schedule time → honest "saved to Library" outcome.
            if (!options.scheduledAt) {
              patch(jobId, {
                phase: 'saved',
                note: captionNote ?? 'Saved to your Library — set a time to schedule it.',
              });
              continue;
            }

            // Schedule the rendered clip to the real social scheduler.
            patch(jobId, { phase: 'scheduling' });
            try {
              const scheduleBody = {
                content: options.caption.trim() || short.name,
                platforms: [format.platform],
                scheduledAt: options.scheduledAt,
                mediaUrls: [item.url],
              };
              const response = await authFetch('/api/social/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleBody),
              });
              const json: unknown = await response.json();
              if (!isScheduleResponse(json) || !json.success) {
                const message =
                  isScheduleResponse(json) && !json.success && json.error
                    ? json.error
                    : 'Scheduling failed.';
                patch(jobId, {
                  phase: 'saved',
                  note: `Saved to your Library, but scheduling failed: ${message}`,
                });
                continue;
              }
              patch(jobId, {
                phase: 'scheduled',
                postId: json.postId,
                note: captionNote,
              });
            } catch {
              patch(jobId, {
                phase: 'saved',
                note: 'Saved to your Library, but the scheduler could not be reached.',
              });
            }
          }
        }
      } finally {
        setIsRunning(false);
      }
    },
    [clips, authFetch, patch],
  );

  const reset = useCallback(() => {
    setJobs([]);
  }, []);

  return { jobs, isRunning, run, reset };
}
