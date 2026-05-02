'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { StudioModePanel } from '../video/components/StudioModePanel';

export default function ImageGeneratorPage() {
  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />
      <StudioModePanel />
    </div>
  );
}
