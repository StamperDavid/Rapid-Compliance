'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { WEBSITE_BLOG_TABS } from '@/lib/constants/subpage-nav';

export default function WebsiteBlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={WEBSITE_BLOG_TABS} />
      {children}
    </>
  );
}
