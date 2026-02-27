'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /settings/workflows -> /workflows
 * The main workflows page + dedicated builder is the canonical implementation.
 */
export default function SettingsWorkflowsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workflows');
  }, [router]);

  return null;
}
