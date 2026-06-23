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

/** Playback-rate multiplier for a clip, clamped to the supported range. */
function clipSpeed(clip: EditorClip): number {
  const s = clip.effect?.speed ?? 1;
  return Math.min(2, Math.max(0.5, s || 1));
}

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  const trimmed = Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
  // A clip played at 2× occupies half the timeline; 0.5× occupies double.
  return Math.max(0.1, trimmed / clipSpeed(clip));
}

/** Resolve which clip is on screen at a given timeline second + the offset
 *  inside that clip. Returns null when the playhead is past the timeline. */
function resolveActiveClip(clips: EditorClip[], playheadTime: number): ActiveClipState | null {
  let elapsed = 0;
  for (const clip of clips) {
    const dur = effectiveDuration(clip);
    if (playheadTime < elapsed + dur) {
      const localTime = Math.max(0, playheadTime - elapsed);
      // Timeline time runs at the clip's speed inside the source video.
      return {
        clip,
        sourceTime: clip.trimStart + localTime * clipSpeed(clip),
      };
    }
    elapsed += dur;
  }
  return null;
}

/** SVG filter id for the in-DOM sharpen convolution. One shared definition is
 *  enough — the strength is fixed at render parity (see SharpenFilterDef). */
const SHARPEN_FILTER_ID = 'editor-clip-sharpen';

/** Map ClipEffect to a CSS filter string. Mirrors the FFmpeg filter chain used
 *  on the server (eq + hue + colorchannelmixer + gblur + unsharp) so what the
 *  operator sees is what renders. Vignette and grain are not expressible as CSS
 *  `filter()` primitives, so they render as overlays (see the component body). */
function effectToCssFilter(effect: ClipEffect | undefined): string {
  const e = effect ?? NEUTRAL_EFFECT;
  // CSS brightness uses 1 = unchanged with 0..2 range; our state uses
  // -1..1 offsets, so map to (1 + offset).
  const parts: string[] = [
    `brightness(${Math.max(0, 1 + e.brightness).toFixed(3)})`,
    `contrast(${Math.max(0, e.contrast).toFixed(3)})`,
    `saturate(${Math.max(0, e.saturation).toFixed(3)})`,
    `hue-rotate(${e.hue.toFixed(1)}deg)`,
  ];
  if (e.grayscale && e.grayscale > 0) {
    parts.push(`grayscale(${Math.min(1, e.grayscale).toFixed(3)})`);
  }
  if (e.sepia && e.sepia > 0) {
    parts.push(`sepia(${Math.min(1, e.sepia).toFixed(3)})`);
  }
  if (e.blur && e.blur > 0) {
    parts.push(`blur(${Math.min(20, e.blur).toFixed(2)}px)`);
  }
  if (e.sharpen && e.sharpen > 0) {
    parts.push(`url(#${SHARPEN_FILTER_ID})`);
  }
  return parts.join(' ');
}

/** Radial-gradient overlay that mirrors FFmpeg's `vignette` darkened corners. */
function vignetteOverlayStyle(strength: number): React.CSSProperties {
  const s = Math.min(1, Math.max(0, strength));
  // Inner clear radius shrinks and outer darkness deepens as strength rises.
  const innerStop = (62 - s * 22).toFixed(0);
  const outerAlpha = (s * 0.85).toFixed(3);
  return {
    background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${innerStop}%, rgba(0,0,0,${outerAlpha}) 100%)`,
  };
}

/** Film-grain overlay built from SVG turbulence — an honest preview of FFmpeg's
 *  `noise` filter (no external asset, no fakery). */
function grainOverlayStyle(strength: number): React.CSSProperties {
  const s = Math.min(1, Math.max(0, strength));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
    backgroundRepeat: 'repeat',
    opacity: (s * 0.4).toFixed(3),
    mixBlendMode: 'overlay',
  };
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

    // Honour the clip's playback speed during live playback.
    const speed = Math.min(2, Math.max(0.5, active.clip.effect?.speed ?? 1));
    if (video.playbackRate !== speed) {
      video.playbackRate = speed;
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

    // Seed a monotonic accumulator from the current playhead ONCE, then advance it
    // by each frame's delta. The old code did `playheadTime + dt`, but playheadTime is
    // the stale closure value (this effect intentionally doesn't depend on it), so the
    // playhead never advanced past the first frame — playback appeared to stop after
    // clip 1. The accumulator owns the clock and carries through every clip.
    let last = performance.now();
    let elapsed = playheadTime;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      elapsed += dt;
      if (elapsed >= totalDuration) {
        dispatch({ type: 'SET_PLAYHEAD', time: totalDuration });
        dispatch({ type: 'SET_PLAYING', playing: false });
        return;
      }
      dispatch({ type: 'SET_PLAYHEAD', time: elapsed });
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
      {/* SVG sharpen convolution — referenced by the video's CSS `filter`.
          A standard 3×3 sharpen kernel that mirrors FFmpeg's unsharp pass. */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <filter id={SHARPEN_FILTER_ID}>
          <feConvolveMatrix
            order="3"
            preserveAlpha="true"
            kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"
          />
        </filter>
      </svg>

      {active ? (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: effectToCssFilter(active.clip.effect) }}
            // NOT muted: each scene's lip-synced dialogue is baked into its video,
            // so the timeline preview must play sound. Playback is only ever
            // started by a user gesture (Space / Play), so autoplay policy is fine.
            playsInline
            preload="metadata"
          />
          {/* Vignette overlay (CSS gradient mirror of FFmpeg `vignette`). */}
          {active.clip.effect?.vignette ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={vignetteOverlayStyle(active.clip.effect.vignette)}
              aria-hidden="true"
            />
          ) : null}
          {/* Film-grain overlay (SVG turbulence mirror of FFmpeg `noise`). */}
          {active.clip.effect?.grain ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={grainOverlayStyle(active.clip.effect.grain)}
              aria-hidden="true"
            />
          ) : null}
        </>
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
