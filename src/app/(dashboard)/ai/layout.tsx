'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { AI_DATA_TABS } from '@/lib/constants/subpage-nav';

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={AI_DATA_TABS} />
      {children}
    </>
  );
}
