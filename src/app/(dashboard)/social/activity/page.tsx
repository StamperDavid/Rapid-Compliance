'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /social/activity -> /social/command-center
 * The command center already contains an activity feed section.
 * The standalone activity page was redundant.
 */
export default function ActivityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/social/command-center');
  }, [router]);

  return null;
}
