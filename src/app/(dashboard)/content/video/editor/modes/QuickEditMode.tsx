'use client';

/**
 * Quick Edits mode (parity floor: CapCut).
 *
 * A fast, one-screen workspace: a large preview, a simple horizontal clip strip
 * (reorder / trim / duplicate / delete / select), and one-tap quick actions
 * (add a caption, apply a look preset, pick a transition) plus a prominent
 * Export button. Everything drives the SHARED reducer via dispatch — this mode
 * never holds its own copy of the project state.
 */

import { useMemo } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Captions,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  SectionTitle,
  SubsectionTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import Preview from '@/components/video-editor/Preview';
import type { EditorModeProps } from '../editor-modes';
import {
  DEFAULT_CLIP_DURATION,
  TRANSITIONS,
  type EditorClip,
} from '../types';
import QuickClipStrip from './quick-edit/QuickClipStrip';
import { LOOK_PRESETS, activePresetId } from './quick-edit/look-presets';

// Sensible caption defaults — bottom, large, white-on-translucent (CapCut-style).
const CAPTION_DEFAULT_DURATION = 3; // seconds the caption stays on screen
const CAPTION_FONT_SIZE = 32;
const CAPTION_FONT_COLOR = '#ffffff';
const CAPTION_BG_COLOR = 'rgba(0,0,0,0.55)';

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
}

/** Raw source duration (before trims) — the trimming ceiling. */
function rawDuration(clip: EditorClip): number {
  return clip.duration || DEFAULT_CLIP_DURATION;
}

function clampTrim(value: number, max: number): number {
  if (Number.isNaN(value)) { return 0; }
  return Math.min(Math.max(0, value), max);
}

