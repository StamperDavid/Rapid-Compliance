'use client';

/**
 * Text & Captions tool panel.
 *
 * Right-column panel (~380px) beside the shared Preview + Timeline — it never
 * renders its own preview. It drives the SHARED reducer via `dispatch`:
 *   - ADD_TEXT_OVERLAY    add a caption at the playhead / from auto-subtitles
 *   - UPDATE_TEXT_OVERLAY edit the selected overlay
 *   - REMOVE_TEXT_OVERLAY delete the selected overlay
 *   - SELECT_OVERLAY      pick which overlay the operator is editing
 *
 * Auto-subtitles call the real /api/video/editor/captions route per clip,
 * offsetting each clip's captions by its cumulative timeline position. When no
 * transcription service is connected the route answers 503 not_connected — we
 * surface that plainly and never fabricate captions.
 */

import { useState } from 'react';
import { Plus, Trash2, Type, Captions, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CardTitle, Caption, SectionDescription } from '@/components/ui/typography';
import {
  CAPTION_STYLES,
  CAPTION_STYLE_LABELS,
  CAPTION_STYLE_HINTS,
  type CaptionStyle,
} from '@/types/video-pipeline';
import type { EditorToolProps } from '../editor-tools';
import type { TextOverlay } from '../types';
import OverlayFields, { type OverlayDraft } from './text/OverlayFields';
import CaptionStyleCard from './text/CaptionStyleCard';
import {
  buildDefaultOverlay,
  clipTimelineOffsets,
  formatSeconds,
} from './text/overlay-helpers';

/** Shape of a successful captions response from /api/video/editor/captions. */
interface CaptionsSuccess {
  success: true;
  overlays: Omit<TextOverlay, 'id'>[];
}
interface CaptionsFailure {
  success: false;
  code: 'not_connected' | 'invalid_request' | 'error';
  error: string;
}
type CaptionsResponse = CaptionsSuccess | CaptionsFailure;

function isCaptionsResponse(value: unknown): value is CaptionsResponse {
  if (typeof value !== 'object' || value === null || !('success' in value)) {
    return false;
  }
  return typeof (value as { success: unknown }).success === 'boolean';
}

/** Snapshot the editable fields of an overlay for the edit form. */
function toDraft(overlay: TextOverlay): OverlayDraft {
  return {
    text: overlay.text,
    position: overlay.position,
    fontSize: overlay.fontSize,
    fontColor: overlay.fontColor,
    backgroundColor: overlay.backgroundColor,
  };
}

