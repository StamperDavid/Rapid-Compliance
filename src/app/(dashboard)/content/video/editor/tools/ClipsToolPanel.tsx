'use client';

/**
 * Make Clips tool panel — cut the project into short clips, choose platform formats,
 * and hand them to the social scheduler. STUB — being built. Reuses the existing
 * social-repurpose segment logic; right-column panel beside the shared timeline.
 */

import { Scissors } from 'lucide-react';
import { Caption } from '@/components/ui/typography';
import type { EditorToolProps } from '../editor-tools';

export default function ClipsToolPanel({ state }: EditorToolProps) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-card p-4 text-center">
      <Scissors className="mx-auto mb-2 h-6 w-6 text-primary" />
      <Caption className="block">Make Clips tool — being built. {state.clips.length} clip(s).</Caption>
    </div>
  );
}
