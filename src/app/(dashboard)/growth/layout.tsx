'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { GROWTH_TABS } from '@/lib/constants/subpage-nav';

export default function GrowthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={GROWTH_TABS} />
      {children}
    </>
  );
}
