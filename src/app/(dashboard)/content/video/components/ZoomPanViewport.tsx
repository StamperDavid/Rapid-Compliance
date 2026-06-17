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

  // Wheel PANS the document, captured NON-PASSIVELY so it scrolls ONLY the doc
  // (never the page) while the pointer is over it. Off the doc → normal page scroll.
  // Magnification is the slider / +/- buttons only — the wheel never zooms.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) {
      return;
    }
    const handler = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      setTy((t) => t - e.deltaY);
      setTx((t) => t - e.deltaX);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

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

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!panning.current) {
      return;
    }
    setTx(panning.current.tx + (e.clientX - panning.current.x));
    setTy(panning.current.ty + (e.clientY - panning.current.y));
  }, []);

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
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={() => setScale((s) => clampScale(s * 0.85))} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <input
          type="range"
          aria-label="Magnification"
          min={Math.round(MIN_SCALE * 100)}
          max={Math.round(MAX_SCALE * 100)}
          value={Math.round(scale * 100)}
          onChange={(e) => setScale(clampScale(Number(e.target.value) / 100))}
          className="h-1 w-28 cursor-pointer accent-amber-400"
          data-no-pan
        />
        <span className="min-w-[3ch] text-center text-[11px] tabular-nums text-zinc-400">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={() => setScale((s) => clampScale(s * 1.15))} title="Zoom in">
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
