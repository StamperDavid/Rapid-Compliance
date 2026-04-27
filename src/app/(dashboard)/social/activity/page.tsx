'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /social/activity -> /social
 * The Social Hub now contains an activity feed section.
 * The standalone activity page is redundant.
 */
export default function ActivityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/social');
  }, [router]);

  return null;
}