export default function QuickEditMode({
  state,
  dispatch,
  exportState,
  onExport,
  onSplit,
}: EditorModeProps) {
  const {
    clips,
    textOverlays,
    selectedClipId,
    selectedOverlayId,
    playheadTime,
    totalDuration,
    isPlaying,
  } = state;

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId],
  );

  const hasClips = clips.length > 0;

  // ── One-tap caption ────────────────────────────────────────────────────
  const addCaption = () => {
    const start = Math.min(playheadTime, Math.max(0, totalDuration - 0.1));
    dispatch({
      type: 'ADD_TEXT_OVERLAY',
      overlay: {
        text: 'Your caption',
        startTime: start,
        endTime: Math.min(totalDuration || start + CAPTION_DEFAULT_DURATION, start + CAPTION_DEFAULT_DURATION),
        position: 'bottom',
        fontSize: CAPTION_FONT_SIZE,
        fontColor: CAPTION_FONT_COLOR,
        backgroundColor: CAPTION_BG_COLOR,
      },
    });
  };

  const selectedOverlay = useMemo(
    () => textOverlays.find((o) => o.id === selectedOverlayId) ?? null,
    [textOverlays, selectedOverlayId],
  );

  // ── Trim handlers (drive UPDATE_CLIP trimStart/trimEnd) ─────────────────
  const onTrimStart = (clip: EditorClip, value: number) => {
    const max = rawDuration(clip) - clip.trimEnd - 0.1;
    dispatch({
      type: 'UPDATE_CLIP',
      clipId: clip.id,
      updates: { trimStart: clampTrim(value, Math.max(0, max)) },
    });
  };
  const onTrimEnd = (clip: EditorClip, value: number) => {
    const max = rawDuration(clip) - clip.trimStart - 0.1;
    dispatch({
      type: 'UPDATE_CLIP',
      clipId: clip.id,
      updates: { trimEnd: clampTrim(value, Math.max(0, max)) },
    });
  };

  const currentPresetId = selectedClip ? activePresetId(selectedClip.effect) : null;
  const currentTransition = selectedClip?.transitionType ?? 'cut';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle as="h3">Quick Edits</SectionTitle>
          <SectionDescription>
            Trim, reorder, caption, and add a quick look — then export. Built for speed.
          </SectionDescription>
        </div>
        <ExportButton
          phase={exportState.phase}
          error={exportState.error}
          disabled={!hasClips}
          onExport={onExport}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ── Preview + transport ─────────────────────────────────────── */}
        <div className="space-y-3 lg:col-span-8">
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
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedClip}
              onClick={onSplit}
              title="Split the selected clip at the playhead"
            >
              <Scissors className="mr-1.5 h-4 w-4" />
              Split at playhead
            </Button>
            <Caption className="ml-auto tabular-nums">
              {playheadTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </Caption>
          </div>

          {/* ── Clip strip ────────────────────────────────────────────── */}
          <div>
            <SubsectionTitle as="h4" className="mb-2 text-base">
              Clips
            </SubsectionTitle>
            <QuickClipStrip clips={clips} selectedClipId={selectedClipId} dispatch={dispatch} />
          </div>
        </div>

        {/* ── Quick actions panel ─────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-4">
          {/* Caption */}
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Captions className="h-4 w-4 text-primary" />
              <SubsectionTitle as="h4" className="text-base">
                Caption
              </SubsectionTitle>
            </div>
            <Button size="sm" className="w-full" disabled={!hasClips} onClick={addCaption}>
              Add caption at playhead
            </Button>
            {selectedOverlay ? (
              <div className="mt-3 space-y-1.5">
                <Caption>Edit selected caption text</Caption>
                <Input
                  value={selectedOverlay.text}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_TEXT_OVERLAY',
                      overlayId: selectedOverlay.id,
                      updates: { text: e.target.value },
                    })
                  }
                  placeholder="Caption text"
                />
              </div>
            ) : (
              <Caption className="mt-2 block">
                Captions land at the playhead. Drag them on the preview to reposition; click one to
                edit its text.
              </Caption>
            )}
          </Card>

          {/* Look presets */}
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <SubsectionTitle as="h4" className="text-base">
                Quick look
              </SubsectionTitle>
            </div>
            {selectedClip ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {LOOK_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      variant={currentPresetId === preset.id ? 'default' : 'outline'}
                      size="sm"
                      title={preset.hint}
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_CLIP',
                          clipId: selectedClip.id,
                          updates: { effect: { ...preset.effect } },
                        })
                      }
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Caption className="mt-2 block">Applies to the selected clip only.</Caption>
              </>
            ) : (
              <Caption className="block">Select a clip to apply a look.</Caption>
            )}
          </Card>

          {/* Transition */}
          <Card className="p-4">
            <SubsectionTitle as="h4" className="mb-2 text-base">
              Transition into this clip
            </SubsectionTitle>
            {selectedClip ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {TRANSITIONS.map((t) => (
                    <Button
                      key={t.value}
                      variant={currentTransition === t.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        dispatch({
                          type: 'SET_CLIP_TRANSITION',
                          clipId: selectedClip.id,
                          transition: t.value,
                        })
                      }
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
                <Caption className="mt-2 block">How this clip blends in from the one before it.</Caption>
              </>
            ) : (
              <Caption className="block">Select a clip to choose its transition.</Caption>
            )}
          </Card>

          {/* Trim */}
          <Card className="p-4">
            <SubsectionTitle as="h4" className="mb-2 text-base">
              Trim
            </SubsectionTitle>
            {selectedClip ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Caption>Trim from start (seconds)</Caption>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={selectedClip.trimStart}
                    onChange={(e) => onTrimStart(selectedClip, Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Caption>Trim from end (seconds)</Caption>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={selectedClip.trimEnd}
                    onChange={(e) => onTrimEnd(selectedClip, Number(e.target.value))}
                  />
                </div>
                <Caption className="block tabular-nums">
                  Plays for {effectiveDuration(selectedClip).toFixed(1)}s of{' '}
                  {rawDuration(selectedClip).toFixed(1)}s.
                </Caption>
              </div>
            ) : (
              <Caption className="block">Select a clip to trim its in and out points.</Caption>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export button — reflects the shared export lifecycle in plain English.
// ============================================================================

interface ExportButtonProps {
  phase: EditorModeProps['exportState']['phase'];
  error: string | null;
  disabled: boolean;
  onExport: () => void;
}

function ExportButton({ phase, error, disabled, onExport }: ExportButtonProps) {
  const rendering = phase === 'rendering';
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="lg" disabled={disabled || rendering} onClick={onExport}>
        {rendering ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {rendering ? 'Exporting…' : 'Export video'}
      </Button>
      {phase === 'rendering' && (
        <Caption className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Rendering your video — this can take a minute.
        </Caption>
      )}
      {phase === 'done' && (
        <Caption className="flex items-center gap-1 text-emerald-500">
          <CheckCircle2 className="h-3 w-3" />
          Done — saved to your Library.
        </Caption>
      )}
      {phase === 'error' && (
        <Caption className="flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-3 w-3" />
          {error ?? 'Export failed. Please try again.'}
        </Caption>
      )}
    </div>
  );
}
