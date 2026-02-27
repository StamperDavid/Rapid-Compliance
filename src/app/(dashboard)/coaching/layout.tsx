'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { COACHING_TABS } from '@/lib/constants/subpage-nav';

export default function CoachingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={COACHING_TABS} />
      {children}
    </>
  );
}
