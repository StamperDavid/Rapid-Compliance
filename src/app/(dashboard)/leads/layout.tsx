'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { LEADS_TABS } from '@/lib/constants/subpage-nav';

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={LEADS_TABS} />
      {children}
    </>
  );
}
