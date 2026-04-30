'use client';

/**
 * Timeline — multi-track horizontal editor with scrubbable playhead.
 *
 *   ┌──── ruler (seconds) ──────────────┐
 *   │ V  ▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢ │
 *   │ T   ▢ABC▢▢▢▢▢▢▢▢▢▢▢▢▢DEF▢▢▢▢▢▢ │
 *   │ A  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 *   └────────────────────────────────────┘
 *        ↑ playhead (red bar, draggable)
 *
 * V = video track (clips, drag-reorder + edge-trim).
 * T = text-overlay track (read-only blocks, click to select).
 * A = audio track placeholder (v1 visual only — render path is wired in
 *     editor-reducer for adding/removing tracks but the YC-demo scope is
 *     "visible audio strip", not waveform).
 */

import { useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Music, Type } from 'lucide-react';

import {
  DEFAULT_CLIP_DURATION,
  type EditorClip,
  type EditorAudioTrack,
  type TextOverlay,
  type EditorAction,
} from '@/app/(dashboard)/content/video/editor/types';
import ClipBlock from './ClipBlock';

interface TimelineProps {
  clips: EditorClip[];
  audioTracks: EditorAudioTrack[];
  textOverlays: TextOverlay[];
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  playheadTime: number;
  totalDuration: number;
  zoomLevel: number;
  dispatch: React.Dispatch<EditorAction>;
}

const TRACK_LABEL_WIDTH = 56; // px reserved for the V/T/A label column
const RULER_HEIGHT = 24;

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
}

/** Cumulative clip-start time for ruler-aligned overlay positioning. */
function clipStartTimes(clips: EditorClip[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const clip of clips) {
    out.push(t);
    t += effectiveDuration(clip);
  }
  return out;
}

function tickInterval(zoomLevel: number): number {
  if (zoomLevel >= 80) { return 1; }
  if (zoomLevel >= 30) { return 5; }
  if (zoomLevel >= 15) { return 10; }
  return 30;
}

function formatRuler(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) { return `${m}:${String(s).padStart(2, '0')}`; }
  return `${s}s`;
}

