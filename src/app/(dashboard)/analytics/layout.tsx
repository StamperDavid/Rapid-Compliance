'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { ANALYTICS_TABS } from '@/lib/constants/subpage-nav';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={ANALYTICS_TABS} />
      {children}
    </>
  );
}
