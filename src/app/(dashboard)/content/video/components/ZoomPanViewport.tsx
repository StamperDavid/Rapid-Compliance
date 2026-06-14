/**
 * ZoomPanViewport — a scroll-to-zoom / drag-to-pan frame for the Shot Plan
 * production-sheet poster, so the operator can zoom into any piece of the document
 * (like OpenArt). The child is a FIXED-WIDTH poster; this frame scales + translates
 * it. Ctrl/⌘ + wheel (or plain wheel) zooms toward the cursor; drag pans.
 */

'use client';

import { useCallback, useRef, useState, type ReactNode, type WheelEvent, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
const ZOOM_SENSITIVITY = 0.0015;

export function ZoomPanViewport({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const panning = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    // Zoom toward the cursor; keep the point under the pointer stable.
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setScale((prev) => {
      const next = clampScale(prev * (1 - e.deltaY * ZOOM_SENSITIVITY));
      const ratio = next / prev;
      setTx((t) => px - ratio * (px - t));
      setTy((t) => py - ratio * (py - t));
      return next;
    });
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
        <span className="min-w-[3ch] text-center text-[11px] tabular-nums text-zinc-400">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={() => setScale((s) => clampScale(s * 1.15))} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-300" onClick={reset} title="Reset view">
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="relative h-[80vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
        onWheel={onWheel}
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
