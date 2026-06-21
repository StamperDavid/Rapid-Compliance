'use client';

/**
 * FormatPicker — choose which platform formats each short renders to. Each
 * format maps to an aspect (9:16 vertical for shorts) and a real scheduler
 * platform. Multi-select toggles, narrow-column friendly.
 */

import { Check } from 'lucide-react';
import { CardTitle, Caption } from '@/components/ui/typography';
import { CLIP_FORMATS } from './platforms';

interface FormatPickerProps {
  selectedIds: string[];
  onToggle: (formatId: string) => void;
}

export default function FormatPicker({ selectedIds, onToggle }: FormatPickerProps) {
  return (
    <section className="space-y-2 rounded-xl border border-border-strong bg-card p-4">
      <CardTitle className="text-sm">Where it goes</CardTitle>
      <ul className="space-y-1.5">
        {CLIP_FORMATS.map((format) => {
          const selected = selectedIds.includes(format.id);
          return (
            <li key={format.id}>
              <button
                type="button"
                onClick={() => onToggle(format.id)}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border-strong bg-card hover:bg-accent'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{format.label}</span>
                  <Caption className="block">
                    {format.hint} · {format.aspect}
                  </Caption>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong'
                  }`}
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
