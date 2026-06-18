'use client';

/**
 * Script & Podcast mode — edit by transcript.
 *
 * Workflow:
 *   1. Operator clicks "Transcribe project". We POST every clip URL to
 *      /api/video/editor/transcribe, which runs Deepgram and returns word-level
 *      timings per clip. (If Deepgram isn't configured the API says so and we
 *      show an honest "not connected" state — we never fake a transcript.)
 *   2. The transcript reads as text. Selecting a span of words and pressing
 *      "Delete selected" cuts that region out of the video by trimming/splitting
 *      the matching clip via the SHARED reducer (SPLIT_CLIP / REMOVE_CLIP /
 *      UPDATE_CLIP). One-click "Remove filler words" and "Remove silences" do the
 *      same against detected fillers/gaps.
 *
 * All edits drive the shared reducer through `dispatch`; this mode never holds
 * its own copy of the project. The transcript itself is a derived VIEW of the
 * clips (kept in local state), not project state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Loader2,
  AlertTriangle,
  Scissors,
  Trash2,
  Wind,
  Play,
  Pause,
  Download,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  SectionTitle,
  SubsectionTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import Preview from '@/components/video-editor/Preview';
import type { EditorModeProps } from '../editor-modes';
import type { EditorClip } from '../types';
import TranscriptPanel from './script-podcast/TranscriptPanel';
import {
  buildTokens,
  findSilences,
  planNextCutStep,
  CUT_EPSILON,
  type ClipWords,
  type ClipCutRegion,
  type TranscriptToken,
} from './script-podcast/transcript-model';

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

type TranscribeStatus =
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

export default function ScriptPodcastMode({
  state,
  dispatch,
  authFetch,
  exportState,
  onExport,
}: EditorModeProps) {
  const {
    clips,
    textOverlays,
    selectedOverlayId,
    playheadTime,
    totalDuration,
    isPlaying,
  } = state;

  const [status, setStatus] = useState<TranscribeStatus>({ phase: 'idle' });
  // Selection range over transcript tokens (anchor + focus).
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const hasClips = clips.length > 0;
  const exporting = exportState.phase === 'rendering';

  const clipWords = useMemo<ClipWords[]>(
    () => (status.phase === 'ready' ? status.clipWords : []),
    [status],
  );

  // Map a clip id → its source url, captured at transcription time so we can tag
  // cut regions with the url (clip ids change after a split; urls don't).
  const urlByClipId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clips) {
      map.set(c.id, c.url);
    }
    return map;
  }, [clips]);

  // Tokens are derived from clips + transcript; rebuild whenever either changes.
  const tokens = useMemo(
    () => buildTokens(clips, clipWords),
    [clips, clipWords],
  );

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
  // re-resolve against fresh `state.clips` until every region is consumed. The
  // queue is held in a ref + a tick counter so the effect re-runs after each
  // dispatch settles.
  const cutQueueRef = useRef<ClipCutRegion[]>([]);
  // Bumped to wake the cut effect; the effect itself also re-runs when `clips`
  // changes after each dispatch, so the queue drains one step per settle.
  const [cutTick, setCutTick] = useState(0);
  const [isCutting, setIsCutting] = useState(false);

  const enqueueCuts = useCallback((regions: ClipCutRegion[]) => {
    if (regions.length === 0) {
      return;
    }
    // Apply later regions first so earlier source times stay valid as the
    // timeline shrinks (cuts are within a clip's source space, but processing
    // back-to-front avoids any index drift).
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

  const ready = status.phase === 'ready';

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle as="h3">Script &amp; Podcast</SectionTitle>
          <SectionDescription>
            Edit by transcript — delete words to cut the video, and strip filler words and
            silences in one click.
          </SectionDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="lg" disabled={!hasClips || exporting} onClick={onExport}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? 'Exporting…' : 'Export video'}
          </Button>
          {exportState.phase === 'done' && (
            <Caption className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              Done — saved to your Library.
            </Caption>
          )}
          {exportState.phase === 'error' && (
            <Caption className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {exportState.error ?? 'Export failed. Please try again.'}
            </Caption>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ── Preview + transport ───────────────────────────────────────── */}
        <div className="space-y-3 lg:col-span-5">
          <Preview
            clips={clips}
            textOverlays={textOverlays}
            selectedOverlayId={selectedOverlayId}
            playheadTime={playheadTime}
            isPlaying={isPlaying}
            totalDuration={totalDuration}
            dispatch={dispatch}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasClips}
              onClick={() => dispatch({ type: 'SET_PLAYING', playing: !isPlaying })}
            >
              {isPlaying ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Caption className="ml-auto tabular-nums">
              {playheadTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </Caption>
          </div>
        </div>

        {/* ── Transcript workspace ──────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <SubsectionTitle as="h4" className="text-base">
                  Transcript
                </SubsectionTitle>
              </div>
              {ready ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCutting}
                  onClick={() => void transcribe()}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Re-transcribe
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!hasClips || status.phase === 'loading'}
                  onClick={() => void transcribe()}
                >
                  {status.phase === 'loading' ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-1.5 h-4 w-4" />
                  )}
                  {status.phase === 'loading' ? 'Transcribing…' : 'Transcribe project'}
                </Button>
              )}
            </div>

            <TranscriptStatusBody
              status={status}
              hasClips={hasClips}
              tokens={tokens}
              selectedIds={selectedIds}
              activeTokenId={activeTokenId}
              onWordClick={onWordClick}
            />
          </Card>

          {/* ── Edit actions ────────────────────────────────────────────── */}
          {ready && (
            <Card className="p-4">
              <SubsectionTitle as="h4" className="mb-2 text-base">
                Edits
              </SubsectionTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selectedTokens.length === 0 || isCutting}
                  onClick={deleteSelection}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete selected
                  {selectedTokens.length > 0 ? ` (${selectedTokens.length})` : ''}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={fillerCount === 0 || isCutting}
                  onClick={removeFillers}
                >
                  <Scissors className="mr-1.5 h-4 w-4" />
                  Remove filler words{fillerCount > 0 ? ` (${fillerCount})` : ''}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={silences.length === 0 || isCutting}
                  onClick={removeSilences}
                >
                  <Wind className="mr-1.5 h-4 w-4" />
                  Remove silences{silences.length > 0 ? ` (${silences.length})` : ''}
                </Button>
                {isCutting && (
                  <Caption className="flex items-center gap-1 self-center">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Applying cuts…
                  </Caption>
                )}
              </div>
              <Caption className="mt-3 block">
                Click a word to jump there. Click one word then Shift-click another to select a
                span, then Delete to cut it from the video. Filler words are tinted amber.
              </Caption>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Transcript body — switches between the panel and the honest status states.
// ===========================================================================

interface TranscriptStatusBodyProps {
  status: TranscribeStatus;
  hasClips: boolean;
  tokens: TranscriptToken[];
  selectedIds: ReadonlySet<string>;
  activeTokenId: string | null;
  onWordClick: (token: TranscriptToken, shiftKey: boolean) => void;
}

function TranscriptStatusBody({
  status,
  hasClips,
  tokens,
  selectedIds,
  activeTokenId,
  onWordClick,
}: TranscriptStatusBodyProps) {
  if (status.phase === 'ready') {
    return (
      <TranscriptPanel
        tokens={tokens}
        selectedIds={selectedIds}
        activeTokenId={activeTokenId}
        onWordClick={onWordClick}
      />
    );
  }

  if (status.phase === 'not_connected') {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface-elevated p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-amber-500" />
        <SubsectionTitle as="h4" className="text-base">
          Transcription isn&apos;t connected yet
        </SubsectionTitle>
        <SectionDescription className="mx-auto mt-1 max-w-sm">
          {status.message} Connect a transcription service to enable script editing.
        </SectionDescription>
      </div>
    );
  }

  if (status.phase === 'error') {
    return (
      <div className="rounded-xl border border-dashed border-destructive/50 bg-surface-elevated p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-destructive" />
        <SectionDescription className="mx-auto max-w-sm">{status.message}</SectionDescription>
      </div>
    );
  }

  // idle / loading
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-elevated p-6 text-center">
      <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
      <SectionDescription className="mx-auto max-w-sm">
        {hasClips
          ? status.phase === 'loading'
            ? 'Transcribing your clips — this can take a moment.'
            : 'Click “Transcribe project” to turn your clips into an editable script.'
          : 'Add clips to your project first, then transcribe them to edit by script.'}
      </SectionDescription>
    </div>
  );
}
