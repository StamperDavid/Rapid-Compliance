'use client';

/**
 * Quick Edits mode (parity floor: CapCut). STUB — being built.
 * Fast templated edits, one-tap captions, effects, quick export — all driving the
 * shared reducer (EditorModeProps), never a separate project state.
 */

import { Zap } from 'lucide-react';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import type { EditorModeProps } from '../editor-modes';

export default function QuickEditMode({ state }: EditorModeProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
      <Zap className="mx-auto mb-3 h-10 w-10 text-primary" />
      <SectionTitle as="h3">Quick Edits</SectionTitle>
      <SectionDescription className="mx-auto mt-1 max-w-md">
        Fast templated edits, one-tap captions and effects. This workspace is being built to the
        CapCut bar.
      </SectionDescription>
      <Caption className="mt-3 block">{state.clips.length} clip(s) loaded into this project.</Caption>
    </div>
  );
}
