/**
 * ZoomPanViewport — a scroll-to-zoom / drag-to-pan frame for the Shot Plan
 * production-sheet poster, so the operator can zoom into any piece of the document
 * (like OpenArt). The child is a FIXED-WIDTH poster; this frame scales + translates
 * it. Ctrl/⌘ + wheel (or plain wheel) zooms toward the cursor; drag pans.
 */

'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.25;

export function ZoomPanViewport({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const panning = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Mirror scale into a ref so the once-bound wheel listener reads the live value.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Clamp a single-axis translate so the document can NEVER be panned/scrolled
  // entirely out of the frame. When the (scaled) content is TALLER/WIDER than the
  // frame you may pan between its top/left edge and its bottom/right edge (never
  // past); when it's SMALLER you may move it within the frame but it stays fully
  // visible. This is what stops the operator losing the doc by over-scrolling.
  const clampAxis = (t: number, contentScaled: number, frame: number): number => {
    const lo = Math.min(0, frame - contentScaled);
    const hi = Math.max(0, frame - contentScaled);
    return Math.min(hi, Math.max(lo, t));
  };

  const clampX = useCallback((t: number, s: number): number => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) {
      return t;
    }
    return clampAxis(t, content.offsetWidth * s, frame.clientWidth);
  }, []);

  const clampY = useCallback((t: number, s: number): number => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) {
      return t;
    }
    return clampAxis(t, content.offsetHeight * s, frame.clientHeight);
  }, []);

  // Wheel PANS the document, captured NON-PASSIVELY so it scrolls ONLY the doc
  // (never the page) while the pointer is over it. Off the doc → normal page scroll.
  // Magnification is the slider / +/- buttons only — the wheel never zooms. The
  // translate is CLAMPED so the wheel can't push the doc off the top or bottom.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) {
      return;
    }
    const handler = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      setTy((t) => clampY(t - e.deltaY, scaleRef.current));
      setTx((t) => clampX(t - e.deltaX, scaleRef.current));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [clampX, clampY]);

  // Re-clamp on resize so a smaller viewport can't strand the doc out of bounds.
  useEffect(() => {
    const onResize = (): void => {
      setTx((t) => clampX(t, scaleRef.current));
      setTy((t) => clampY(t, scaleRef.current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampX, clampY]);

  // Set magnification AND re-clamp the pan to the new scale (zooming out must pull
  // a panned-away doc back into view).
  const applyScale = useCallback(
    (next: number) => {
      const s = clampScale(next);
      setScale(s);
      setTx((t) => clampX(t, s));
      setTy((t) => clampY(t, s));
    },
    [clampX, clampY],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      // Left-drag on empty space pans; ignore drags that start on interactive bits.
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, select, [data-no-pan]')) {
        return;
      }
      panning.current = { x: e.clientX, y: e.clientY, tx, ty };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [tx, ty],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!panning.current) {
        return;
      }
      const s = scaleRef.current;
      setTx(clampX(panning.current.tx + (e.clientX - panning.current.x), s));
      setTy(clampY(panning.current.ty + (e.clientY - panning.current.y), s));
    },
    [clampX, clampY],
  );

  const endPan = useCallback((e: PointerEvent<HTMLDivElement>) => {
    panning.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/90 p-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={() => applyScale(scale * 0.85)} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <input
          type="range"
          aria-label="Magnification"
          min={Math.round(MIN_SCALE * 100)}
          max={Math.round(MAX_SCALE * 100)}
          value={Math.round(scale * 100)}
          onChange={(e) => applyScale(Number(e.target.value) / 100)}
          className="h-1 w-28 cursor-pointer accent-amber-400"
          data-no-pan
        />
        <span className="min-w-[3ch] text-center text-[11px] tabular-nums text-zinc-400">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={() => applyScale(scale * 1.15)} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={reset} title="Reset view">
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={frameRef}
        className="relative h-[80vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        style={{ cursor: panning.current ? 'grabbing' : 'grab' }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: 'max-content',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
