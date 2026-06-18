'use client';

/**
 * Generative VFX & B-Roll mode (our AI edge). STUB — being built.
 * Generate B-roll and generative effects from the project's scenes and drop them on
 * the timeline — all driving the shared reducer (EditorModeProps).
 */

import { Wand2 } from 'lucide-react';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import type { EditorModeProps } from '../editor-modes';

export default function GenerativeVfxMode({ state }: EditorModeProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
      <Wand2 className="mx-auto mb-3 h-10 w-10 text-primary" />
      <SectionTitle as="h3">Generative VFX &amp; B-Roll</SectionTitle>
      <SectionDescription className="mx-auto mt-1 max-w-md">
        Generate B-roll and generative effects from your scenes and drop them on the timeline. This
        workspace is being built on our fal/Seedance + image engines.
      </SectionDescription>
      <Caption className="mt-3 block">{state.clips.length} clip(s) loaded into this project.</Caption>
    </div>
  );
}
