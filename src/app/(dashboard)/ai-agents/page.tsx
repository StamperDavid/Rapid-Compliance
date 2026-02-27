'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /ai-agents -> /workforce
 * The workforce page is a superset (adds tier filtering + hierarchy view).
 */
export default function AIAgentsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workforce');
  }, [router]);

  return null;
}
