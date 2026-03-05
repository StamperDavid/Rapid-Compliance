'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /leads/icp → /leads/research
 * ICP management is now part of the consolidated Lead Research page.
 */
export default function IcpRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/leads/research'); }, [router]);
  return null;
}
