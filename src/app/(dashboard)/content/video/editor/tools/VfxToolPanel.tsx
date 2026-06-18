'use client';

/**
 * VFX & B-Roll tool panel — generate B-roll / effects and drop them on the timeline.
 * STUB — being built. Reuses the existing generative-vfx logic; renders as a right
 * column panel beside the shared Preview + Timeline (no Preview of its own).
 */

import { Wand2 } from 'lucide-react';
import { Caption } from '@/components/ui/typography';
import type { EditorToolProps } from '../editor-tools';

export default function VfxToolPanel({ state }: EditorToolProps) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-card p-4 text-center">
      <Wand2 className="mx-auto mb-2 h-6 w-6 text-primary" />
      <Caption className="block">VFX &amp; B-Roll tool — being built. {state.clips.length} clip(s).</Caption>
    </div>
  );
}
