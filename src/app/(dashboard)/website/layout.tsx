'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { WEBSITE_TABS } from '@/lib/constants/subpage-nav';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={WEBSITE_TABS} />
      {children}
    </>
  );
}
