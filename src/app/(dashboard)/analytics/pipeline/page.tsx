'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /analytics/pipeline -> /analytics/sales
 * Pipeline and sales analytics are now merged into a single CRM Analytics page with tabs.
 */
export default function PipelineRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/analytics/sales');
  }, [router]);

  return null;
}
