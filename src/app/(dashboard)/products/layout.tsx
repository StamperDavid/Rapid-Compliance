'use client';

import SubpageNav from '@/components/ui/SubpageNav';
import { CATALOG_TABS } from '@/lib/constants/subpage-nav';

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageNav items={CATALOG_TABS} />
      {children}
    </>
  );
}
