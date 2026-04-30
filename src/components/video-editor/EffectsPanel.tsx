'use client';

/**
 * EffectsPanel — right-hand panel for the video editor.
 *
 * Contextual to selection:
 *   - Clip selected   → Lighting sliders + transition picker + delete (2-step)
 *   - Overlay selected → Text content / font / size / color editor + delete
 *   - Nothing selected → Upload + drop zone, plus quick-add text button
 *
 * The two-step destructive confirmation lives here (per project rule
 * `feedback_destructive_actions_two_step_confirmation`) — we route through
 * the design system ConfirmDialog component.
 */

import { useCallback, useRef, useState } from 'react';
import { Upload, Trash2, Type, Wand2, Palette, ArrowRightLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  TRANSITIONS,
  NEUTRAL_EFFECT,
  type EditorClip,
  type TextOverlay,
  type ClipEffect,
  type EditorAction,
} from '@/app/(dashboard)/content/video/editor/types';
import type { TransitionType } from '@/types/video-pipeline';
import type { MediaItem } from '@/types/media-library';

interface EffectsPanelProps {
  clips: EditorClip[];
  textOverlays: TextOverlay[];
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  playheadTime: number;
  totalDuration: number;
  dispatch: React.Dispatch<EditorAction>;
}

// ============================================================================
// Helpers
// ============================================================================

interface MediaUploadResponse {
  success: boolean;
  item?: MediaItem;
  error?: string;
}

function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 5);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(5);
    };
    v.src = url;
  });
}

// ============================================================================
// Slider primitive
// ============================================================================

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: string;
}

function Slider({ label, value, min, max, step, onChange, display }: SliderProps) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {display ?? value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
    </label>
  );
}

// ============================================================================
// Sub-panels
// ============================================================================

function ClipPanel({
  clip,
  dispatch,
  onRequestDelete,
}: {
  clip: EditorClip;
  dispatch: React.Dispatch<EditorAction>;
  onRequestDelete: () => void;
}) {
  const effect: ClipEffect = clip.effect ?? NEUTRAL_EFFECT;

  const updateEffect = (patch: Partial<ClipEffect>) => {
    dispatch({
      type: 'UPDATE_CLIP',
      clipId: clip.id,
      updates: { effect: { ...effect, ...patch } },
    });
  };

  const setTransition = (t: TransitionType) => {
    dispatch({ type: 'SET_CLIP_TRANSITION', clipId: clip.id, transition: t });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white truncate">{clip.name}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {(clip.duration || 0).toFixed(1)}s source · trim {clip.trimStart.toFixed(1)}s /{' '}
            {clip.trimEnd.toFixed(1)}s
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-red-400"
          onClick={onRequestDelete}
          title="Delete clip"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Lighting effects */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            Lighting
          </div>
          <button
            type="button"
            className="text-[10px] text-zinc-500 hover:text-amber-400"
            onClick={() => {
              dispatch({
                type: 'UPDATE_CLIP',
                clipId: clip.id,
                updates: { effect: { ...NEUTRAL_EFFECT } },
              });
            }}
          >
            Reset
          </button>
        </div>

        <Slider
          label="Brightness"
          value={effect.brightness}
          min={-1}
          max={1}
          step={0.05}
          onChange={(v) => updateEffect({ brightness: v })}
          display={`${(effect.brightness * 100).toFixed(0)}%`}
        />
        <Slider
          label="Contrast"
          value={effect.contrast}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => updateEffect({ contrast: v })}
        />
        <Slider
          label="Saturation"
          value={effect.saturation}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => updateEffect({ saturation: v })}
        />
        <Slider
          label="Hue"
          value={effect.hue}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => updateEffect({ hue: v })}
          display={`${effect.hue.toFixed(0)}°`}
        />
      </div>

      {/* Transition (applied at the trailing edge) */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
          <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
          Transition out
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSITIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTransition(t.value)}
              className={`text-[11px] py-1.5 rounded border ${
                clip.transitionType === t.value
                  ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OverlayPanel({
  overlay,
  totalDuration,
  dispatch,
  onRequestDelete,
}: {
  overlay: TextOverlay;
  totalDuration: number;
  dispatch: React.Dispatch<EditorAction>;
  onRequestDelete: () => void;
}) {
  const update = (patch: Partial<TextOverlay>) => {
    dispatch({ type: 'UPDATE_TEXT_OVERLAY', overlayId: overlay.id, updates: patch });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-white">Text overlay</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-red-400"
          onClick={onRequestDelete}
          title="Delete overlay"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <label className="block">
        <span className="block text-[11px] font-medium text-zinc-400 mb-1">Text</span>
        <textarea
          value={overlay.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={2}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[10px] font-medium text-zinc-400 mb-1">Font size</span>
          <Input
            type="number"
            min={10}
            max={120}
            value={overlay.fontSize}
            onChange={(e) => update({ fontSize: Math.max(10, Number(e.target.value) || 24) })}
            className="h-8 text-xs bg-zinc-900 border-zinc-800"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-medium text-zinc-400 mb-1">Font family</span>
          <select
            value={overlay.fontFamily ?? 'system-ui, sans-serif'}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="system-ui, sans-serif">Sans serif</option>
            <option value="Georgia, serif">Serif</option>
            <option value="ui-monospace, monospace">Monospace</option>
            <option value="Impact, sans-serif">Impact</option>
            <option value="Helvetica, sans-serif">Helvetica</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[10px] font-medium text-zinc-400 mb-1">Color</span>
          <Input
            type="color"
            value={overlay.fontColor}
            onChange={(e) => update({ fontColor: e.target.value })}
            className="h-8 p-0.5 bg-zinc-900 border-zinc-800"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-medium text-zinc-400 mb-1">Background</span>
          <Input
            type="text"
            value={overlay.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="h-8 text-xs bg-zinc-900 border-zinc-800"
            placeholder="rgba(0,0,0,0.5)"
          />
        </label>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
          <Palette className="w-3.5 h-3.5 text-purple-400" />
          Position on canvas
        </div>
        <p className="text-[10px] text-zinc-500 leading-tight">
          Drag the text in the preview to place it precisely. Or pick a quick alignment:
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(['top', 'center', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => update({ position: pos, canvasX: undefined, canvasY: undefined })}
              className={`text-[11px] capitalize py-1.5 rounded border ${
                overlay.position === pos &&
                overlay.canvasX === undefined &&
                overlay.canvasY === undefined
                  ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[10px] font-medium text-zinc-400 mb-1">Start (s)</span>
          <Input
            type="number"
            min={0}
            max={totalDuration}
            step={0.1}
            value={overlay.startTime}
            onChange={(e) =>
              update({ startTime: Math.max(0, Math.min(totalDuration, Number(e.target.value) || 0)) })
            }
            className="h-8 text-xs bg-zinc-900 border-zinc-800"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-medium text-zinc-400 mb-1">End (s)</span>
          <Input
            type="number"
            min={0}
            max={totalDuration}
            step={0.1}
            value={overlay.endTime}
            onChange={(e) =>
              update({
                endTime: Math.max(overlay.startTime + 0.1, Math.min(totalDuration, Number(e.target.value) || 0)),
              })
            }
            className="h-8 text-xs bg-zinc-900 border-zinc-800"
          />
        </label>
      </div>
    </div>
  );
}

