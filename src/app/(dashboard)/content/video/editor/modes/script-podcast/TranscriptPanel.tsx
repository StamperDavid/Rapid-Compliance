'use client';

/**
 * Transcript panel for the Script & Podcast workspace.
 *
 * Renders the word tokens in clip order. Words are selectable as a range
 * (click a start word, shift/drag to an end word). Filler words are tinted so
 * the operator can see what "Remove filler words" will take out. Clicking a
 * word also moves the playhead to that word — so reading and scrubbing are the
 * same gesture, the way Descript works.
 */

import { useMemo } from 'react';
import { Caption } from '@/components/ui/typography';
import type { TranscriptToken } from './transcript-model';

interface TranscriptPanelProps {
  tokens: TranscriptToken[];
  /** Ids of the currently selected token range (inclusive). */
  selectedIds: ReadonlySet<string>;
  /** The token nearest the playhead, highlighted as "now playing". */
  activeTokenId: string | null;
  onWordClick: (token: TranscriptToken, shiftKey: boolean) => void;
}

export default function TranscriptPanel({
  tokens,
  selectedIds,
  activeTokenId,
  onWordClick,
}: TranscriptPanelProps) {
  // Group tokens by clip so each take reads as its own paragraph.
  const groups = useMemo(() => {
    const out: { clipId: string; tokens: TranscriptToken[] }[] = [];
    for (const token of tokens) {
      const last = out[out.length - 1];
      if (last?.clipId === token.clipId) {
        last.tokens.push(token);
      } else {
        out.push({ clipId: token.clipId, tokens: [token] });
      }
    }
    return out;
  }, [tokens]);

  if (tokens.length === 0) {
    return (
      <Caption className="block py-6 text-center">
        No words detected in this transcript yet.
      </Caption>
    );
  }

  return (
    <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1 leading-8">
      {groups.map((group, index) => (
        <p key={group.clipId} className="text-sm">
          <span className="mr-1 align-middle text-xs font-medium text-muted-foreground">
            [Clip {index + 1}]
          </span>
          {group.tokens.map((token) => {
            const isSelected = selectedIds.has(token.id);
            const isActive = activeTokenId === token.id;
            const base = 'cursor-pointer rounded px-0.5 transition-colors';
            const tone = isSelected
              ? 'bg-primary text-primary-foreground'
              : isActive
                ? 'bg-surface-elevated text-foreground ring-1 ring-primary'
                : token.isFiller
                  ? 'text-amber-500 hover:bg-surface-elevated'
                  : 'text-foreground hover:bg-surface-elevated';
            return (
              <span
                key={token.id}
                role="button"
                tabIndex={0}
                title={token.isFiller ? 'Filler word' : undefined}
                className={`${base} ${tone}`}
                onClick={(e) => onWordClick(token, e.shiftKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onWordClick(token, e.shiftKey);
                  }
                }}
              >
                {token.word}{' '}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
