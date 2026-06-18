'use client';

/**
 * Content Generator → Library hub layout.
 *
 * Media, Characters and Locations are all "libraries" (build once, reuse), so
 * they live as sections inside ONE Library tab instead of three top-level tabs.
 * This layout renders the two-level nav (Content Generator tabs + Library
 * sections) and the shared page padding; each section page renders only its own
 * content (header + grid + dialogs).
 */

import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS, LIBRARY_SECTIONS } from '@/lib/constants/subpage-nav';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />
      <SubpageNav items={LIBRARY_SECTIONS} />
      {children}
    </div>
  );
}
