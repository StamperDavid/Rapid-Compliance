'use client';

/**
 * ClipBlock — a single clip rendered on the timeline strip.
 * Supports drag-reorder (via @dnd-kit/sortable), edge-drag-to-trim handles,
 * and click-to-select. The drag handle is the body of the block; the trim
 * handles are pointer regions at the left and right edges that intercept
 * pointer events so they don't trigger the sortable drag.
 */

import { useCallback, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Film } from 'lucide-react';

import {
  DEFAULT_CLIP_DURATION,
  type EditorClip,
  type EditorAction,
} from '@/app/(dashboard)/content/video/editor/types';

interface ClipBlockProps {
  clip: EditorClip;
  isSelected: boolean;
  zoomLevel: number; // pixels per second
  dispatch: React.Dispatch<EditorAction>;
}

const CLIP_COLORS: Record<EditorClip['source'], string> = {
  upload: 'from-emerald-700/80 to-emerald-900/80 border-emerald-500/40',
  library: 'from-sky-700/80 to-sky-900/80 border-sky-500/40',
  project: 'from-amber-700/80 to-amber-900/80 border-amber-500/40',
  url: 'from-zinc-700/80 to-zinc-900/80 border-zinc-500/40',
};

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
}

export default function ClipBlock({
  clip,
  isSelected,
  zoomLevel,
  dispatch,
}: ClipBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const trimDragRef = useRef<{ side: 'start' | 'end'; startX: number; startTrim: number } | null>(null);

  const widthPx = Math.max(40, effectiveDuration(clip) * zoomLevel);

  const startTrim = useCallback(
    (side: 'start' | 'end', e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      trimDragRef.current = {
        side,
        startX: e.clientX,
        startTrim: side === 'start' ? clip.trimStart : clip.trimEnd,
      };

      const move = (ev: PointerEvent) => {
        const drag = trimDragRef.current;
        if (!drag) { return; }
        const dxPx = ev.clientX - drag.startX;
        const dxSec = dxPx / zoomLevel;
        const rawDur = clip.duration || DEFAULT_CLIP_DURATION;
        // Cap the trim so the clip remains at least 0.5s long
        const otherTrim = drag.side === 'start' ? clip.trimEnd : clip.trimStart;
        const maxTrim = Math.max(0, rawDur - otherTrim - 0.5);
        const next = Math.min(maxTrim, Math.max(0, drag.startTrim + dxSec));
        dispatch({
          type: 'UPDATE_CLIP',
          clipId: clip.id,
          updates: drag.side === 'start' ? { trimStart: next } : { trimEnd: next },
        });
      };
      const up = () => {
        trimDragRef.current = null;
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    },
    [clip, dispatch, zoomLevel],
  );

  const colorGradient = CLIP_COLORS[clip.source];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        width: widthPx,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={`relative flex-shrink-0 h-14 rounded-md border bg-gradient-to-b ${colorGradient} ${
        isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-950' : ''
      } ${isDragging ? 'z-50 shadow-2xl' : 'z-0'}`}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'SELECT_CLIP', clipId: clip.id });
      }}
    >
      {/* Body: drag handle for reorder */}
      <div
        className="absolute inset-x-3 inset-y-0 cursor-grab active:cursor-grabbing flex flex-col justify-between py-1 px-1 select-none"
        {...attributes}
        {...listeners}
      >
        <span className="text-[10px] font-medium text-white/95 truncate leading-tight">
          {clip.name}
        </span>
        <div className="flex items-center justify-between text-[9px] text-white/70 leading-none">
          <span className="tabular-nums">{effectiveDuration(clip).toFixed(1)}s</span>
          <span className="uppercase tracking-wider opacity-60">{clip.source}</span>
        </div>

        {/* Faint film icon background */}
        <Film className="absolute inset-0 m-auto w-6 h-6 text-white/10 pointer-events-none" />
      </div>

      {/* Left trim handle */}
      <div
        role="slider"
        aria-label="Trim start"
        aria-valuenow={clip.trimStart}
        tabIndex={-1}
        onPointerDown={(e) => startTrim('start', e)}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 active:bg-amber-400/50 rounded-l-md flex items-center justify-center"
        title="Drag to trim start"
      >
        <span className="block w-0.5 h-6 bg-white/40 rounded" />
      </div>

      {/* Right trim handle */}
      <div
        role="slider"
        aria-label="Trim end"
        aria-valuenow={clip.trimEnd}
        tabIndex={-1}
        onPointerDown={(e) => startTrim('end', e)}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 active:bg-amber-400/50 rounded-r-md flex items-center justify-center"
        title="Drag to trim end"
      >
        <span className="block w-0.5 h-6 bg-white/40 rounded" />
      </div>
    </div>
  );
}
