'use client';

/**
 * Script & Podcast mode (parity floor: Descript). STUB — being built.
 * Edit by transcript: delete words to cut video, strip filler words and silences —
 * all driving the shared reducer (EditorModeProps), never a separate project state.
 */

import { FileText } from 'lucide-react';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import type { EditorModeProps } from '../editor-modes';

export default function ScriptPodcastMode({ state }: EditorModeProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
      <FileText className="mx-auto mb-3 h-10 w-10 text-primary" />
      <SectionTitle as="h3">Script &amp; Podcast</SectionTitle>
      <SectionDescription className="mx-auto mt-1 max-w-md">
        Edit by transcript — delete words to cut the video, strip filler and silences. This
        workspace is being built to the Descript bar.
      </SectionDescription>
      <Caption className="mt-3 block">{state.clips.length} clip(s) loaded into this project.</Caption>
    </div>
  );
}
