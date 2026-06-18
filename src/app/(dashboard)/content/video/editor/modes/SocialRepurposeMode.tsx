'use client';

/**
 * Social Repurposing mode (parity floor: Reap / OpusClip). STUB — being built.
 * Turn a long video into captioned, vertical short clips automatically — all driving
 * the shared reducer (EditorModeProps), never a separate project state.
 */

import { Share2 } from 'lucide-react';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import type { EditorModeProps } from '../editor-modes';

export default function SocialRepurposeMode({ state }: EditorModeProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
      <Share2 className="mx-auto mb-3 h-10 w-10 text-primary" />
      <SectionTitle as="h3">Social Repurposing</SectionTitle>
      <SectionDescription className="mx-auto mt-1 max-w-md">
        Turn a long video into captioned, vertical short clips automatically. This workspace is
        being built to the Reap / OpusClip bar.
      </SectionDescription>
      <Caption className="mt-3 block">{state.clips.length} clip(s) loaded into this project.</Caption>
    </div>
  );
}