function UploadPanel({
  dispatch,
  playheadTime,
  totalDuration,
}: {
  dispatch: React.Dispatch<EditorAction>;
  playheadTime: number;
  totalDuration: number;
}) {
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file (mp4, webm, or mov).');
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const duration = await probeVideoDuration(file);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'video');
        formData.append('category', 'clip');
        formData.append('name', file.name);

        const res = await authFetch('/api/media', {
          method: 'POST',
          body: formData,
        });
        const data = (await res.json()) as MediaUploadResponse;
        if (!res.ok || !data.success || !data.item) {
          throw new Error(data.error ?? 'Upload failed');
        }

        dispatch({
          type: 'ADD_CLIP',
          clip: {
            name: data.item.name,
            url: data.item.url,
            thumbnailUrl: data.item.thumbnailUrl,
            duration,
            source: 'upload',
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [authFetch, dispatch],
  );

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-white">Add media</div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { void handleFile(f); }
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) { void handleFile(f); }
        }}
        disabled={uploading}
        className="w-full p-6 border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-lg flex flex-col items-center gap-2 text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[11px]">Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            <span className="text-[11px]">Drop video or click to upload</span>
            <span className="text-[10px] text-zinc-600">MP4, WebM, MOV up to 100MB</span>
          </>
        )}
      </button>

      {error && (
        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-zinc-800 text-zinc-300 hover:text-white"
          onClick={() => {
            dispatch({
              type: 'ADD_TEXT_OVERLAY',
              overlay: {
                text: 'New text',
                startTime: playheadTime,
                endTime: Math.min(playheadTime + 3, Math.max(totalDuration, 3)),
                position: 'bottom',
                fontSize: 28,
                fontColor: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.5)',
              },
            });
          }}
        >
          <Type className="w-3.5 h-3.5" />
          Add text overlay
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function EffectsPanel({
  clips,
  textOverlays,
  selectedClipId,
  selectedOverlayId,
  playheadTime,
  totalDuration,
  dispatch,
}: EffectsPanelProps) {
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: 'clip'; clipId: string; name: string }
    | { kind: 'overlay'; overlayId: string }
    | null
  >(null);

  const selectedClip = selectedClipId ? clips.find((c) => c.id === selectedClipId) ?? null : null;
  const selectedOverlay = selectedOverlayId
    ? textOverlays.find((o) => o.id === selectedOverlayId) ?? null
    : null;

  const handleConfirmDelete = useCallback(() => {
    if (!confirmTarget) { return; }
    if (confirmTarget.kind === 'clip') {
      dispatch({ type: 'REMOVE_CLIP', clipId: confirmTarget.clipId });
    } else {
      dispatch({ type: 'REMOVE_TEXT_OVERLAY', overlayId: confirmTarget.overlayId });
    }
    setConfirmTarget(null);
  }, [confirmTarget, dispatch]);

  return (
    <aside className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-5 overflow-y-auto">
      {selectedClip ? (
        <ClipPanel
          clip={selectedClip}
          dispatch={dispatch}
          onRequestDelete={() =>
            setConfirmTarget({ kind: 'clip', clipId: selectedClip.id, name: selectedClip.name })
          }
        />
      ) : selectedOverlay ? (
        <OverlayPanel
          overlay={selectedOverlay}
          totalDuration={totalDuration}
          dispatch={dispatch}
          onRequestDelete={() => setConfirmTarget({ kind: 'overlay', overlayId: selectedOverlay.id })}
        />
      ) : (
        <UploadPanel
          dispatch={dispatch}
          playheadTime={playheadTime}
          totalDuration={totalDuration}
        />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        title={confirmTarget?.kind === 'clip' ? 'Delete clip?' : 'Delete text overlay?'}
        description={
          confirmTarget?.kind === 'clip'
            ? `"${confirmTarget.name}" will be removed from the timeline. This can be undone with Ctrl+Z.`
            : 'This text overlay will be removed from the timeline. This can be undone with Ctrl+Z.'
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
      />
    </aside>
  );
}
