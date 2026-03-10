'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Film,
  Music,
  Type,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Trash2,
  GripVertical,
  Pencil,
} from 'lucide-react';
import {
  TRANSITIONS,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_CLIP_DURATION,
  type EditorClip,
  type EditorAudioTrack,
  type TextOverlay,
  type EditorAction,
} from '../types';

// ============================================================================
// Props
// ============================================================================

interface EditorTimelineProps {
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

// ============================================================================
// Helpers
// ============================================================================

const CLIP_SOURCE_COLORS: Record<EditorClip['source'], string> = {
  project: 'bg-amber-700/60 border-amber-500/50',
  library: 'bg-blue-700/60 border-blue-500/50',
  upload: 'bg-green-700/60 border-green-500/50',
  url: 'bg-zinc-700/60 border-zinc-500/50',
};

const CLIP_SOURCE_SELECTED_COLORS: Record<EditorClip['source'], string> = {
  project: 'bg-amber-600/80 border-amber-400',
  library: 'bg-blue-600/80 border-blue-400',
  upload: 'bg-green-600/80 border-green-400',
  url: 'bg-zinc-600/80 border-zinc-400',
};

function getEffectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.5, raw - clip.trimStart - clip.trimEnd);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frac = Math.round((seconds % 1) * 10);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${frac}`;
  }
  return `${secs}.${frac}s`;
}

function formatRulerTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

/** Determine tick interval in seconds based on zoom level */
function getTickInterval(zoom: number): number {
  if (zoom >= 100) { return 1; }
  if (zoom >= 40) { return 5; }
  if (zoom >= 20) { return 10; }
  return 30;
}

function getClipStartTime(clips: EditorClip[], clipIndex: number): number {
  let t = 0;
  for (let i = 0; i < clipIndex; i++) {
    t += getEffectiveDuration(clips[i]);
  }
  return t;
}

// ============================================================================
// Context Menu State
// ============================================================================

interface ContextMenuState {
  x: number;
  y: number;
  clipId: string;
}

// ============================================================================
// Sortable Clip Item
// ============================================================================

interface SortableClipProps {
  clip: EditorClip;
  clipIndex: number;
  clips: EditorClip[];
  isSelected: boolean;
  zoomLevel: number;
  editingClipId: string | null;
  editingName: string;
  onSelect: (clipId: string) => void;
  onDoubleClick: (clipId: string, currentName: string) => void;
  onContextMenu: (e: React.MouseEvent, clipId: string) => void;
  onEditNameChange: (value: string) => void;
  onEditNameCommit: () => void;
  onEditNameCancel: () => void;
  onTransitionClick: (clipId: string) => void;
}

function SortableClipItem({
  clip,
  clipIndex,
  clips,
  isSelected,
  zoomLevel,
  editingClipId,
  editingName,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onEditNameChange,
  onEditNameCommit,
  onEditNameCancel,
  onTransitionClick,
}: SortableClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: Math.max(40, getEffectiveDuration(clip) * zoomLevel),
    opacity: isDragging ? 0.5 : 1,
  };

  const colorClasses = isSelected
    ? CLIP_SOURCE_SELECTED_COLORS[clip.source]
    : CLIP_SOURCE_COLORS[clip.source];

  const isEditing = editingClipId === clip.id;
  const showTransition = clipIndex < clips.length - 1;

  return (
    <div className="flex items-stretch flex-shrink-0" style={{ height: '100%' }}>
      <div
        ref={setNodeRef}
        style={style}
        className={`
          relative flex flex-col justify-between
          border rounded
          cursor-pointer select-none
          transition-colors duration-100
          ${colorClasses}
          ${isSelected ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-zinc-900' : ''}
          ${isDragging ? 'z-50' : 'z-0'}
        `}
        onClick={() => { onSelect(clip.id); }}
        onDoubleClick={() => { onDoubleClick(clip.id, clip.name); }}
        onContextMenu={(e) => { onContextMenu(e, clip.id); }}
      >
        {/* Drag handle */}
        <div
          className="absolute top-0.5 left-0.5 text-white/40 hover:text-white/80 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={12} />
        </div>

        {/* Clip name */}
        <div className="px-3 pt-1 overflow-hidden">
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => { onEditNameChange(e.target.value); }}
              onBlur={onEditNameCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onEditNameCommit(); }
                if (e.key === 'Escape') { onEditNameCancel(); }
              }}
              className="w-full bg-zinc-800 text-white text-[10px] px-1 py-0 rounded border border-zinc-600 outline-none focus:border-amber-400"
              autoFocus
              onClick={(e) => { e.stopPropagation(); }}
              onDoubleClick={(e) => { e.stopPropagation(); }}
            />
          ) : (
            <span className="text-[10px] text-white/90 truncate block leading-tight">
              {clip.name}
            </span>
          )}
        </div>

        {/* Duration + source badge */}
        <div className="flex items-center justify-between px-1 pb-0.5">
          <span className="text-[9px] text-white/50">
            {formatTime(getEffectiveDuration(clip))}
          </span>
          <span className="text-[8px] text-white/40 uppercase tracking-wider">
            {clip.source}
          </span>
        </div>

        {/* Film icon overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
          <Film size={20} />
        </div>
      </div>

      {/* Transition indicator between clips */}
      {showTransition && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTransitionClick(clip.id);
          }}
          className="flex items-center justify-center w-5 flex-shrink-0 group hover:bg-zinc-700/50 transition-colors rounded"
          title={`Transition: ${clip.transitionType} (click to change)`}
        >
          <span className="text-[10px] text-zinc-500 group-hover:text-amber-400 transition-colors">
            {TRANSITIONS.find((t) => t.value === clip.transitionType)?.icon ?? '|'}
          </span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Time Ruler
// ============================================================================

interface TimeRulerProps {
  totalDuration: number;
  zoomLevel: number;
  leftPadding: number;
}

function TimeRuler({ totalDuration, zoomLevel, leftPadding }: TimeRulerProps) {
  const interval = getTickInterval(zoomLevel);
  const displayDuration = Math.max(totalDuration, 10);
  const totalWidth = displayDuration * zoomLevel;
  const ticks: { position: number; label: string; isMajor: boolean }[] = [];

  for (let t = 0; t <= displayDuration; t += interval) {
    ticks.push({
      position: t * zoomLevel + leftPadding,
      label: formatRulerTime(t),
      isMajor: true,
    });

    // Add minor ticks at half intervals for larger zoom
    if (zoomLevel >= 40 && interval <= 5) {
      const halfT = t + interval / 2;
      if (halfT < displayDuration) {
        ticks.push({
          position: halfT * zoomLevel + leftPadding,
          label: '',
          isMajor: false,
        });
      }
    }
  }

  return (
    <div
      className="relative h-5 bg-zinc-800/80 border-b border-zinc-700 flex-shrink-0"
      style={{ width: totalWidth + leftPadding + 100 }}
    >
      {ticks.map((tick, i) => (
        <div
          key={`tick-${i}`}
          className="absolute top-0"
          style={{ left: tick.position }}
        >
          <div
            className={`${tick.isMajor ? 'h-3 bg-zinc-500' : 'h-2 bg-zinc-600'}`}
            style={{ width: 1 }}
          />
          {tick.isMajor && tick.label && (
            <span className="absolute top-[2px] left-1 text-[9px] text-zinc-400 whitespace-nowrap select-none">
              {tick.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Playhead Component
// ============================================================================

interface PlayheadProps {
  playheadTime: number;
  totalDuration: number;
  zoomLevel: number;
  leftPadding: number;
  containerHeight: number;
  onDrag: (newTime: number) => void;
}

function Playhead({
  playheadTime,
  totalDuration,
  zoomLevel,
  leftPadding,
  containerHeight,
  onDrag,
}: PlayheadProps) {
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) { return; }
      const parent = containerRef.current?.parentElement;
      if (!parent) { return; }
      const scrollContainer = parent.closest('[data-timeline-scroll]');
      if (!scrollContainer) { return; }
      const rect = scrollContainer.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft - leftPadding;
      const newTime = Math.max(0, Math.min(totalDuration, x / zoomLevel));
      onDrag(newTime);
    },
    [totalDuration, zoomLevel, leftPadding, onDrag],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [],
  );

  const posX = playheadTime * zoomLevel + leftPadding;

  return (
    <div
      ref={containerRef}
      className="absolute top-0 z-40 pointer-events-none"
      style={{ left: posX, height: containerHeight }}
    >
      {/* Handle / head triangle */}
      <div
        className="pointer-events-auto cursor-col-resize flex justify-center -translate-x-1/2"
        style={{ width: 14 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #f59e0b',
          }}
        />
      </div>
      {/* Vertical line */}
      <div
        className="mx-auto bg-amber-500"
        style={{ width: 1.5, height: containerHeight - 8, marginTop: -1 }}
      />
    </div>
  );
}

// ============================================================================
// Audio Track Lane
// ============================================================================

interface AudioTrackLaneProps {
  track: EditorAudioTrack;
  totalDuration: number;
  zoomLevel: number;
  leftPadding: number;
  dispatch: React.Dispatch<EditorAction>;
}

function AudioTrackLane({
  track,
  totalDuration,
  zoomLevel,
  leftPadding,
  dispatch,
}: AudioTrackLaneProps) {
  const displayDuration = Math.max(totalDuration, 10);
  const width = displayDuration * zoomLevel;

  const categoryColors: Record<string, string> = {
    music: 'bg-purple-700/50 border-purple-400/40',
    sound: 'bg-pink-700/50 border-pink-400/40',
    voice: 'bg-indigo-700/50 border-indigo-400/40',
  };

  return (
    <div className="flex items-center gap-1" style={{ paddingLeft: leftPadding }}>
      <div
        className={`
          relative h-8 rounded border flex items-center px-2 gap-1
          ${categoryColors[track.category] || 'bg-purple-700/50 border-purple-400/40'}
        `}
        style={{ width: Math.max(80, width) }}
      >
        <Music size={10} className="text-purple-300 flex-shrink-0" />
        <span className="text-[10px] text-purple-200 truncate">{track.name}</span>
        <span className="text-[8px] text-purple-300/60 flex-shrink-0 ml-auto">
          {Math.round(track.volume * 100)}%
        </span>
        <button
          type="button"
          onClick={() => { dispatch({ type: 'REMOVE_AUDIO_TRACK', trackId: track.id }); }}
          className="text-purple-300/40 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
          title="Remove audio track"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Text Overlay Lane
// ============================================================================

interface TextOverlayLaneProps {
  overlays: TextOverlay[];
  selectedOverlayId: string | null;
  totalDuration: number;
  zoomLevel: number;
  leftPadding: number;
  dispatch: React.Dispatch<EditorAction>;
}

function TextOverlayLane({
  overlays,
  selectedOverlayId,
  totalDuration,
  zoomLevel,
  leftPadding,
  dispatch,
}: TextOverlayLaneProps) {
  const displayDuration = Math.max(totalDuration, 10);
  const totalWidth = displayDuration * zoomLevel;

  if (overlays.length === 0) {
    return null;
  }

  return (
    <div className="relative h-8" style={{ width: totalWidth + leftPadding + 100 }}>
      {overlays.map((overlay) => {
        const left = overlay.startTime * zoomLevel + leftPadding;
        const width = Math.max(20, (overlay.endTime - overlay.startTime) * zoomLevel);
        const isSelected = selectedOverlayId === overlay.id;
        return (
          <div
            key={overlay.id}
            className={`
              absolute top-0 h-full rounded border flex items-center px-1.5 gap-1 cursor-pointer
              ${isSelected
                ? 'bg-blue-600/70 border-blue-400 ring-1 ring-blue-400'
                : 'bg-blue-800/40 border-blue-500/30 hover:border-blue-400/60'}
            `}
            style={{ left, width }}
            onClick={() => { dispatch({ type: 'SELECT_OVERLAY', overlayId: overlay.id }); }}
          >
            <Type size={10} className="text-blue-300 flex-shrink-0" />
            <span className="text-[9px] text-blue-200 truncate">
              {overlay.text || 'Text'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'REMOVE_TEXT_OVERLAY', overlayId: overlay.id });
              }}
              className="text-blue-300/40 hover:text-red-400 transition-colors flex-shrink-0 ml-auto"
              title="Remove text overlay"
            >
              <Trash2 size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main EditorTimeline Component
// ============================================================================

export function EditorTimeline({
  clips,
  audioTracks,
  textOverlays,
  selectedClipId,
  selectedOverlayId,
  playheadTime,
  totalDuration,
  zoomLevel,
  dispatch,
}: EditorTimelineProps) {
  // ── Local State ────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);

  const LEFT_PADDING = 8;

  // ── DnD Sensors ────────────────────────────────────────────────────────
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // ── Computed Values ────────────────────────────────────────────────────
  const displayDuration = Math.max(totalDuration, 10);
  const totalWidth = displayDuration * zoomLevel + LEFT_PADDING + 100;

  const containerHeight = useMemo(() => {
    // Ruler (20) + video lane (44) + audio lanes + text lane + padding
    const audioHeight = audioTracks.length > 0 ? 12 + audioTracks.length * 36 : 0;
    const textHeight = textOverlays.length > 0 ? 12 + 36 : 0;
    return 20 + 44 + audioHeight + textHeight + 16;
  }, [audioTracks.length, textOverlays.length]);

  // ── Clip IDs for DnD ───────────────────────────────────────────────────
  const clipIds = useMemo(() => clips.map((c) => c.id), [clips]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) { return; }

      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) { return; }

      const reordered = [...clips.map((c) => c.id)];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, active.id as string);
      dispatch({ type: 'REORDER_CLIPS', clipIds: reordered });
    },
    [clips, dispatch],
  );

  const handleSelectClip = useCallback(
    (clipId: string) => {
      dispatch({ type: 'SELECT_CLIP', clipId });
    },
    [dispatch],
  );

  const handleDoubleClickClip = useCallback(
    (clipId: string, currentName: string) => {
      setEditingClipId(clipId);
      setEditingName(currentName);
    },
    [],
  );

  const handleEditNameCommit = useCallback(() => {
    if (editingClipId && editingName.trim()) {
      dispatch({
        type: 'UPDATE_CLIP',
        clipId: editingClipId,
        updates: { name: editingName.trim() },
      });
    }
    setEditingClipId(null);
    setEditingName('');
  }, [editingClipId, editingName, dispatch]);

  const handleEditNameCancel = useCallback(() => {
    setEditingClipId(null);
    setEditingName('');
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, clipId: string) => {
      e.preventDefault();
      dispatch({ type: 'SELECT_CLIP', clipId });
      setContextMenu({ x: e.clientX, y: e.clientY, clipId });
    },
    [dispatch],
  );

  const handleTransitionClick = useCallback(
    (clipId: string) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) { return; }
      const currentIndex = TRANSITIONS.findIndex((t) => t.value === clip.transitionType);
      const nextIndex = (currentIndex + 1) % TRANSITIONS.length;
      dispatch({
        type: 'SET_CLIP_TRANSITION',
        clipId,
        transition: TRANSITIONS[nextIndex].value,
      });
    },
    [clips, dispatch],
  );

  const handlePlayheadDrag = useCallback(
    (newTime: number) => {
      dispatch({ type: 'SET_PLAYHEAD', time: newTime });
    },
    [dispatch],
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      // Only respond to clicks on the background (not on clips)
      if (e.target !== e.currentTarget) { return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current?.scrollLeft ?? 0;
      const x = e.clientX - rect.left + scrollLeft - LEFT_PADDING;
      const newTime = Math.max(0, Math.min(totalDuration, x / zoomLevel));
      dispatch({ type: 'SET_PLAYHEAD', time: newTime });
    },
    [totalDuration, zoomLevel, dispatch],
  );

  // Context menu actions
  const handleDuplicate = useCallback(() => {
    if (contextMenu) {
      dispatch({ type: 'DUPLICATE_CLIP', clipId: contextMenu.clipId });
    }
    setContextMenu(null);
  }, [contextMenu, dispatch]);

  const handleSplitAtPlayhead = useCallback(() => {
    if (!contextMenu) { return; }
    const clipIndex = clips.findIndex((c) => c.id === contextMenu.clipId);
    if (clipIndex === -1) {
      setContextMenu(null);
      return;
    }
    const clipStart = getClipStartTime(clips, clipIndex);
    const splitTime = playheadTime - clipStart;
    if (splitTime > 0 && splitTime < getEffectiveDuration(clips[clipIndex])) {
      dispatch({ type: 'SPLIT_CLIP', clipId: contextMenu.clipId, splitTime });
    }
    setContextMenu(null);
  }, [contextMenu, clips, playheadTime, dispatch]);

  const handleRemove = useCallback(() => {
    if (contextMenu) {
      dispatch({ type: 'REMOVE_CLIP', clipId: contextMenu.clipId });
    }
    setContextMenu(null);
  }, [contextMenu, dispatch]);

  const handleRenameFromMenu = useCallback(() => {
    if (contextMenu) {
      const clip = clips.find((c) => c.id === contextMenu.clipId);
      if (clip) {
        setEditingClipId(clip.id);
        setEditingName(clip.name);
      }
    }
    setContextMenu(null);
  }, [contextMenu, clips]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    const next = Math.min(MAX_ZOOM, zoomLevel + 10);
    dispatch({ type: 'SET_ZOOM', level: next });
  }, [zoomLevel, dispatch]);

  const handleZoomOut = useCallback(() => {
    const next = Math.max(MIN_ZOOM, zoomLevel - 10);
    dispatch({ type: 'SET_ZOOM', level: next });
  }, [zoomLevel, dispatch]);

  const handleZoomSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_ZOOM', level: Number(e.target.value) });
    },
    [dispatch],
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) { return; }
    const handleClick = () => { setContextMenu(null); };
    window.addEventListener('click', handleClick);
    return () => { window.removeEventListener('click', handleClick); };
  }, [contextMenu]);

  // ── Render ─────────────────────────────────────────────────────────────

  const isEmpty = clips.length === 0 && audioTracks.length === 0 && textOverlays.length === 0;

  return (
    <div className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/60 border-b border-zinc-700">
        {/* Lane labels */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Film size={12} className="text-amber-400" />
            <span>Video</span>
            <span className="text-zinc-600">({clips.length})</span>
          </div>
          {audioTracks.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Music size={12} className="text-purple-400" />
              <span>Audio</span>
              <span className="text-zinc-600">({audioTracks.length})</span>
            </div>
          )}
          {textOverlays.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Type size={12} className="text-blue-400" />
              <span>Text</span>
              <span className="text-zinc-600">({textOverlays.length})</span>
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">{formatTime(playheadTime)}</span>
          <span className="text-[10px] text-zinc-600">/</span>
          <span className="text-[10px] text-zinc-500">{formatTime(totalDuration)}</span>
          <div className="w-px h-3 bg-zinc-700 mx-1" />
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= MIN_ZOOM}
            className="p-0.5 text-zinc-400 hover:text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            value={zoomLevel}
            onChange={handleZoomSlider}
            className="w-20 h-1 accent-amber-500 cursor-pointer"
            title={`Zoom: ${zoomLevel}px/s`}
          />
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= MAX_ZOOM}
            className="p-0.5 text-zinc-400 hover:text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <span className="text-[9px] text-zinc-500 w-10 text-right">{zoomLevel}px/s</span>
        </div>
      </div>

      {/* ── Timeline Body ────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex items-center justify-center min-h-[120px] border-2 border-dashed border-zinc-700 rounded m-2">
          <div className="text-center">
            <Film size={24} className="mx-auto mb-1 text-zinc-600" />
            <p className="text-xs text-zinc-500">Drag clips here to build your timeline</p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          data-timeline-scroll
          className="overflow-x-auto overflow-y-hidden"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#52525b #27272a',
          }}
        >
          <div
            ref={timelineBodyRef}
            className="relative"
            style={{ width: totalWidth, minHeight: containerHeight }}
          >
            {/* ── Time Ruler ──────────────────────────────────────────── */}
            <TimeRuler
              totalDuration={displayDuration}
              zoomLevel={zoomLevel}
              leftPadding={LEFT_PADDING}
            />

            {/* ── Video Clip Lane ─────────────────────────────────────── */}
            <div
              className="relative px-1 py-1 min-h-[44px] flex items-center"
              onClick={handleTimelineClick}
            >
              <div className="flex items-stretch h-10" style={{ paddingLeft: LEFT_PADDING }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={clipIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {clips.map((clip, idx) => (
                      <SortableClipItem
                        key={clip.id}
                        clip={clip}
                        clipIndex={idx}
                        clips={clips}
                        isSelected={selectedClipId === clip.id}
                        zoomLevel={zoomLevel}
                        editingClipId={editingClipId}
                        editingName={editingName}
                        onSelect={handleSelectClip}
                        onDoubleClick={handleDoubleClickClip}
                        onContextMenu={handleContextMenu}
                        onEditNameChange={setEditingName}
                        onEditNameCommit={handleEditNameCommit}
                        onEditNameCancel={handleEditNameCancel}
                        onTransitionClick={handleTransitionClick}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            {/* ── Audio Lane(s) ───────────────────────────────────────── */}
            {audioTracks.length > 0 && (
              <div className="border-t border-zinc-800">
                <div className="flex items-center gap-1 px-2 py-0.5">
                  <Music size={10} className="text-purple-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Audio</span>
                </div>
                <div className="flex flex-col gap-1 px-1 pb-1">
                  {audioTracks.map((track) => (
                    <AudioTrackLane
                      key={track.id}
                      track={track}
                      totalDuration={totalDuration}
                      zoomLevel={zoomLevel}
                      leftPadding={LEFT_PADDING}
                      dispatch={dispatch}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Text Overlay Lane ───────────────────────────────────── */}
            {textOverlays.length > 0 && (
              <div className="border-t border-zinc-800">
                <div className="flex items-center gap-1 px-2 py-0.5">
                  <Type size={10} className="text-blue-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Text</span>
                </div>
                <div className="px-1 pb-1">
                  <TextOverlayLane
                    overlays={textOverlays}
                    selectedOverlayId={selectedOverlayId}
                    totalDuration={totalDuration}
                    zoomLevel={zoomLevel}
                    leftPadding={LEFT_PADDING}
                    dispatch={dispatch}
                  />
                </div>
              </div>
            )}

            {/* ── Playhead (spans all lanes) ──────────────────────────── */}
            <Playhead
              playheadTime={playheadTime}
              totalDuration={totalDuration}
              zoomLevel={zoomLevel}
              leftPadding={LEFT_PADDING}
              containerHeight={containerHeight}
              onDrag={handlePlayheadDrag}
            />
          </div>
        </div>
      )}

      {/* ── Context Menu ─────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <button
            type="button"
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors text-left"
          >
            <Copy size={12} className="text-zinc-400" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleSplitAtPlayhead}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors text-left"
          >
            <Scissors size={12} className="text-zinc-400" />
            Split at Playhead
          </button>
          <button
            type="button"
            onClick={handleRenameFromMenu}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors text-left"
          >
            <Pencil size={12} className="text-zinc-400" />
            Rename
          </button>
          <div className="h-px bg-zinc-700 my-0.5" />
          <button
            type="button"
            onClick={handleRemove}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 transition-colors text-left"
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
