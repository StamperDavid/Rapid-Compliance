'use client';

/**
 * Transcript tool panel — edit by transcript (delete words to cut video, strip
 * filler + silences). STUB — being built. Reuses the existing script-podcast logic;
 * right-column panel beside the shared Preview + Timeline (no Preview of its own).
 */

import { FileText } from 'lucide-react';
import { Caption } from '@/components/ui/typography';
import type { EditorToolProps } from '../editor-tools';

export default function TranscriptToolPanel({ state }: EditorToolProps) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-card p-4 text-center">
      <FileText className="mx-auto mb-2 h-6 w-6 text-primary" />
      <Caption className="block">Transcript tool — being built. {state.clips.length} clip(s).</Caption>
    </div>
  );
}
