'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { WEBSITE_SEO_TABS } from '@/lib/constants/subpage-nav';

export default function WebsiteSeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={WEBSITE_SEO_TABS} />
      {children}
    </>
  );
}
