'use client';

import { useCallback } from 'react';
import type { TextOverlay, EditorAction } from '../types';
import {
  Type,
  Plus,
  Trash2,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// Types
// ============================================================================

interface EditorTextOverlaysProps {
  textOverlays: TextOverlay[];
  selectedOverlayId: string | null;
  playheadTime: number;
  totalDuration: number;
  dispatch: React.Dispatch<EditorAction>;
}

// ============================================================================
// Helpers
// ============================================================================

const POSITION_OPTIONS: { value: TextOverlay['position']; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];

function PositionIcon({ position }: { position: TextOverlay['position'] }) {
  switch (position) {
    case 'top':
      return <AlignVerticalJustifyStart className="h-3.5 w-3.5" />;
    case 'center':
      return <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />;
    case 'bottom':
      return <AlignVerticalJustifyEnd className="h-3.5 w-3.5" />;
  }
}

/** Parse an rgba string like "rgba(0,0,0,0.5)" into hex + opacity */
function parseRgba(rgba: string): { hex: string; opacity: number } {
  const match = rgba.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (!match) {
    return { hex: '#000000', opacity: 0.5 };
  }
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return { hex, opacity: a };
}

/** Convert hex + opacity back to rgba string */
function toRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Format seconds as m:ss.s */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
}

// ============================================================================
// Component
// ============================================================================

export function EditorTextOverlays({
  textOverlays,
  selectedOverlayId,
  playheadTime,
  totalDuration,
  dispatch,
}: EditorTextOverlaysProps) {
  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddOverlay = useCallback(() => {
    const overlay: Omit<TextOverlay, 'id'> = {
      text: 'New Text',
      startTime: playheadTime,
      endTime: Math.min(playheadTime + 3, totalDuration),
      position: 'bottom',
      fontSize: 24,
      fontColor: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.5)',
    };
    dispatch({ type: 'ADD_TEXT_OVERLAY', overlay });
  }, [playheadTime, totalDuration, dispatch]);

  const handleSelectOverlay = useCallback(
    (overlayId: string, startTime: number) => {
      dispatch({ type: 'SELECT_OVERLAY', overlayId });
      dispatch({ type: 'SET_PLAYHEAD', time: startTime });
    },
    [dispatch]
  );

  const handleRemoveOverlay = useCallback(
    (overlayId: string) => {
      dispatch({ type: 'REMOVE_TEXT_OVERLAY', overlayId });
    },
    [dispatch]
  );

  const handleUpdateOverlay = useCallback(
    (overlayId: string, updates: Partial<TextOverlay>) => {
      dispatch({ type: 'UPDATE_TEXT_OVERLAY', overlayId, updates });
    },
    [dispatch]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
            <Type className="h-4 w-4 text-blue-400" />
            Text Overlays
            {textOverlays.length > 0 && (
              <span className="rounded-full bg-blue-400/20 px-2 py-0.5 text-xs text-blue-400">
                {textOverlays.length}
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddOverlay}
            disabled={totalDuration === 0}
            className="h-7 gap-1 text-xs text-blue-400 hover:bg-blue-400/10 hover:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Text
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {textOverlays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Type className="h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">No text overlays yet</p>
            <p className="text-xs text-zinc-600">
              Add text that appears at specific times in your video
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {textOverlays.map((overlay) => {
              const isSelected = overlay.id === selectedOverlayId;
              const bgParsed = parseRgba(overlay.backgroundColor);

              return (
                <div
                  key={overlay.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectOverlay(overlay.id, overlay.startTime)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectOverlay(overlay.id, overlay.startTime);
                    }
                  }}
                  className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  {/* Row 1: Text + Delete */}
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={overlay.text}
                      onChange={(e) =>
                        handleUpdateOverlay(overlay.id, { text: e.target.value })
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                      placeholder="Enter text..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOverlay(overlay.id);
                      }}
                      className="h-7 w-7 shrink-0 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Row 2: Timing */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Start
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={overlay.endTime}
                        step={0.1}
                        value={overlay.startTime}
                        onChange={(e) =>
                          handleUpdateOverlay(overlay.id, {
                            startTime: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                        End
                      </label>
                      <input
                        type="number"
                        min={overlay.startTime}
                        max={totalDuration}
                        step={0.1}
                        value={overlay.endTime}
                        onChange={(e) =>
                          handleUpdateOverlay(overlay.id, {
                            endTime: Math.min(
                              totalDuration,
                              parseFloat(e.target.value) || 0
                            ),
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <span className="ml-auto text-[10px] text-zinc-600">
                      {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                    </span>
                  </div>

                  {/* Row 3: Position + Font Size */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {POSITION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          title={opt.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateOverlay(overlay.id, { position: opt.value });
                          }}
                          className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                            overlay.position === opt.value
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                          }`}
                        >
                          <PositionIcon position={opt.value} />
                        </button>
                      ))}
                    </div>

                    <div className="ml-2 flex items-center gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Size
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={120}
                        step={1}
                        value={overlay.fontSize}
                        onChange={(e) =>
                          handleUpdateOverlay(overlay.id, {
                            fontSize: Math.max(8, parseInt(e.target.value, 10) || 24),
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Row 4: Colors */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Font
                      </label>
                      <input
                        type="color"
                        value={overlay.fontColor}
                        onChange={(e) =>
                          handleUpdateOverlay(overlay.id, { fontColor: e.target.value })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 w-6 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                        BG
                      </label>
                      <input
                        type="color"
                        value={bgParsed.hex}
                        onChange={(e) => {
                          handleUpdateOverlay(overlay.id, {
                            backgroundColor: toRgba(e.target.value, bgParsed.opacity),
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 w-6 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Opacity
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={bgParsed.opacity}
                        onChange={(e) => {
                          handleUpdateOverlay(overlay.id, {
                            backgroundColor: toRgba(
                              bgParsed.hex,
                              parseFloat(e.target.value)
                            ),
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-1.5 w-16 cursor-pointer accent-blue-400"
                      />
                      <span className="w-7 text-right text-[10px] text-zinc-500">
                        {Math.round(bgParsed.opacity * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Preview swatch */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Preview
                    </span>
                    <div
                      className="flex-1 rounded px-2 py-1 text-center"
                      style={{
                        backgroundColor: overlay.backgroundColor,
                        color: overlay.fontColor,
                        fontSize: `${Math.min(overlay.fontSize, 16)}px`,
                      }}
                    >
                      {overlay.text || 'Text'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
