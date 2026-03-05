'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /leads/discovery → /leads/research
 * Discovery is now part of the consolidated Lead Research page.
 */
export default function DiscoveryRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/leads/research'); }, [router]);
  return null;
}
