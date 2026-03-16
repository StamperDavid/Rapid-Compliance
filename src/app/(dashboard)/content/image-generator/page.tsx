'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { StudioModePanel } from '../video/components/StudioModePanel';

export default function ImageGeneratorPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="px-6 pt-6">
        <SubpageNav items={CONTENT_GENERATOR_TABS} />
      </div>
      <StudioModePanel />
    </div>
  );
}
