/**
 * Content Generator layout.
 *
 * Wraps every content-generator tab (/content/video, /content/image-generator,
 * /content/video/editor, /content/video/library, /content/voice-lab) so the
 * content-scoped Content Assistant slide-in panel is available everywhere in
 * the content studio. The assistant renders after {children} so it floats over
 * whichever tab the operator is on.
 */

import type { ReactNode } from 'react';
import { ContentAssistant } from '@/components/content/ContentAssistant';

export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ContentAssistant />
    </>
  );
}
