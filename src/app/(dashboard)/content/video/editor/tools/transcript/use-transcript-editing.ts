'use client';

/**
 * Transcript editing hook — the edit-by-transcript brain, lifted out of the old
 * Script & Podcast mode so the narrow tool panel stays thin.
 *
 * Workflow (unchanged from the proven mode):
 *   1. `transcribe()` POSTs every clip URL to /api/video/editor/transcribe, which
 *      runs Deepgram and returns word-level timings per clip. If Deepgram isn't
 *      configured the API replies `not_connected` and we surface an honest state —
 *      we never fake a transcript.
 *   2. The transcript reads as selectable word tokens. `deleteSelection`,
 *      `removeFillers`, and `removeSilences` translate transcript spans into source
 *      regions and cut them out of the matching clips via the SHARED reducer
 *      (SPLIT_CLIP / REMOVE_CLIP / UPDATE_CLIP).
 *
 * Every edit drives the shared reducer through `dispatch`; this hook never holds
 * its own copy of the project. The transcript is a derived VIEW of the clips.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';

import type { EditorClip, EditorAction } from '../../types';
import {
  buildTokens,
  findSilences,
  planNextCutStep,
  CUT_EPSILON,
  type ClipWords,
  type ClipCutRegion,
  type TranscriptToken,
} from '../../modes/script-podcast/transcript-model';

// ---------------------------------------------------------------------------
// API response shapes (mirror /api/video/editor/transcribe).
// ---------------------------------------------------------------------------

interface ApiClipTranscript {
  clipId: string;
  transcript: string;
  words: { word: string; start: number; end: number; confidence: number }[];
  durationSeconds: number;
  confidence: number;
}

interface ApiSuccess {
  success: true;
  results: ApiClipTranscript[];
}

interface ApiFailure {
  success: false;
  code: 'not_connected' | 'invalid_request' | 'error';
  error: string;
}

function isApiSuccess(value: unknown): value is ApiSuccess {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { success?: unknown }).success === true &&
    Array.isArray((value as { results?: unknown }).results)
  );
}

function isApiFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { success?: unknown }).success === false &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

// ---------------------------------------------------------------------------
// Transcribe status (local view state, not project state).
// ---------------------------------------------------------------------------

export type TranscribeStatus =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; clipWords: ClipWords[] }
  | { phase: 'not_connected'; message: string }
  | { phase: 'error'; message: string };

/** Find which surviving clip currently overlaps a source region (for cut steps). */
function clipOverlappingRegion(
  clips: EditorClip[],
  region: ClipCutRegion,
): EditorClip | null {
  // SPLIT_CLIP mints new ids, so we can't match by id after a split — we match
  // by SOURCE URL + OVERLAP instead. All pieces of a take share the same source
  // `url`, so among same-url pieces the one still covering the region is the cut.
  for (const clip of clips) {
    if (clip.url !== region.clipUrl) {
      continue;
    }
    const visibleStart = clip.trimStart;
    const visibleEnd = (clip.duration || 0) - clip.trimEnd;
    const overlapStart = Math.max(region.removeStart, visibleStart);
    const overlapEnd = Math.min(region.removeEnd, visibleEnd);
    if (overlapEnd - overlapStart > CUT_EPSILON) {
      return clip;
    }
  }
  return null;
}