export default function Timeline({
  clips,
  audioTracks,
  textOverlays,
  selectedClipId,
  selectedOverlayId,
  playheadTime,
  totalDuration,
  zoomLevel,
  dispatch,
}: TimelineProps) {
  const trackBodyRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) { return; }
      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) { return; }
      const reordered = [...clips];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      dispatch({ type: 'REORDER_CLIPS', clipIds: reordered.map((c) => c.id) });
    },
    [clips, dispatch],
  );

  // Width of the timeline content area in px (>= the visible row width)
  const totalWidthPx = Math.max(
    600,
    Math.ceil(Math.max(totalDuration, 10) * zoomLevel) + 40,
  );

  // Click/drag on the ruler scrubs the playhead.
  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const rect = target.getBoundingClientRect();
      const seekTo = (clientX: number) => {
        const x = Math.max(0, clientX - rect.left);
        const t = Math.min(totalDuration, x / zoomLevel);
        dispatch({ type: 'SET_PLAYHEAD', time: t });
      };
      seekTo(e.clientX);
      const move = (ev: PointerEvent) => seekTo(ev.clientX);
      const up = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    },
    [dispatch, totalDuration, zoomLevel],
  );

  const ticks = useMemo(() => {
    const interval = tickInterval(zoomLevel);
    const span = Math.max(totalDuration + interval, 10);
    const out: number[] = [];
    for (let t = 0; t <= span; t += interval) {
      out.push(t);
    }
    return out;
  }, [zoomLevel, totalDuration]);

  const startTimes = useMemo(() => clipStartTimes(clips), [clips]);

  const playheadPx = playheadTime * zoomLevel;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex">
        {/* ── Track label gutter ──────────────────────────────────────── */}
        <div
          className="flex-shrink-0 bg-zinc-900 border-r border-zinc-800"
          style={{ width: TRACK_LABEL_WIDTH }}
        >
          <div className="h-6 border-b border-zinc-800" />
          <div className="h-14 flex items-center justify-center text-[10px] font-semibold text-zinc-500 border-b border-zinc-800">
            V
          </div>
          <div className="h-7 flex items-center justify-center text-[10px] font-semibold text-zinc-500 border-b border-zinc-800">
            <Type className="w-3 h-3" />
          </div>
          <div className="h-7 flex items-center justify-center text-[10px] font-semibold text-zinc-500">
            <Music className="w-3 h-3" />
          </div>
        </div>

        {/* ── Scrolling content area ─────────────────────────────────── */}
        <div className="flex-1 overflow-x-auto" ref={trackBodyRef}>
          <div style={{ width: totalWidthPx, position: 'relative' }}>
            {/* Ruler */}
            <div
              role="slider"
              aria-label="Scrub timeline"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalDuration)}
              aria-valuenow={Math.round(playheadTime)}
              tabIndex={0}
              onPointerDown={onRulerPointerDown}
              className="relative bg-zinc-900 border-b border-zinc-800 cursor-pointer select-none"
              style={{ height: RULER_HEIGHT }}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 border-l border-zinc-700/60"
                  style={{ left: t * zoomLevel }}
                >
                  <span className="absolute top-1 left-1 text-[9px] text-zinc-500 tabular-nums">
                    {formatRuler(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* Video track */}
            <div
              className="relative bg-zinc-900/40 border-b border-zinc-800"
              style={{ height: 56 }}
              onClick={() => dispatch({ type: 'SELECT_CLIP', clipId: null })}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={clips.map((c) => c.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex items-center gap-0.5 h-full px-1">
                    {clips.map((clip) => (
                      <ClipBlock
                        key={clip.id}
                        clip={clip}
                        isSelected={selectedClipId === clip.id}
                        zoomLevel={zoomLevel}
                        dispatch={dispatch}
                      />
                    ))}
                    {clips.length === 0 && (
                      <span className="text-[10px] text-zinc-600 ml-2">
                        No clips on the timeline yet
                      </span>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Text overlay track */}
            <div
              className="relative bg-zinc-900/40 border-b border-zinc-800"
              style={{ height: 28 }}
              onClick={() => dispatch({ type: 'SELECT_OVERLAY', overlayId: null })}
            >
              {textOverlays.map((overlay) => {
                const left = overlay.startTime * zoomLevel;
                const width = Math.max(
                  20,
                  (overlay.endTime - overlay.startTime) * zoomLevel,
                );
                const isSelected = selectedOverlayId === overlay.id;
                return (
                  <button
                    key={overlay.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'SELECT_OVERLAY', overlayId: overlay.id });
                    }}
                    className={`absolute top-1 bottom-1 px-1.5 rounded text-[9px] truncate text-left text-white bg-purple-700/70 border border-purple-500/40 hover:bg-purple-600/80 ${
                      isSelected ? 'ring-2 ring-amber-400' : ''
                    }`}
                    style={{ left, width }}
                    title={overlay.text}
                  >
                    {overlay.text || 'Text'}
                  </button>
                );
              })}
              {/* Decorative aligned-to-clip-start markers (helpful when text
                   was added at the playhead while a specific clip was active) */}
              {clips.length > 0 && startTimes.map((t, i) => (
                <div
                  key={`m-${i}`}
                  className="absolute top-0 bottom-0 w-px bg-zinc-700/40 pointer-events-none"
                  style={{ left: t * zoomLevel }}
                />
              ))}
            </div>

            {/* Audio track placeholder */}
            <div
              className="relative bg-zinc-900/40"
              style={{ height: 28 }}
            >
              {audioTracks.length === 0 ? (
                <span className="absolute top-1.5 left-2 text-[9px] text-zinc-600">
                  Audio track (drop audio here from the right panel)
                </span>
              ) : (
                audioTracks.map((track, i) => (
                  <div
                    key={track.id}
                    className="absolute top-1 bottom-1 left-1 right-1 bg-emerald-700/40 border border-emerald-500/30 rounded text-[9px] text-emerald-200 px-2 flex items-center"
                    style={{ top: 4 + i * 2, opacity: 0.9 }}
                  >
                    <Music className="w-3 h-3 mr-1.5" />
                    <span className="truncate">{track.name}</span>
                  </div>
                ))
              )}
            </div>

            {/* Playhead — spans the full content height */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none z-30"
              style={{ left: playheadPx }}
            >
              <div className="absolute -top-0.5 -translate-x-1/2 w-3 h-3 rotate-45 bg-amber-400 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
