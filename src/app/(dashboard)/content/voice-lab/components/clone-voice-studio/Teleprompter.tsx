'use client';

/**
 * Teleprompter — a karaoke-style, auto-scrolling script reader.
 *
 * How the pacing works
 * --------------------
 *  - The script is flattened into a list of short lines (16–26 words each).
 *  - Each line is given a "dwell time" derived from its word count and the
 *    chosen words-per-minute (default 115 WPM, research-approved for natural
 *    spoken delivery). See lineDwellMs() in capture-script.ts.
 *  - A single timer advances a "cursor" (the highlighted line index) once that
 *    line's dwell time elapses. The advance is scheduled with setTimeout using
 *    the CURRENT line's dwell, so changing speed mid-read takes effect on the
 *    next line. Pausing simply stops scheduling the next advance.
 *
 * How the karaoke highlight works
 * -------------------------------
 *  - The line at the cursor is the "active" line: full-contrast text, a primary
 *    accent bar, and a left-to-right fill overlay that animates across exactly
 *    the active line's dwell time (a CSS width transition keyed to the cursor),
 *    so the operator sees the read sweeping through the words like karaoke.
 *  - Already-read lines dim; upcoming lines are muted. The active line is kept
 *    vertically centered by scrolling its element into view on each advance.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Caption } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import {
  type ScriptSection,
  type FlatScriptLine,
  flattenScript,
  lineDwellMs,
  DEFAULT_WORDS_PER_MINUTE,
  MIN_WORDS_PER_MINUTE,
  MAX_WORDS_PER_MINUTE,
} from './capture-script';

export type TeleprompterState = 'idle' | 'playing' | 'paused' | 'finished';

interface TeleprompterProps {
  sections: ScriptSection[];
  /** Words per minute; controlled by the parent so it can persist across passes. */
  wordsPerMinute: number;
  onWordsPerMinuteChange: (wpm: number) => void;
  /** Fired whenever the scroll state changes (so the parent can mirror it). */
  onStateChange?: (state: TeleprompterState) => void;
  /** Fired when the prompter reaches the end of the script. */
  onFinished?: () => void;
}

export function Teleprompter({
  sections,
  wordsPerMinute,
  onWordsPerMinuteChange,
  onStateChange,
  onFinished,
}: TeleprompterProps) {
  const lines = useMemo<FlatScriptLine[]>(() => flattenScript(sections), [sections]);

  const [state, setState] = useState<TeleprompterState>('idle');
  const [cursor, setCursor] = useState(0);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Keep the parent informed of state transitions.
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  // Center the active line whenever the cursor moves.
  useEffect(() => {
    const el = lineRefs.current[cursor];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cursor]);

  // The scrolling engine: while playing, schedule an advance using the CURRENT
  // line's dwell time. Re-runs whenever cursor, state, or pace changes.
  useEffect(() => {
    if (state !== 'playing') {
      return;
    }
    if (cursor >= lines.length - 1) {
      // On the last line — let it dwell, then finish.
      const dwell = lineDwellMs(lines[lines.length - 1], wordsPerMinute);
      advanceTimerRef.current = setTimeout(() => {
        setState('finished');
        onFinished?.();
      }, dwell);
      return clearAdvanceTimer;
    }
    const dwell = lineDwellMs(lines[cursor], wordsPerMinute);
    advanceTimerRef.current = setTimeout(() => {
      setCursor((c) => Math.min(c + 1, lines.length - 1));
    }, dwell);
    return clearAdvanceTimer;
  }, [state, cursor, wordsPerMinute, lines, onFinished, clearAdvanceTimer]);

  const play = useCallback(() => {
    if (state === 'finished') {
      setCursor(0);
    }
    setState('playing');
  }, [state]);

  const pause = useCallback(() => {
    clearAdvanceTimer();
    setState('paused');
  }, [clearAdvanceTimer]);

  const restart = useCallback(() => {
    clearAdvanceTimer();
    setCursor(0);
    setState('idle');
  }, [clearAdvanceTimer]);

  // Active-line dwell drives the karaoke fill duration (ms → seconds for CSS).
  const activeDwellMs = lines[cursor] ? lineDwellMs(lines[cursor], wordsPerMinute) : 0;

  return (
    <div className="rounded-2xl border border-border-strong bg-card p-6">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {state === 'playing' ? (
            <Button onClick={pause} className="gap-2">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button onClick={play} className="gap-2">
              <Play className="h-4 w-4" />
              {state === 'paused' ? 'Resume' : state === 'finished' ? 'Read again' : 'Start scroll'}
            </Button>
          )}
          <Button variant="outline" onClick={restart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-3">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <Caption>Pace</Caption>
              <Caption className="font-mono text-foreground">{wordsPerMinute} wpm</Caption>
            </div>
            <input
              type="range"
              min={MIN_WORDS_PER_MINUTE}
              max={MAX_WORDS_PER_MINUTE}
              step={5}
              value={wordsPerMinute}
              onChange={(e) => onWordsPerMinuteChange(Number(e.target.value))}
              aria-label="Teleprompter pace in words per minute"
              className="h-1.5 w-40 accent-primary"
            />
          </div>
        </div>
      </div>

      {state === 'idle' && (
        <Caption className="mb-3 block">
          The script scrolls on its own at {DEFAULT_WORDS_PER_MINUTE} words per minute. Press
          Start scroll when you begin recording — the highlighted line is the one to read.
        </Caption>
      )}

      {/* Scrolling script viewport */}
      <div
        ref={scrollContainerRef}
        className="relative h-80 overflow-y-auto rounded-xl border border-border-light bg-surface-elevated px-6 py-10"
      >
        {/* Soft fade top + bottom to focus the centered active line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-surface-elevated to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-surface-elevated to-transparent" />

        <div className="space-y-4">
          {lines.map((line) => {
            const isActive = line.index === cursor;
            const isPast = line.index < cursor;
            return (
              <div
                key={line.index}
                ref={(el) => {
                  lineRefs.current[line.index] = el;
                }}
              >
                {/* Section header on the first line of each section */}
                {line.isSectionStart && (
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider',
                        isActive || isPast ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {line.sectionLabel}
                    </span>
                    {line.warmUp && (
                      <span className="rounded-full bg-surface-main px-2 py-0.5 text-[10px] text-muted-foreground">
                        not recorded
                      </span>
                    )}
                  </div>
                )}

                {/* Delivery cue */}
                {line.cue && (
                  <Caption
                    className={cn(
                      'mb-1 block italic',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    ({line.cue})
                  </Caption>
                )}

                {/* The line itself, with a karaoke fill overlay when active */}
                <div className="relative">
                  <p
                    className={cn(
                      'text-xl leading-relaxed transition-colors duration-300',
                      isActive
                        ? 'font-semibold text-foreground'
                        : isPast
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/60',
                    )}
                  >
                    {line.text}
                  </p>

                  {isActive && state === 'playing' && (
                    <div
                      key={`fill-${cursor}`}
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 origin-left bg-primary/10"
                      style={{
                        animationName: 'svKaraokeSweep',
                        animationDuration: `${activeDwellMs}ms`,
                        animationTimingFunction: 'linear',
                        animationFillMode: 'forwards',
                      }}
                    />
                  )}

                  {isActive && (
                    <span className="absolute -left-3 top-0 h-full w-1 rounded-full bg-primary" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The keyframes for the karaoke sweep. Scoped via a unique name; width
          animates 0 → 100% across the active line's dwell time. */}
      <style jsx global>{`
        @keyframes svKaraokeSweep {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
