'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /leads -> /crm?view=leads
 * The CRM page has a unified leads tab with the same functionality.
 */
export default function LeadsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/crm?view=leads');
  }, [router]);

  return null;
}
