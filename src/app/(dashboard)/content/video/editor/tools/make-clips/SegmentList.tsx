'use client';

/**
 * SegmentList — the operator defines one or more shorts by in/out points over
 * the shared project timeline. Pure presentation + local edit callbacks; all
 * timeline math comes from segment-utils. Narrow-column friendly.
 */

import { Plus, Trash2, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardTitle, Caption, SectionDescription } from '@/components/ui/typography';
import { formatTimecode, type ShortSegment } from '../../modes/social-repurpose/segment-utils';

interface SegmentListProps {
  segments: ShortSegment[];
  /** Total project timeline length, for clamping + labels. */
  timelineDuration: number;
  /** Current playhead position, used by "set to playhead" buttons. */
  playheadTime: number;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Pick<ShortSegment, 'startSec' | 'endSec' | 'name'>>) => void;
  onRemove: (id: string) => void;
  /** Two-step delete: which segment is armed. */
  armedDeleteId: string | null;
}

/** Parse a number input value, falling back to the previous value on blank/NaN. */
function toSeconds(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function SegmentList({
  segments,
  timelineDuration,
  playheadTime,
  onAdd,
  onUpdate,
  onRemove,
  armedDeleteId,
}: SegmentListProps) {
  return (
    <section className="space-y-3 rounded-xl border border-border-strong bg-card p-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm">Your shorts</CardTitle>
        <Caption>timeline {formatTimecode(timelineDuration)}</Caption>
      </div>

      {segments.length === 0 ? (
        <SectionDescription>
          Add a short, then set where it starts and ends on your video.
        </SectionDescription>
      ) : (
        <ul className="space-y-3">
          {segments.map((seg, index) => {
            const duration = Math.max(0, seg.endSec - seg.startSec);
            const valid = duration > 0 && seg.startSec < timelineDuration;
            return (
              <li
                key={seg.id}
                className="space-y-2 rounded-lg border border-border-light bg-surface-elevated p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Input
                    aria-label={`Short ${index + 1} name`}
                    value={seg.name}
                    onChange={(e) => onUpdate(seg.id, { name: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant={armedDeleteId === seg.id ? 'destructive' : 'ghost'}
                    onClick={() => onRemove(seg.id)}
                    aria-label="Remove short"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <Caption className="block">Start (sec)</Caption>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={seg.startSec}
                        onChange={(e) =>
                          onUpdate(seg.id, { startSec: toSeconds(e.target.value, seg.startSec) })
                        }
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onUpdate(seg.id, { startSec: playheadTime })}
                        aria-label="Set start to playhead"
                        title="Set to playhead"
                      >
                        <Crosshair className="h-4 w-4" />
                      </Button>
                    </div>
                  </label>
                  <label className="space-y-1">
                    <Caption className="block">End (sec)</Caption>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={seg.endSec}
                        onChange={(e) =>
                          onUpdate(seg.id, { endSec: toSeconds(e.target.value, seg.endSec) })
                        }
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onUpdate(seg.id, { endSec: playheadTime })}
                        aria-label="Set end to playhead"
                        title="Set to playhead"
                      >
                        <Crosshair className="h-4 w-4" />
                      </Button>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <Caption>
                    {formatTimecode(seg.startSec)} → {formatTimecode(seg.endSec)}
                  </Caption>
                  <Caption className={valid ? 'text-foreground' : 'text-destructive'}>
                    {valid ? `${duration.toFixed(1)}s` : 'Set valid in/out'}
                  </Caption>
                </div>
                {armedDeleteId === seg.id ? (
                  <Caption className="block text-destructive">Click the trash again to remove.</Caption>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Button size="sm" variant="outline" className="w-full" onClick={onAdd}>
        <Plus className="mr-1 h-4 w-4" /> Add a short
      </Button>
    </section>
  );
}
