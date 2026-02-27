'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { TEAM_TABS } from '@/lib/constants/subpage-nav';

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={TEAM_TABS} />
      {children}
    </>
  );
}
