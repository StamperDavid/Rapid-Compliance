'use client';

/**
 * QuickClipStrip — the simplified horizontal clip strip for Quick Edits.
 *
 * Parity floor: CapCut's bottom clip rail. Each clip is a tappable card with
 * thumbnail, name, and live duration. Selecting a clip surfaces inline reorder
 * (◀ ▶), duplicate, and delete affordances. Trimming lives in the parent panel
 * so the strip stays one-tap simple. Everything drives the SHARED reducer — the
 * strip holds no clip state of its own.
 */

import { ArrowLeft, ArrowRight, Copy, Trash2, Film } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Caption } from '@/components/ui/typography';
import {
  DEFAULT_CLIP_DURATION,
  type EditorClip,
  type EditorAction,
} from '../../types';

interface QuickClipStripProps {
  clips: EditorClip[];
  selectedClipId: string | null;
  dispatch: React.Dispatch<EditorAction>;
}

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

/** Move a clip one slot left/right by emitting a fresh REORDER_CLIPS order. */
function reorder(clips: EditorClip[], clipId: string, direction: -1 | 1): string[] {
  const index = clips.findIndex((c) => c.id === clipId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= clips.length) {
    return clips.map((c) => c.id);
  }
  const next = [...clips];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next.map((c) => c.id);
}

export default function QuickClipStrip({
  clips,
  selectedClipId,
  dispatch,
}: QuickClipStripProps) {
  if (clips.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong bg-card px-4 py-6 text-muted-foreground">
        <Film className="h-5 w-5" />
        <Caption>No clips in this project yet. Your generated scenes will appear here.</Caption>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {clips.map((clip, index) => {
        const isSelected = clip.id === selectedClipId;
        return (
          <div
            key={clip.id}
            className={`flex w-44 flex-shrink-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors ${
              isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border-strong'
            }`}
          >
            <button
              type="button"
              onClick={() => dispatch({ type: 'SELECT_CLIP', clipId: clip.id })}
              className="group relative block aspect-video w-full bg-cover bg-center bg-surface-elevated text-left"
              // Thumbnail URLs are arbitrary signed URLs only known at runtime —
              // a dynamic background image is the design-system-compliant way to
              // show them without next/image's static-domain config.
              style={clip.thumbnailUrl ? { backgroundImage: `url(${JSON.stringify(clip.thumbnailUrl)})` } : undefined}
              aria-pressed={isSelected}
              aria-label={`Select clip ${clip.name}`}
            >
              {!clip.thumbnailUrl && (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Film className="h-6 w-6" />
                </div>
              )}
              <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                {index + 1}
              </span>
              <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-foreground">
                {formatSeconds(effectiveDuration(clip))}
              </span>
            </button>

            <div className="flex flex-col gap-1.5 p-2">
              <p className="truncate text-xs font-medium text-foreground" title={clip.name}>
                {clip.name}
              </p>
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() =>
                      dispatch({ type: 'REORDER_CLIPS', clipIds: reorder(clips, clip.id, -1) })
                    }
                    aria-label="Move clip earlier"
                    title="Move earlier"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === clips.length - 1}
                    onClick={() =>
                      dispatch({ type: 'REORDER_CLIPS', clipIds: reorder(clips, clip.id, 1) })
                    }
                    aria-label="Move clip later"
                    title="Move later"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => dispatch({ type: 'DUPLICATE_CLIP', clipId: clip.id })}
                    aria-label="Duplicate clip"
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => dispatch({ type: 'REMOVE_CLIP', clipId: clip.id })}
                    aria-label="Delete clip"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
