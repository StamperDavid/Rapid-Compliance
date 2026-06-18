'use client';

/**
 * Text & Captions tool panel — add text overlays + auto-generate subtitles.
 * STUB — being built. Right-column panel beside the shared Preview + Timeline.
 */

import { Type } from 'lucide-react';
import { Caption } from '@/components/ui/typography';
import type { EditorToolProps } from '../editor-tools';

export default function TextToolPanel({ state }: EditorToolProps) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-card p-4 text-center">
      <Type className="mx-auto mb-2 h-6 w-6 text-primary" />
      <Caption className="block">Text &amp; Captions tool — being built. {state.clips.length} clip(s).</Caption>
    </div>
  );
}