export interface TranscriptEditingArgs {
  clips: EditorClip[];
  playheadTime: number;
  dispatch: Dispatch<EditorAction>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface TranscriptEditing {
  status: TranscribeStatus;
  ready: boolean;
  tokens: TranscriptToken[];
  selectedIds: ReadonlySet<string>;
  selectedCount: number;
  activeTokenId: string | null;
  fillerCount: number;
  silenceCount: number;
  isCutting: boolean;
  transcribe: () => Promise<void>;
  onWordClick: (token: TranscriptToken, shiftKey: boolean) => void;
  deleteSelection: () => void;
  removeFillers: () => void;
  removeSilences: () => void;
}

export function useTranscriptEditing({
  clips,
  playheadTime,
  dispatch,
  authFetch,
}: TranscriptEditingArgs): TranscriptEditing {
  const [status, setStatus] = useState<TranscribeStatus>({ phase: 'idle' });
  // Selection range over transcript tokens (anchor + focus).
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const clipWords = useMemo<ClipWords[]>(
    () => (status.phase === 'ready' ? status.clipWords : []),
    [status],
  );

  // Map a clip id → its source url, captured so we can tag cut regions with the
  // url (clip ids change after a split; urls don't).
  const urlByClipId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clips) {
      map.set(c.id, c.url);
    }
    return map;
  }, [clips]);

  // Tokens are derived from clips + transcript; rebuild whenever either changes.
  const tokens = useMemo(() => buildTokens(clips, clipWords), [clips, clipWords]);

  // ── Selection range → set of token ids ────────────────────────────────
  const selectedIds = useMemo(() => {
    if (!anchorId || !focusId) {
      return new Set<string>(anchorId ? [anchorId] : []);
    }
    const ai = tokens.findIndex((t) => t.id === anchorId);
    const fi = tokens.findIndex((t) => t.id === focusId);
    if (ai === -1 || fi === -1) {
      return new Set<string>();
    }
    const [lo, hi] = ai <= fi ? [ai, fi] : [fi, ai];
    const ids = new Set<string>();
    for (let i = lo; i <= hi; i += 1) {
      ids.add(tokens[i].id);
    }
    return ids;
  }, [anchorId, focusId, tokens]);

  const selectedTokens = useMemo(
    () => tokens.filter((t) => selectedIds.has(t.id)),
    [tokens, selectedIds],
  );

  // ── Active token = the word under the playhead ─────────────────────────
  const activeTokenId = useMemo(() => {
    // Walk the timeline: a token's timeline position = cumulative effective
    // duration of prior clips + (token.start - clip.trimStart).
    let elapsed = 0;
    for (const clip of clips) {
      const visibleStart = clip.trimStart;
      const effDur = Math.max(0.1, (clip.duration || 0) - clip.trimStart - clip.trimEnd);
      const clipTokens = tokens.filter((t) => t.clipId === clip.id);
      for (const t of clipTokens) {
        const tlStart = elapsed + (t.start - visibleStart);
        const tlEnd = elapsed + (t.end - visibleStart);
        if (playheadTime >= tlStart && playheadTime <= tlEnd) {
          return t.id;
        }
      }
      elapsed += effDur;
    }
    return null;
  }, [clips, tokens, playheadTime]);

  // ── Transcribe ─────────────────────────────────────────────────────────
  const transcribe = useCallback(async () => {
    if (clips.length === 0) {
      return;
    }
    setStatus({ phase: 'loading' });
    setAnchorId(null);
    setFocusId(null);
    try {
      const response = await authFetch('/api/video/editor/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: clips.map((c) => ({ clipId: c.id, url: c.url })),
        }),
      });
      const data: unknown = await response.json();

      if (isApiSuccess(data)) {
        const cw: ClipWords[] = data.results.map((r) => ({
          clipId: r.clipId,
          words: r.words,
        }));
        setStatus({ phase: 'ready', clipWords: cw });
        return;
      }

      if (isApiFailure(data) && data.code === 'not_connected') {
        setStatus({ phase: 'not_connected', message: data.error });
        return;
      }

      const message = isApiFailure(data)
        ? data.error
        : 'Transcription failed. Please try again.';
      setStatus({ phase: 'error', message });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription request failed.';
      setStatus({ phase: 'error', message });
    }
  }, [authFetch, clips]);

  // ── Cut a list of source regions out of the timeline ───────────────────
  // SPLIT_CLIP mints new clip ids, so we apply ONE reducer action per render and
  // re-resolve against fresh `clips` until every region is consumed. The queue is
  // held in a ref + a tick counter so the effect re-runs after each dispatch settles.
  const cutQueueRef = useRef<ClipCutRegion[]>([]);
  const [cutTick, setCutTick] = useState(0);
  const [isCutting, setIsCutting] = useState(false);

  const enqueueCuts = useCallback((regions: ClipCutRegion[]) => {
    if (regions.length === 0) {
      return;
    }
    // Apply later regions first so earlier source times stay valid as the
    // timeline shrinks (processing back-to-front avoids any index drift).
    const sorted = [...regions].sort((a, b) => b.removeStart - a.removeStart);
    cutQueueRef.current = [...cutQueueRef.current, ...sorted];
    setIsCutting(true);
    setCutTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (cutQueueRef.current.length === 0) {
      if (isCutting) {
        setIsCutting(false);
      }
      return;
    }
    const region = cutQueueRef.current[0];
    const clip = clipOverlappingRegion(clips, region);
    if (!clip) {
      // Region fully consumed (or no longer present) — drop it and continue.
      cutQueueRef.current = cutQueueRef.current.slice(1);
      setCutTick((t) => t + 1);
      return;
    }
    const action = planNextCutStep(clip, region);
    if (action === null) {
      cutQueueRef.current = cutQueueRef.current.slice(1);
      setCutTick((t) => t + 1);
      return;
    }
    // Dispatch one step; the resulting `clips` change re-runs this effect, which
    // then plans the next step against the fresh timeline until the queue empties.
    dispatch(action);
  }, [cutTick, clips, isCutting, dispatch]);

  // ── Build cut regions from the current selection ───────────────────────
  const deleteSelection = useCallback(() => {
    if (selectedTokens.length === 0) {
      return;
    }
    // Group contiguous selected words per clip into regions.
    const regions: ClipCutRegion[] = [];
    const byClip = new Map<string, TranscriptToken[]>();
    for (const t of selectedTokens) {
      const list = byClip.get(t.clipId) ?? [];
      list.push(t);
      byClip.set(t.clipId, list);
    }
    for (const [clipId, list] of byClip) {
      const clipUrl = urlByClipId.get(clipId);
      if (!clipUrl) {
        continue;
      }
      list.sort((a, b) => a.wordIndex - b.wordIndex);
      let runStart = list[0];
      let prev = list[0];
      for (let i = 1; i < list.length; i += 1) {
        const cur = list[i];
        if (cur.wordIndex !== prev.wordIndex + 1) {
          regions.push({ clipId, clipUrl, removeStart: runStart.start, removeEnd: prev.end });
          runStart = cur;
        }
        prev = cur;
      }
      regions.push({ clipId, clipUrl, removeStart: runStart.start, removeEnd: prev.end });
    }
    enqueueCuts(regions);
    setAnchorId(null);
    setFocusId(null);
  }, [selectedTokens, urlByClipId, enqueueCuts]);

  // ── Remove all filler words ────────────────────────────────────────────
  const fillerCount = useMemo(() => tokens.filter((t) => t.isFiller).length, [tokens]);

  const removeFillers = useCallback(() => {
    const fillers = tokens.filter((t) => t.isFiller);
    if (fillers.length === 0) {
      return;
    }
    const regions: ClipCutRegion[] = [];
    for (const t of fillers) {
      const clipUrl = urlByClipId.get(t.clipId);
      if (clipUrl) {
        regions.push({ clipId: t.clipId, clipUrl, removeStart: t.start, removeEnd: t.end });
      }
    }
    enqueueCuts(regions);
  }, [tokens, urlByClipId, enqueueCuts]);

  // ── Remove silences ────────────────────────────────────────────────────
  const silences = useMemo(() => findSilences(clipWords), [clipWords]);

  const removeSilences = useCallback(() => {
    if (silences.length === 0) {
      return;
    }
    const regions: ClipCutRegion[] = [];
    for (const g of silences) {
      const clipUrl = urlByClipId.get(g.clipId);
      if (clipUrl) {
        regions.push({ clipId: g.clipId, clipUrl, removeStart: g.start, removeEnd: g.end });
      }
    }
    enqueueCuts(regions);
  }, [silences, urlByClipId, enqueueCuts]);

  // ── Word click → playhead + selection ──────────────────────────────────
  const onWordClick = useCallback(
    (token: TranscriptToken, shiftKey: boolean) => {
      // Move the playhead to this word's timeline position.
      let elapsed = 0;
      for (const clip of clips) {
        if (clip.id === token.clipId) {
          dispatch({ type: 'SET_PLAYHEAD', time: elapsed + (token.start - clip.trimStart) });
          dispatch({ type: 'SELECT_CLIP', clipId: clip.id });
          break;
        }
        elapsed += Math.max(0.1, (clip.duration || 0) - clip.trimStart - clip.trimEnd);
      }
      // Selection: shift extends the range, plain click starts a new one.
      if (shiftKey && anchorId) {
        setFocusId(token.id);
      } else {
        setAnchorId(token.id);
        setFocusId(token.id);
      }
    },
    [clips, dispatch, anchorId],
  );

  return {
    status,
    ready: status.phase === 'ready',
    tokens,
    selectedIds,
    selectedCount: selectedTokens.length,
    activeTokenId,
    fillerCount,
    silenceCount: silences.length,
    isCutting,
    transcribe,
    onWordClick,
    deleteSelection,
    removeFillers,
    removeSilences,
  };
}
