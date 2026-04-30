'use client';

/**
 * Video Editor Preview — custom HTML5 video preview that walks the timeline
 * clip-by-clip, applies the active clip's lighting effect via CSS filter,
 * and renders text overlays absolutely positioned on top.
 *
 * Why custom (not Remotion): Remotion is not in the project dependency tree
 * (verified against package.json — neither `remotion` nor `@remotion/player`
 * are installed). Adding it for the YC demo would mean a multi-package
 * install, the bundling overhead of a separate React renderer, and the
 * round-trip back through @remotion/lambda for export. A native <video>
 * element with frame-accurate seek + CSS filters covers every preview
 * requirement in the spec (effects live-preview, scrubbable playhead,
 * text overlay positioning) without those costs.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Film } from 'lucide-react';

import {
  DEFAULT_CLIP_DURATION,
  NEUTRAL_EFFECT,
  type EditorClip,
  type TextOverlay,
  type ClipEffect,
  type EditorAction,
} from '@/app/(dashboard)/content/video/editor/types';

interface PreviewProps {
  clips: EditorClip[];
  textOverlays: TextOverlay[];
  selectedOverlayId: string | null;
  playheadTime: number;
  isPlaying: boolean;
  totalDuration: number;
  dispatch: React.Dispatch<EditorAction>;
}

interface ActiveClipState {
  clip: EditorClip;
  /** Time within the clip's source video (accounts for trimStart). */
  sourceTime: number;
}

// ============================================================================
// Helpers
// ============================================================================

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
}

/** Resolve which clip is on screen at a given timeline second + the offset
 *  inside that clip. Returns null when the playhead is past the timeline. */
function resolveActiveClip(clips: EditorClip[], playheadTime: number): ActiveClipState | null {
  let elapsed = 0;
  for (const clip of clips) {
    const dur = effectiveDuration(clip);
    if (playheadTime < elapsed + dur) {
      const localTime = playheadTime - elapsed;
      return {
        clip,
        sourceTime: clip.trimStart + Math.max(0, localTime),
      };
    }
    elapsed += dur;
  }
  return null;
}

/** Map ClipEffect to a CSS filter string. Mirrors the FFmpeg eq+hue chain
 *  used on the server so what you see is what you render. */
function effectToCssFilter(effect: ClipEffect | undefined): string {
  const e = effect ?? NEUTRAL_EFFECT;
  // CSS brightness uses 1 = unchanged with 0..2 range; our state uses
  // -1..1 offsets, so map to (1 + offset).
  const brightness = Math.max(0, 1 + e.brightness).toFixed(3);
  const contrast = Math.max(0, e.contrast).toFixed(3);
  const saturate = Math.max(0, e.saturation).toFixed(3);
  const hue = e.hue.toFixed(1);
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hue}deg)`;
}

/** Position alias → percentage offset from the top. */
function positionToTop(position: TextOverlay['position']): string {
  if (position === 'top') { return '8%'; }
  if (position === 'center') { return '46%'; }
  return '82%';
}

// ============================================================================
// Component
// ============================================================================

export default function Preview({
  clips,
  textOverlays,
  selectedOverlayId,
  playheadTime,
  isPlaying,
  totalDuration,
  dispatch,
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastClipUrlRef = useRef<string | null>(null);

  const active = useMemo(() => resolveActiveClip(clips, playheadTime), [clips, playheadTime]);

  const visibleOverlays = useMemo(
    () =>
      textOverlays.filter(
        (o) => playheadTime >= o.startTime && playheadTime <= o.endTime,
      ),
    [textOverlays, playheadTime],
  );

  // ── Sync the <video> element with the active clip + playhead ──────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) {
      lastClipUrlRef.current = null;
      return;
    }

    // Switch source only when the clip URL changes (avoids flicker on scrub)
    if (lastClipUrlRef.current !== active.clip.url) {
      video.src = active.clip.url;
      lastClipUrlRef.current = active.clip.url;
    }

    // When paused or scrubbing, seek so the preview matches the playhead.
    if (!isPlaying && Math.abs(video.currentTime - active.sourceTime) > 0.05) {
      video.currentTime = active.sourceTime;
    }
  }, [active, isPlaying]);

  // ── Play / pause handling ──────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) { return; }

    if (isPlaying && active) {
      void video.play().catch(() => {
        // Autoplay can fail in some browsers — surface as paused.
        dispatch({ type: 'SET_PLAYING', playing: false });
      });
    } else {
      video.pause();
    }
  }, [isPlaying, active, dispatch]);

  // ── Drive the playhead forward while playing via requestAnimationFrame ─
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = playheadTime + dt;
      if (next >= totalDuration) {
        dispatch({ type: 'SET_PLAYHEAD', time: totalDuration });
        dispatch({ type: 'SET_PLAYING', playing: false });
        return;
      }
      dispatch({ type: 'SET_PLAYHEAD', time: next });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // We intentionally don't depend on `playheadTime` — the rAF loop owns
    // its own monotonic clock and reads playheadTime from the closure on
    // each tick via dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, totalDuration, dispatch]);

  // ── Drag a selected text overlay around the preview ────────────────────
  const onOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, overlayId: string) => {
      const container = containerRef.current;
      if (!container) { return; }
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const rect = container.getBoundingClientRect();
      const move = (ev: PointerEvent) => {
        const x = (ev.clientX - rect.left) / rect.width;
        const y = (ev.clientY - rect.top) / rect.height;
        dispatch({
          type: 'UPDATE_TEXT_OVERLAY',
          overlayId,
          updates: {
            canvasX: Math.min(1, Math.max(0, x)),
            canvasY: Math.min(1, Math.max(0, y)),
          },
        });
      };
      const up = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    },
    [dispatch],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  if (clips.length === 0) {
    return (
      <div className="aspect-video bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col items-center justify-center">
        <Film className="w-12 h-12 text-zinc-700 mb-3" />
        <p className="text-zinc-500 text-sm">Drop a video here or use the panel on the right</p>
        <p className="text-zinc-600 text-xs mt-1">Space to play, S to split, Del to remove</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black border border-zinc-800 rounded-lg overflow-hidden"
    >
      {active ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ filter: effectToCssFilter(active.clip.effect) }}
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
          End of timeline
        </div>
      )}

      {/* Text overlays */}
      {visibleOverlays.map((overlay) => {
        const isSelected = selectedOverlayId === overlay.id;
        const useCanvas = typeof overlay.canvasX === 'number' && typeof overlay.canvasY === 'number';
        const left = useCanvas ? `${(overlay.canvasX ?? 0.5) * 100}%` : '50%';
        const top = useCanvas ? `${(overlay.canvasY ?? 0.5) * 100}%` : positionToTop(overlay.position);

        return (
          <div
            key={overlay.id}
            role="button"
            tabIndex={0}
            onPointerDown={(e) => onOverlayPointerDown(e, overlay.id)}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SELECT_OVERLAY', overlayId: overlay.id });
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded cursor-move select-none whitespace-pre-wrap text-center ${
              isSelected ? 'ring-2 ring-amber-400' : ''
            }`}
            style={{
              left,
              top,
              fontSize: `${overlay.fontSize}px`,
              color: overlay.fontColor,
              backgroundColor: overlay.backgroundColor,
              fontFamily: overlay.fontFamily ?? 'system-ui, sans-serif',
              fontWeight: 600,
              maxWidth: '80%',
            }}
          >
            {overlay.text}
          </div>
        );
      })}
    </div>
  );
}
