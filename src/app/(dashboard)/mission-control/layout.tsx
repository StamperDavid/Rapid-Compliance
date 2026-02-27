'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { MISSION_CONTROL_TABS } from '@/lib/constants/subpage-nav';

export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={MISSION_CONTROL_TABS} />
      {children}
    </>
  );
}
