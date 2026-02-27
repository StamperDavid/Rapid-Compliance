'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { SOCIAL_TABS } from '@/lib/constants/subpage-nav';

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={SOCIAL_TABS} />
      {children}
    </>
  );
}