export default function TextToolPanel({ state, dispatch, authFetch }: EditorToolProps) {
  const { textOverlays, selectedOverlayId, playheadTime, totalDuration, clips } = state;
  const selectedOverlay = textOverlays.find((o) => o.id === selectedOverlayId) ?? null;

  // ── Add-text form ──────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<OverlayDraft>(() => {
    const base = buildDefaultOverlay(playheadTime, totalDuration);
    return toDraft({ ...base, id: 'draft' });
  });

  function handleAdd() {
    const base = buildDefaultOverlay(playheadTime, totalDuration);
    dispatch({
      type: 'ADD_TEXT_OVERLAY',
      overlay: {
        ...base,
        text: addDraft.text.trim() || base.text,
        position: addDraft.position,
        fontSize: addDraft.fontSize,
        fontColor: addDraft.fontColor,
        backgroundColor: addDraft.backgroundColor,
      },
    });
    setShowAddForm(false);
    // Reset the add draft for next time, anchored at the (then) playhead.
    const next = buildDefaultOverlay(playheadTime, totalDuration);
    setAddDraft(toDraft({ ...next, id: 'draft' }));
  }

  // ── Edit selected ──────────────────────────────────────────────────────
  function handleEditField(updates: Partial<OverlayDraft>) {
    if (!selectedOverlay) { return; }
    dispatch({ type: 'UPDATE_TEXT_OVERLAY', overlayId: selectedOverlay.id, updates });
  }

  // ── Delete (two-step confirm per project rule) ─────────────────────────
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  function handleDelete(overlayId: string) {
    if (armedDeleteId !== overlayId) {
      setArmedDeleteId(overlayId);
      window.setTimeout(() => setArmedDeleteId((cur) => (cur === overlayId ? null : cur)), 5000);
      return;
    }
    dispatch({ type: 'REMOVE_TEXT_OVERLAY', overlayId });
    setArmedDeleteId(null);
  }

  // ── Auto-subtitles ─────────────────────────────────────────────────────
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bold-center');
  const [subtitleState, setSubtitleState] = useState<
    | { phase: 'idle' }
    | { phase: 'working'; done: number; total: number }
    | { phase: 'error'; message: string }
    | { phase: 'not_connected' }
    | { phase: 'done'; added: number }
  >({ phase: 'idle' });

  async function handleGenerateSubtitles() {
    const captionableClips = clips.filter((c) => c.url);
    if (captionableClips.length === 0) {
      setSubtitleState({ phase: 'error', message: 'Add at least one clip to the timeline first.' });
      return;
    }

    const offsets = clipTimelineOffsets(clips);
    let added = 0;

    setSubtitleState({ phase: 'working', done: 0, total: captionableClips.length });

    for (let i = 0; i < clips.length; i += 1) {
      const clip = clips[i];
      if (!clip.url) { continue; }
      try {
        const response = await authFetch('/api/video/editor/captions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: clip.url, startOffset: offsets[i], style: captionStyle }),
        });
        const json: unknown = await response.json();
        if (!isCaptionsResponse(json)) {
          setSubtitleState({ phase: 'error', message: 'Subtitles came back in an unexpected format.' });
          return;
        }
        if (!json.success) {
          if (json.code === 'not_connected') {
            setSubtitleState({ phase: 'not_connected' });
            return;
          }
          setSubtitleState({ phase: 'error', message: json.error });
          return;
        }
        for (const overlay of json.overlays) {
          dispatch({ type: 'ADD_TEXT_OVERLAY', overlay });
          added += 1;
        }
        setSubtitleState((prev) =>
          prev.phase === 'working'
            ? { phase: 'working', done: prev.done + 1, total: prev.total }
            : prev,
        );
      } catch {
        setSubtitleState({ phase: 'error', message: 'Could not reach the subtitle service. Try again.' });
        return;
      }
    }

    setSubtitleState({ phase: 'done', added });
  }

  const isWorking = subtitleState.phase === 'working';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Type className="h-5 w-5 text-primary" />
        <CardTitle>Text &amp; Captions</CardTitle>
      </div>

      {/* ── Add text ──────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border border-border-strong bg-card p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Add text</CardTitle>
          <Caption>at {formatSeconds(Math.max(0, playheadTime))}</Caption>
        </div>
        {showAddForm ? (
          <div className="space-y-3">
            <OverlayFields draft={addDraft} idPrefix="add" onChange={(u) => setAddDraft((d) => ({ ...d, ...u }))} />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={handleAdd}>
                <Plus className="mr-1 h-4 w-4" /> Add to video
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add a text overlay
          </Button>
        )}
      </section>

      {/* ── Overlay list ──────────────────────────────────────────────── */}
      <section className="space-y-2">
        <CardTitle className="text-sm">On this video</CardTitle>
        {textOverlays.length === 0 ? (
          <SectionDescription>No text yet. Add one above or generate subtitles below.</SectionDescription>
        ) : (
          <ul className="space-y-1.5">
            {textOverlays
              .slice()
              .sort((a, b) => a.startTime - b.startTime)
              .map((overlay) => {
                const isSelected = overlay.id === selectedOverlayId;
                return (
                  <li key={overlay.id}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SELECT_OVERLAY', overlayId: overlay.id })}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border-strong bg-card hover:bg-accent'
                      }`}
                    >
                      <span className="truncate text-sm text-foreground">{overlay.text || '(empty)'}</span>
                      <Caption className="shrink-0">{formatSeconds(overlay.startTime)}</Caption>
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* ── Edit selected ─────────────────────────────────────────────── */}
      {selectedOverlay ? (
        <section className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
          <CardTitle className="text-sm">Edit selected text</CardTitle>
          <OverlayFields
            draft={toDraft(selectedOverlay)}
            idPrefix="edit"
            onChange={handleEditField}
          />
          <Button
            size="sm"
            variant={armedDeleteId === selectedOverlay.id ? 'destructive' : 'outline'}
            className="w-full"
            onClick={() => handleDelete(selectedOverlay.id)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {armedDeleteId === selectedOverlay.id ? 'Click again to delete' : 'Delete text'}
          </Button>
        </section>
      ) : null}

      {/* ── Auto-subtitles ────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border border-border-strong bg-card p-4">
        <div className="flex items-center gap-2">
          <Captions className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Auto-subtitles</CardTitle>
        </div>
        <SectionDescription>
          Transcribe every clip and drop synced captions onto your timeline.
        </SectionDescription>

        {/* ── Caption style picker — visual gallery ─────────────────────── */}
        <div className="space-y-1.5">
          <Label>Caption style</Label>
          <Caption className="block">Pick a look — each card shows how your captions will appear.</Caption>
          <div className="grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {CAPTION_STYLES.map((style) => (
              <CaptionStyleCard
                key={style}
                style={style}
                label={CAPTION_STYLE_LABELS[style]}
                hint={CAPTION_STYLE_HINTS[style]}
                selected={captionStyle === style}
                disabled={isWorking}
                onSelect={setCaptionStyle}
              />
            ))}
          </div>
        </div>

        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            void handleGenerateSubtitles();
          }}
          disabled={isWorking}
        >
          {isWorking ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Transcribing clip {subtitleState.done + 1} of{' '}
              {subtitleState.total}…
            </>
          ) : (
            <>
              <Captions className="mr-1 h-4 w-4" /> Generate subtitles
            </>
          )}
        </Button>

        {subtitleState.phase === 'not_connected' ? (
          <div className="flex items-start gap-2 rounded-lg border border-border-strong bg-surface-elevated p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <Caption className="block">
              Add a Deepgram key in Settings to enable subtitles.
            </Caption>
          </div>
        ) : null}

        {subtitleState.phase === 'error' ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <Caption className="block text-destructive">{subtitleState.message}</Caption>
          </div>
        ) : null}

        {subtitleState.phase === 'done' ? (
          <Caption className="block">
            {subtitleState.added > 0
              ? `Added ${subtitleState.added} caption${subtitleState.added === 1 ? '' : 's'}.`
              : 'No speech was found to caption.'}
          </Caption>
        ) : null}
      </section>
    </div>
  );
}
